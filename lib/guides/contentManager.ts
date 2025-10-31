import fs from 'fs/promises'
import path from 'path'

export interface GuideSection {
  id: string
  title: string
  content: string
  tips?: string[]
  image?: string
}

export interface DirectoryGuideData {
  slug: string
  title: string
  description: string
  directoryName: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedReadTime: string
  featuredImage: string
  publishedAt: string
  updatedAt: string
  version: string
  viewCount?: number
  seo: {
    title: string
    description: string
    keywords: string[]
  }
  content: {
    requirements?: string[]
    tools?: string[]
    sections: GuideSection[]
  }
  internalLinks: {
    relatedGuides: string[]
    relatedDirectories: string[]
  }
}

export class GuideContentManager {
  private guidesPath = path.join(process.cwd(), 'data', 'guides')
  private versionHistoryPath = path.join(process.cwd(), 'data', 'guides', '_versions')

  constructor() {
    this.ensureDirectoriesExist()
  }

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.guidesPath, { recursive: true })
      await fs.mkdir(this.versionHistoryPath, { recursive: true })
    } catch (error) {
      console.error('Error creating guides directories:', error)
    }
  }

  async getAllGuides(): Promise<DirectoryGuideData[]> {
    try {
      const files = await fs.readdir(this.guidesPath)
      const guideFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('_'))
      
      const guides: DirectoryGuideData[] = []
      for (const file of guideFiles) {
        try {
          const guide = await this.getGuideBySlug(file.replace('.json', ''))
          if (guide) {
            guides.push(guide)
          }
        } catch (error) {
          console.error(`Error loading guide ${file}:`, error)
        }
      }

      return guides.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch (error) {
      console.error('Error loading guides:', error)
      return []
    }
  }

  async getGuideBySlug(slug: string): Promise<DirectoryGuideData | null> {
    try {
      const filePath = path.join(this.guidesPath, `${slug}.json`)
      
      // Check if file exists first
      try {
        await fs.access(filePath)
      } catch (accessError) {
        // File doesn't exist, return null silently
        return null
      }
      
      const fileContent = await fs.readFile(filePath, 'utf-8')
      
      // Validate file content before parsing
      if (!fileContent || !fileContent.trim()) {
        console.warn(`Empty JSON file detected: ${slug}.json`)
        return null
      }
      
      // Check for basic JSON structure
      const trimmedContent = fileContent.trim()
      if (!trimmedContent.startsWith('{') || !trimmedContent.endsWith('}')) {
        console.warn(`Malformed JSON structure in file: ${slug}.json`)
        return null
      }
      
      // Safe JSON parsing with comprehensive error handling
      let guide: DirectoryGuideData
      try {
        guide = JSON.parse(fileContent) as DirectoryGuideData
      } catch (parseError) {
        console.error(`JSON parsing failed for guide ${slug}:`, parseError)
        return null
      }
      
      // Validate parsed object structure
      if (!guide || typeof guide !== 'object') {
        console.warn(`Invalid guide object structure: ${slug}.json`)
        return null
      }
      
      // Validate required fields
      if (!guide.slug || !guide.title || !guide.directoryName) {
        console.warn(`Missing required fields in guide: ${slug}.json`)
        return null
      }
      
      // Increment view count (in a real app, you'd want to do this more carefully)
      await this.incrementViewCount(slug)
      
      return guide
    } catch (error) {
      console.error(`Error loading guide ${slug}:`, error)
      return null
    }
  }

  async createGuide(guide: Omit<DirectoryGuideData, 'publishedAt' | 'updatedAt' | 'version'>): Promise<DirectoryGuideData> {
    const now = new Date().toISOString()
    const newGuide: DirectoryGuideData = {
      ...guide,
      publishedAt: now,
      updatedAt: now,
      version: '1.0.0',
      viewCount: 0
    }

    await this.saveGuide(newGuide)
    return newGuide
  }

  async updateGuide(slug: string, updates: Partial<DirectoryGuideData>): Promise<DirectoryGuideData | null> {
    const existingGuide = await this.getGuideBySlug(slug)
    if (!existingGuide) {
      throw new Error(`Guide ${slug} not found`)
    }

    // Save current version to history
    await this.saveVersionHistory(existingGuide)

    // Create updated guide with new version
    const updatedGuide: DirectoryGuideData = {
      ...existingGuide,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: this.incrementVersion(existingGuide.version)
    }

    await this.saveGuide(updatedGuide)
    
    // Update internal links
    await this.updateInternalLinks(updatedGuide)
    
    return updatedGuide
  }

  async deleteGuide(slug: string): Promise<boolean> {
    try {
      const filePath = path.join(this.guidesPath, `${slug}.json`)
      await fs.unlink(filePath)
      
      // Clean up version history
      const versionPath = path.join(this.versionHistoryPath, slug)
      try {
        await fs.rmdir(versionPath, { recursive: true })
      } catch (error) {
        // Version history might not exist, that's ok
      }
      
      return true
    } catch (error) {
      console.error(`Error deleting guide ${slug}:`, error)
      return false
    }
  }

  async getCategories(): Promise<string[]> {
    const guides = await this.getAllGuides()
    const categories = [...new Set(guides.map(guide => guide.category))]
    return categories.sort()
  }

  async getGuidesByCategory(category: string): Promise<DirectoryGuideData[]> {
    const guides = await this.getAllGuides()
    return guides.filter(guide => guide.category === category)
  }

  async searchGuides(query: string): Promise<DirectoryGuideData[]> {
    const guides = await this.getAllGuides()
    const lowercaseQuery = query.toLowerCase()
    
    return guides.filter(guide => 
      guide.title.toLowerCase().includes(lowercaseQuery) ||
      guide.description.toLowerCase().includes(lowercaseQuery) ||
      guide.directoryName.toLowerCase().includes(lowercaseQuery) ||
      guide.seo.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
    )
  }

  private async saveGuide(guide: DirectoryGuideData): Promise<void> {
    const filePath = path.join(this.guidesPath, `${guide.slug}.json`)
    await fs.writeFile(filePath, JSON.stringify(guide, null, 2), 'utf-8')
  }

  private async saveVersionHistory(guide: DirectoryGuideData): Promise<void> {
    const versionDir = path.join(this.versionHistoryPath, guide.slug)
    await fs.mkdir(versionDir, { recursive: true })
    
    const versionFile = path.join(versionDir, `${guide.version}.json`)
    await fs.writeFile(versionFile, JSON.stringify(guide, null, 2), 'utf-8')
  }

  async getVersionHistory(slug: string): Promise<DirectoryGuideData[]> {
    try {
      const versionDir = path.join(this.versionHistoryPath, slug)
      const files = await fs.readdir(versionDir)
      const versions: DirectoryGuideData[] = []
      
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const filePath = path.join(versionDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          
          // Validate content before parsing
          if (!content || !content.trim()) {
            console.warn(`Empty version file detected: ${file}`)
            continue
          }
          
          // Safe JSON parsing
          const version = JSON.parse(content) as DirectoryGuideData
          
          // Validate version object
          if (version && typeof version === 'object' && version.slug) {
            versions.push(version)
          } else {
            console.warn(`Invalid version object in file: ${file}`)
          }
        } catch (parseError) {
          console.error(`Error parsing version file ${file}:`, parseError)
          continue
        }
      }
      
      return versions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch (error) {
      console.error(`Error loading version history for ${slug}:`, error)
      return []
    }
  }

  private incrementVersion(currentVersion: string): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number)
    return `${major}.${minor}.${patch + 1}`
  }

  private async incrementViewCount(slug: string): Promise<void> {
    try {
      const filePath = path.join(this.guidesPath, `${slug}.json`)
      
      // Check if file exists
      try {
        await fs.access(filePath)
      } catch (accessError) {
        console.warn(`Cannot increment view count - file not found: ${slug}.json`)
        return
      }
      
      const fileContent = await fs.readFile(filePath, 'utf-8')
      
      // Validate content before parsing
      if (!fileContent || !fileContent.trim()) {
        console.warn(`Cannot increment view count - empty file: ${slug}.json`)
        return
      }
      
      // Safe JSON parsing
      let guide: DirectoryGuideData
      try {
        guide = JSON.parse(fileContent) as DirectoryGuideData
      } catch (parseError) {
        console.error(`Cannot increment view count - JSON parsing failed for ${slug}:`, parseError)
        return
      }
      
      // Validate guide object
      if (!guide || typeof guide !== 'object') {
        console.warn(`Cannot increment view count - invalid guide object: ${slug}.json`)
        return
      }
      
      guide.viewCount = (guide.viewCount || 0) + 1
      
      await fs.writeFile(filePath, JSON.stringify(guide, null, 2), 'utf-8')
    } catch (error) {
      console.error(`Error incrementing view count for ${slug}:`, error)
    }
  }

  private async updateInternalLinks(guide: DirectoryGuideData): Promise<void> {
    // Find related guides based on category and keywords
    const allGuides = await this.getAllGuides()
    const relatedGuides = allGuides
      .filter(g => g.slug !== guide.slug)
      .filter(g => 
        g.category === guide.category || 
        g.seo.keywords.some(keyword => guide.seo.keywords.includes(keyword))
      )
      .slice(0, 5) // Limit to top 5 related guides
      .map(g => g.slug)

    guide.internalLinks.relatedGuides = relatedGuides
    await this.saveGuide(guide)
  }

  // Batch operations for managing 100+ guides
  async batchUpdate(updates: { slug: string; data: Partial<DirectoryGuideData> }[]): Promise<void> {
    const results = await Promise.allSettled(
      updates.map(update => this.updateGuide(update.slug, update.data))
    )
    
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`${failed.length} guides failed to update:`, failed)
    }
  }

  async generateSEOReport(): Promise<{
    totalGuides: number
    categoryCounts: Record<string, number>
    averageReadTime: string
    topKeywords: { keyword: string; count: number }[]
  }> {
    const guides = await this.getAllGuides()
    
    const categoryCounts = guides.reduce((acc, guide) => {
      acc[guide.category] = (acc[guide.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const allKeywords = guides.flatMap(guide => guide.seo.keywords)
    const keywordCounts = allKeywords.reduce((acc, keyword) => {
      acc[keyword] = (acc[keyword] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }))

    const totalReadTimeMinutes = guides.reduce((total, guide) => {
      const minutes = parseInt(guide.estimatedReadTime.split(' ')[0]) || 0
      return total + minutes
    }, 0)

    return {
      totalGuides: guides.length,
      categoryCounts,
      averageReadTime: `${Math.round(totalReadTimeMinutes / guides.length)} min read`,
      topKeywords
    }
  }
}