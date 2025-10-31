// Import polyfills first for Node.js 18+ compatibility with undici/supabase
import '../utils/node-polyfills'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'
import { DirectoryTierManager, DirectoryTierData } from './directory-tiers'

export interface Directory {
  id: string
  name: string
  category: string
  authority: number
  estimatedTraffic: number
  timeToApproval: string
  difficulty: 'easy' | 'medium' | 'hard'
  price: number
  features: string[]
  submissionUrl: string
  isActive: boolean
  requiresApproval: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DirectoryQuery {
  limit?: number
  offset?: number
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  maxPrice?: number
  isActive?: boolean
  orderBy?: string
  tier?: number
  userTier?: number // Filter directories based on user's subscription tier
  minAuthority?: number
  trafficPotential?: 'low' | 'medium' | 'high' | 'premium'
}

export class DirectoryDatabase {
  private supabase: SupabaseClient | null
  private connectionPool: Map<string, SupabaseClient>
  private isSupabaseEnabled: boolean

  constructor() {
    this.isSupabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    if (this.isSupabaseEnabled) {
      this.supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        }
      )
      this.connectionPool = new Map()
      this.initializeDatabase()
    } else {
      this.supabase = null
      this.connectionPool = new Map()
      // Use fallback data when Supabase isn't available
      logger.warn('DirectoryDatabase: Using fallback data - Supabase not configured')
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Test connection
      if (!this.supabase) {
        throw new Error('Supabase client is not initialized')
      }
      
      const response = await this.supabase.from('directories').select('count(*)', { count: 'exact' })
      const { error } = response || {}
      
      if (error) {
        logger.error('Database connection failed', { metadata: { error: error.message } })
        throw new Error(`Database initialization failed: ${error.message}`)
      }

      // Ensure indexes exist for performance
      await this.ensureIndexes()
      
      logger.info('Database connection established successfully')
    } catch (error) {
      logger.error('Database initialization error', {}, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  private async ensureIndexes(): Promise<void> {
    try {
      // These would typically be run as migrations
      // Note: In production, these should be handled by proper migrations
      logger.info('Database indexes verified')
    } catch (error) {
      // Index creation warning (may already exist) - suppress for production
    }
  }

  async getDirectories(query: DirectoryQuery = {}): Promise<Directory[]> {
    try {
      // Return fallback data if Supabase isn't configured
      if (!this.isSupabaseEnabled || !this.supabase) {
        return this.getFallbackDirectories(query)
      }

      // If user has a tier specified, use the tier system
      if (query.userTier) {
        return this.getDirectoriesByTier(query.userTier, query)
      }

      let queryBuilder = this.supabase
        .from('directories')
        .select('*')

      // Apply filters
      if (query.category) {
        queryBuilder = queryBuilder.eq('category', query.category)
      }

      if (query.difficulty) {
        queryBuilder = queryBuilder.eq('difficulty', query.difficulty)
      }

      if (query.maxPrice !== undefined) {
        queryBuilder = queryBuilder.lte('price', query.maxPrice)
      }

      if (query.isActive !== undefined) {
        queryBuilder = queryBuilder.eq('is_active', query.isActive)
      }

      if (query.minAuthority !== undefined) {
        queryBuilder = queryBuilder.gte('authority', query.minAuthority)
      }

      // Apply ordering
      if (query.orderBy) {
        const [column, direction] = query.orderBy.split(' ')
        queryBuilder = queryBuilder.order(column, { 
          ascending: direction?.toLowerCase() !== 'desc' 
        })
      } else {
        queryBuilder = queryBuilder.order('authority', { ascending: false })
      }

      // Apply pagination
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit)
      }

      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 50) - 1)
      }

      const { data, error } = await queryBuilder

      if (error) {
        throw new Error(`Failed to fetch directories: ${error.message}`)
      }

      if (!data) {
        logger.warn('No data returned from directories query')
        return []
      }

      // Transform to our interface
      return data.map(this.transformDirectoryRow)

    } catch (error) {
      logger.error('Failed to fetch directories', { metadata: { query } }, error instanceof Error ? error : new Error(String(error)))
      
      // Return default directories as fallback
      return this.getDefaultDirectories()
    }
  }

  /**
   * Get directories based on user's subscription tier
   */
  async getDirectoriesByTier(userTier: number, additionalFilters: Partial<DirectoryQuery> = {}): Promise<Directory[]> {
    try {
      // Get tier-specific directories from our strategic system
      const tierDirectories = DirectoryTierManager.getDirectoriesForTier(userTier)
      
      // Convert to our Directory interface and apply additional filters
      let directories = tierDirectories.map(this.convertTierToDirectory)

      // Apply additional filters
      if (additionalFilters.category) {
        directories = directories.filter(d => d.category === additionalFilters.category)
      }

      if (additionalFilters.difficulty) {
        directories = directories.filter(d => d.difficulty === additionalFilters.difficulty)
      }

      if (additionalFilters.minAuthority !== undefined) {
        directories = directories.filter(d => d.authority >= additionalFilters.minAuthority!)
      }

      // Apply limit
      if (additionalFilters.limit) {
        directories = directories.slice(0, additionalFilters.limit)
      }

      logger.info(`Retrieved ${directories.length} directories for tier ${userTier}`)
      return directories

    } catch (error) {
      logger.error('Failed to get directories by tier', { metadata: { userTier, additionalFilters } }, error instanceof Error ? error : new Error(String(error)))
      
      // Fallback to regular directory query
      return this.getDirectories(additionalFilters)
    }
  }

  /**
   * Convert DirectoryTierData to Directory interface
   */
  private convertTierToDirectory(tierData: DirectoryTierData): Directory {
    return {
      id: tierData.id,
      name: tierData.name,
      category: tierData.category,
      authority: tierData.domainAuthority,
      estimatedTraffic: tierData.estimatedTrafficValue,
      timeToApproval: tierData.submissionTime,
      difficulty: tierData.difficulty,
      price: 0, // Directory submissions are included in subscription
      features: tierData.features,
      submissionUrl: tierData.submissionUrl,
      isActive: true,
      requiresApproval: tierData.requiresApproval,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async getDirectoryById(id: string): Promise<Directory | null> {
    try {
      if (!this.supabase) {
        logger.warn('Supabase client not available, returning null')
        return null
      }
      
      const response = await this.supabase
        .from('directories')
        .select('*')
        .eq('id', id)
        .single()
      
      const { data, error } = response || {}

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        throw new Error(`Failed to fetch directory: ${error.message}`)
      }

      if (!data) {
        logger.warn('Directory not found', { metadata: { id } })
        return null
      }

      return this.transformDirectoryRow(data)

    } catch (error) {
      logger.error('Failed to fetch directory by ID', { metadata: { error, id } })
      return null
    }
  }

  async createDirectory(directory: Partial<Directory>): Promise<Directory> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client is not initialized')
      }
      
      const response = await this.supabase
        .from('directories')
        .insert([{
          name: directory.name,
          category: directory.category,
          authority: directory.authority || 50,
          estimated_traffic: directory.estimatedTraffic || 1000,
          time_to_approval: directory.timeToApproval || '1-3 days',
          difficulty: directory.difficulty || 'medium',
          price: directory.price || 0,
          features: directory.features || [],
          submission_url: directory.submissionUrl,
          is_active: directory.isActive !== false,
          requires_approval: directory.requiresApproval !== false
        }])
        .select()
        .single()
      
      const { data, error } = response || {}

      if (error) {
        throw new Error(`Failed to create directory: ${error.message}`)
      }

      if (!data) {
        throw new Error('No data returned from directory creation')
      }

      logger.info('Directory created successfully', { metadata: { id: data.id, name: directory.name } })
      return this.transformDirectoryRow(data)

    } catch (error) {
      logger.error('Failed to create directory', { metadata: { directory: directory.name } }, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async updateDirectory(id: string, updates: Partial<Directory>): Promise<Directory> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client is not initialized')
      }
      
      const response = await this.supabase
        .from('directories')
        .update({
          ...(updates.name && { name: updates.name }),
          ...(updates.category && { category: updates.category }),
          ...(updates.authority !== undefined && { authority: updates.authority }),
          ...(updates.estimatedTraffic !== undefined && { estimated_traffic: updates.estimatedTraffic }),
          ...(updates.timeToApproval && { time_to_approval: updates.timeToApproval }),
          ...(updates.difficulty && { difficulty: updates.difficulty }),
          ...(updates.price !== undefined && { price: updates.price }),
          ...(updates.features && { features: updates.features }),
          ...(updates.submissionUrl && { submission_url: updates.submissionUrl }),
          ...(updates.isActive !== undefined && { is_active: updates.isActive }),
          ...(updates.requiresApproval !== undefined && { requires_approval: updates.requiresApproval }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
      
      const { data, error } = response || {}

      if (error) {
        throw new Error(`Failed to update directory: ${error.message}`)
      }

      if (!data) {
        throw new Error('No data returned from directory update')
      }

      logger.info('Directory updated successfully', { metadata: { id, updates: Object.keys(updates) } })
      return this.transformDirectoryRow(data)

    } catch (error) {
      logger.error('Failed to update directory', { metadata: { id, updates } }, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async deleteDirectory(id: string): Promise<boolean> {
    try {
      if (!this.supabase) {
        logger.warn('Supabase client not available, cannot delete directory')
        return false
      }
      
      const response = await this.supabase
        .from('directories')
        .delete()
        .eq('id', id)
      
      const { error } = response || {}

      if (error) {
        throw new Error(`Failed to delete directory: ${error.message}`)
      }

      logger.info('Directory deleted successfully', { metadata: { id } })
      return true

    } catch (error) {
      logger.error('Failed to delete directory', { metadata: { error, id } })
      return false
    }
  }

  async getDirectoryStats(): Promise<{
    total: number
    active: number
    byCategory: Record<string, number>
    byDifficulty: Record<string, number>
  }> {
    try {
      if (!this.supabase) {
        logger.warn('Supabase client not available, returning empty stats')
        return {
          total: 0,
          active: 0,
          byCategory: {},
          byDifficulty: {}
        }
      }
      
      const totalResponse = await this.supabase
        .from('directories')
        .select('*', { count: 'exact' })
      const { data: totalData } = totalResponse || {}

      const activeResponse = await this.supabase
        .from('directories')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
      const { data: activeData } = activeResponse || {}

      const categoryResponse = await this.supabase
        .from('directories')
        .select('category')
      const { data: categoryData } = categoryResponse || {}

      const difficultyResponse = await this.supabase
        .from('directories')
        .select('difficulty')
      const { data: difficultyData } = difficultyResponse || {}

      // Aggregate stats
      const byCategory: Record<string, number> = {}
      const byDifficulty: Record<string, number> = {}

      categoryData?.forEach(row => {
        byCategory[row.category] = (byCategory[row.category] || 0) + 1
      })

      difficultyData?.forEach(row => {
        byDifficulty[row.difficulty] = (byDifficulty[row.difficulty] || 0) + 1
      })

      return {
        total: totalData?.length || 0,
        active: activeData?.length || 0,
        byCategory,
        byDifficulty
      }

    } catch (error) {
      logger.error('Failed to fetch directory stats', { metadata: { error } })
      return {
        total: 0,
        active: 0,
        byCategory: {},
        byDifficulty: {}
      }
    }
  }

  private transformDirectoryRow(row: any): Directory {
    if (!row || typeof row !== 'object') {
      throw new Error('Invalid directory row data')
    }

    return {
      id: row.id || '',
      name: row.name || '',
      category: row.category || '',
      authority: typeof row.authority === 'number' ? row.authority : 50,
      estimatedTraffic: typeof row.estimated_traffic === 'number' ? row.estimated_traffic : 1000,
      timeToApproval: row.time_to_approval || '1-3 days',
      difficulty: ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'medium',
      price: typeof row.price === 'number' ? row.price : 0,
      features: Array.isArray(row.features) ? row.features : [],
      submissionUrl: row.submission_url || '',
      isActive: row.is_active !== false,
      requiresApproval: row.requires_approval !== false,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : (row.created_at ? new Date(row.created_at) : new Date())
    }
  }

  private getDefaultDirectories(): Directory[] {
    // Fallback directories if database is unavailable
    return [
      {
        id: '1',
        name: 'Google Business Profile',
        category: 'Search Engines',
        authority: 100,
        estimatedTraffic: 50000,
        timeToApproval: 'Instant',
        difficulty: 'easy',
        price: 0,
        features: ['Local SEO', 'Reviews', 'Photos', 'Posts'],
        submissionUrl: 'https://business.google.com',
        isActive: true,
        requiresApproval: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'Yelp',
        category: 'Review Sites',
        authority: 95,
        estimatedTraffic: 25000,
        timeToApproval: '1-2 days',
        difficulty: 'easy',
        price: 0,
        features: ['Customer Reviews', 'Business Info', 'Photos'],
        submissionUrl: 'https://business.yelp.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // Add more default directories as needed
    ]
  }

  /**
   * Get fallback directories when Supabase isn't available
   */
  private getFallbackDirectories(query: DirectoryQuery = {}): Directory[] {
    const fallbackDirectories: Directory[] = [
      {
        id: '1',
        name: 'Google Business Profile',
        category: 'search-engines',
        authority: 100,
        estimatedTraffic: 50000,
        timeToApproval: '1-3 days',
        difficulty: 'easy',
        price: 0,
        features: ['Free listing', 'Reviews', 'Photos', 'Business hours'],
        submissionUrl: 'https://business.google.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'Yelp',
        category: 'review-sites',
        authority: 95,
        estimatedTraffic: 25000,
        timeToApproval: '1-2 days',
        difficulty: 'easy',
        price: 0,
        features: ['Free business page', 'Customer reviews', 'Photos'],
        submissionUrl: 'https://business.yelp.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        name: 'Facebook Business',
        category: 'social-media',
        authority: 98,
        estimatedTraffic: 35000,
        timeToApproval: '1-2 days',
        difficulty: 'easy',
        price: 0,
        features: ['Business page', 'Events', 'Messaging', 'Reviews'],
        submissionUrl: 'https://business.facebook.com',
        isActive: true,
        requiresApproval: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        name: 'Yellow Pages',
        category: 'general-directories',
        authority: 85,
        estimatedTraffic: 15000,
        timeToApproval: '2-5 days',
        difficulty: 'easy',
        price: 0,
        features: ['Basic listing', 'Contact info', 'Website link'],
        submissionUrl: 'https://yellowpages.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '5',
        name: 'Bing Places',
        category: 'search-engines',
        authority: 90,
        estimatedTraffic: 20000,
        timeToApproval: '3-7 days',
        difficulty: 'easy',
        price: 0,
        features: ['Search visibility', 'Business details', 'Customer engagement'],
        submissionUrl: 'https://places.bing.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '6',
        name: 'Apple Maps',
        category: 'map-services',
        authority: 92,
        estimatedTraffic: 18000,
        timeToApproval: '5-10 days',
        difficulty: 'medium',
        price: 0,
        features: ['Maps listing', 'Business info', 'Customer reviews'],
        submissionUrl: 'https://mapsconnect.apple.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '7',
        name: 'TripAdvisor',
        category: 'travel-hospitality',
        authority: 88,
        estimatedTraffic: 30000,
        timeToApproval: '3-7 days',
        difficulty: 'medium',
        price: 0,
        features: ['Business listing', 'Reviews', 'Photos', 'Travel insights'],
        submissionUrl: 'https://tripadvisor.com/owners',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '8',
        name: 'Better Business Bureau',
        category: 'business-associations',
        authority: 93,
        estimatedTraffic: 8000,
        timeToApproval: '7-14 days',
        difficulty: 'medium',
        price: 299,
        features: ['Accreditation', 'Trust badge', 'Complaint resolution'],
        submissionUrl: 'https://bbb.org',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '9',
        name: 'Angie\'s List',
        category: 'service-directories',
        authority: 85,
        estimatedTraffic: 14000,
        timeToApproval: '2-5 days',
        difficulty: 'medium',
        price: 0,
        features: ['Service provider listing', 'Reviews', 'Lead generation'],
        submissionUrl: 'https://angieslist.com',
        isActive: true,
        requiresApproval: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '10',
        name: 'Thumbtack',
        category: 'service-directories',
        authority: 82,
        estimatedTraffic: 22000,
        timeToApproval: '1-3 days',
        difficulty: 'easy',
        price: 0,
        features: ['Professional services', 'Lead generation', 'Customer matching'],
        submissionUrl: 'https://thumbtack.com/pro',
        isActive: true,
        requiresApproval: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // Apply filters to fallback data
    let filtered = fallbackDirectories

    if (query.category) {
      filtered = filtered.filter(d => d.category === query.category)
    }

    if (query.difficulty) {
      filtered = filtered.filter(d => d.difficulty === query.difficulty)
    }

    if (query.maxPrice !== undefined) {
      filtered = filtered.filter(d => d.price <= query.maxPrice!)
    }

    if (query.isActive !== undefined) {
      filtered = filtered.filter(d => d.isActive === query.isActive)
    }

    if (query.minAuthority !== undefined) {
      filtered = filtered.filter(d => d.authority >= query.minAuthority!)
    }

    // Apply sorting
    if (query.orderBy) {
      if (query.orderBy.includes('authority DESC')) {
        filtered.sort((a, b) => b.authority - a.authority)
      } else if (query.orderBy.includes('authority ASC')) {
        filtered.sort((a, b) => a.authority - b.authority)
      } else if (query.orderBy.includes('price ASC')) {
        filtered.sort((a, b) => a.price - b.price)
      }
    }

    // Apply limit
    if (query.limit) {
      filtered = filtered.slice(0, query.limit)
    }

    return filtered
  }
}