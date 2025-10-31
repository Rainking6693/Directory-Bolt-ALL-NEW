// 🚀 DATABASE MIGRATION SCRIPT - Directory Population
// Populates the database with 500+ high-value directories organized by subscription tiers

import { createClient } from '@supabase/supabase-js';
import { DIRECTORY_SEED_DATA, createDirectoriesTable, seedDirectoriesData } from './directory-seed';
import { logger } from '../utils/logger';

interface MigrationOptions {
  dropExisting?: boolean;
  validateData?: boolean;
  batchSize?: number;
  dryRun?: boolean;
}

export class DirectoryMigration {
  private supabase: any;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  async runMigration(options: MigrationOptions = {}): Promise<void> {
    const {
      dropExisting = false,
      validateData = true,
      batchSize = 50,
      dryRun = false
    } = options;

    try {
      logger.info('Starting directory database migration...', {
        metadata: {
          totalDirectories: DIRECTORY_SEED_DATA.length,
          dropExisting,
          validateData,
          batchSize,
          dryRun
        }
      });

      // Step 1: Validate data if requested
      if (validateData) {
        await this.validateSeedData();
      }

      // Step 2: Create/recreate table structure
      await this.createTableStructure(dropExisting);

      if (dryRun) {
        logger.info('Dry run complete - no data was inserted');
        return;
      }

      // Step 3: Insert directory data in batches
      await this.insertDirectoriesInBatches(batchSize);

      // Step 4: Verify insertion
      await this.verifyMigration();

      // Step 5: Update statistics
      const stats = await this.generateStatistics();

      logger.info('Directory migration completed successfully!', {
        metadata: stats
      });

    } catch (error) {
      logger.error('Directory migration failed', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async validateSeedData(): Promise<void> {
    logger.info('Validating seed data...');
    
    const errors: string[] = [];
    const seenWebsites = new Set<string>();
    const seenNames = new Set<string>();

    DIRECTORY_SEED_DATA.forEach((dir, index) => {
      // Check required fields
      if (!dir.name || dir.name.trim().length === 0) {
        errors.push(`Row ${index}: Missing or empty name`);
      }

      if (!dir.website || !this.isValidUrl(dir.website)) {
        errors.push(`Row ${index}: Invalid website URL: ${dir.website}`);
      }

      if (!dir.category || dir.category.trim().length === 0) {
        errors.push(`Row ${index}: Missing category`);
      }

      if (!dir.submission_url || !this.isValidUrl(dir.submission_url)) {
        errors.push(`Row ${index}: Invalid submission URL: ${dir.submission_url}`);
      }

      // Check for duplicates
      if (seenWebsites.has(dir.website)) {
        errors.push(`Row ${index}: Duplicate website URL: ${dir.website}`);
      }
      seenWebsites.add(dir.website);

      if (seenNames.has(dir.name)) {
        errors.push(`Row ${index}: Duplicate name: ${dir.name}`);
      }
      seenNames.add(dir.name);

      // Validate ranges
      if (dir.domain_authority < 0 || dir.domain_authority > 100) {
        errors.push(`Row ${index}: Domain authority must be 0-100: ${dir.domain_authority}`);
      }

      if (![1, 2, 3, 4].includes(dir.tier_required)) {
        errors.push(`Row ${index}: Tier must be 1-4: ${dir.tier_required}`);
      }

      if (!['Easy', 'Medium', 'Hard'].includes(dir.difficulty)) {
        errors.push(`Row ${index}: Invalid difficulty: ${dir.difficulty}`);
      }

      if (!['High', 'Medium', 'Low'].includes(dir.impact_level)) {
        errors.push(`Row ${index}: Invalid impact level: ${dir.impact_level}`);
      }

      // Validate price
      if (dir.price < 0) {
        errors.push(`Row ${index}: Price cannot be negative: ${dir.price}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Data validation failed:\n${errors.join('\n')}`);
    }

    logger.info('Seed data validation passed', {
      metadata: {
        totalRecords: DIRECTORY_SEED_DATA.length,
        uniqueWebsites: seenWebsites.size,
        uniqueNames: seenNames.size
      }
    });
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private async createTableStructure(dropExisting: boolean): Promise<void> {
    logger.info('Creating table structure...');

    try {
      if (dropExisting) {
        const { error: dropError } = await this.supabase.rpc('exec_sql', {
          query: 'DROP TABLE IF EXISTS directories CASCADE;'
        });
        
        if (dropError) {
          logger.warn('Could not drop existing table', { metadata: { error: dropError.message } });
        }
      }

      // Create table and indexes
      const createTableSQL = createDirectoriesTable();
      const { error } = await this.supabase.rpc('exec_sql', {
        query: createTableSQL
      });

      if (error) {
        throw new Error(`Failed to create table structure: ${error.message}`);
      }

      logger.info('Table structure created successfully');
    } catch (error) {
      logger.error('Failed to create table structure', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async insertDirectoriesInBatches(batchSize: number): Promise<void> {
    logger.info(`Inserting directories in batches of ${batchSize}...`);

    const totalBatches = Math.ceil(DIRECTORY_SEED_DATA.length / batchSize);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, DIRECTORY_SEED_DATA.length);
      const batch = DIRECTORY_SEED_DATA.slice(start, end);

      try {
        // Transform data for Supabase
        const transformedBatch = batch.map(dir => ({
          name: dir.name,
          website: dir.website,
          category: dir.category,
          domain_authority: dir.domain_authority,
          impact_level: dir.impact_level,
          submission_url: dir.submission_url,
          tier_required: dir.tier_required,
          difficulty: dir.difficulty,
          active: dir.active,
          estimated_traffic: dir.estimated_traffic,
          time_to_approval: dir.time_to_approval,
          price: dir.price,
          features: dir.features,
          requires_approval: dir.requires_approval,
          country_code: dir.country_code || null,
          language: dir.language || 'en'
        }));

        const { error } = await this.supabase
          .from('directories')
          .upsert(transformedBatch, { 
            onConflict: 'website',
            ignoreDuplicates: false 
          });

        if (error) {
          logger.error(`Batch ${i + 1} failed`, { metadata: { error: error.message, batchSize: batch.length } });
          errorCount += batch.length;
        } else {
          logger.info(`Batch ${i + 1}/${totalBatches} completed`, { 
            metadata: { 
              processed: end, 
              total: DIRECTORY_SEED_DATA.length,
              batchSize: batch.length
            } 
          });
          successCount += batch.length;
        }
      } catch (error) {
        logger.error(`Batch ${i + 1} failed with exception`, {}, error instanceof Error ? error : new Error(String(error)));
        errorCount += batch.length;
      }

      // Small delay between batches to avoid overwhelming the database
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Batch insertion completed', {
      metadata: {
        successCount,
        errorCount,
        totalRecords: DIRECTORY_SEED_DATA.length
      }
    });

    if (errorCount > 0) {
      throw new Error(`Migration partially failed: ${errorCount} records failed to insert`);
    }
  }

  private async verifyMigration(): Promise<void> {
    logger.info('Verifying migration...');

    try {
      const { count, error } = await this.supabase
        .from('directories')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw new Error(`Verification failed: ${error.message}`);
      }

      const expectedCount = DIRECTORY_SEED_DATA.length;
      
      if (count !== expectedCount) {
        throw new Error(`Record count mismatch: expected ${expectedCount}, found ${count}`);
      }

      logger.info('Migration verification successful', {
        metadata: { recordCount: count }
      });
    } catch (error) {
      logger.error('Migration verification failed', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async generateStatistics(): Promise<any> {
    try {
      const { data: allDirectories, error } = await this.supabase
        .from('directories')
        .select('*');

      if (error) {
        throw new Error(`Failed to fetch directories for stats: ${error.message}`);
      }

      const stats = {
        total: allDirectories.length,
        byTier: {
          tier1: allDirectories.filter((d: any) => d.tier_required === 1).length,
          tier2: allDirectories.filter((d: any) => d.tier_required === 2).length,
          tier3: allDirectories.filter((d: any) => d.tier_required === 3).length,
          tier4: allDirectories.filter((d: any) => d.tier_required === 4).length,
        },
        byDifficulty: {
          easy: allDirectories.filter((d: any) => d.difficulty === 'Easy').length,
          medium: allDirectories.filter((d: any) => d.difficulty === 'Medium').length,
          hard: allDirectories.filter((d: any) => d.difficulty === 'Hard').length,
        },
        byCategory: this.groupBy(allDirectories, 'category'),
        byImpact: {
          high: allDirectories.filter((d: any) => d.impact_level === 'High').length,
          medium: allDirectories.filter((d: any) => d.impact_level === 'Medium').length,
          low: allDirectories.filter((d: any) => d.impact_level === 'Low').length,
        },
        averageDomainAuthority: Math.round(
          allDirectories.reduce((sum: number, d: any) => sum + d.domain_authority, 0) / allDirectories.length
        ),
        freeDirectories: allDirectories.filter((d: any) => d.price === 0).length,
        paidDirectories: allDirectories.filter((d: any) => d.price > 0).length,
        activeDirectories: allDirectories.filter((d: any) => d.active).length,
        requiresApproval: allDirectories.filter((d: any) => d.requires_approval).length
      };

      return stats;
    } catch (error) {
      logger.error('Failed to generate statistics', {}, error instanceof Error ? error : new Error(String(error)));
      return {};
    }
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }

  // Helper method to get directories by various criteria
  async getDirectoriesByFilter(filter: {
    tier?: number;
    category?: string;
    difficulty?: string;
    minDomainAuthority?: number;
    maxPrice?: number;
    active?: boolean;
    country?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = this.supabase.from('directories').select('*');

      if (filter.tier) {
        query = query.eq('tier_required', filter.tier);
      }

      if (filter.category) {
        query = query.eq('category', filter.category);
      }

      if (filter.difficulty) {
        query = query.eq('difficulty', filter.difficulty);
      }

      if (filter.minDomainAuthority) {
        query = query.gte('domain_authority', filter.minDomainAuthority);
      }

      if (filter.maxPrice !== undefined) {
        query = query.lte('price', filter.maxPrice);
      }

      if (filter.active !== undefined) {
        query = query.eq('active', filter.active);
      }

      if (filter.country) {
        query = query.eq('country_code', filter.country);
      }

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
      }

      // Default ordering by domain authority descending
      query = query.order('domain_authority', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch directories: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to fetch directories with filter', { metadata: { filter } }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

// CLI interface for running migrations
export async function runDirectoryMigration(options: MigrationOptions = {}): Promise<void> {
  const migration = new DirectoryMigration();
  await migration.runMigration(options);
}

// DirectoryMigration class is already exported above on line 15