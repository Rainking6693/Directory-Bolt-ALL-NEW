// 🚀 DIRECTORY SEEDING API - Database Population Endpoint
// Provides secure API access to populate the database with comprehensive directory data

import { NextApiRequest, NextApiResponse } from 'next';
import { DirectoryMigration } from '../../../lib/database/migrate-directories';
import { logger } from '../../../lib/utils/logger';
import { createApiResponse } from '../../../lib/utils/api-response';

interface SeedRequest {
  action: 'seed' | 'validate' | 'stats' | 'reset';
  options?: {
    dropExisting?: boolean;
    validateData?: boolean;
    batchSize?: number;
    dryRun?: boolean;
  };
  adminKey?: string;
}

interface SeedResponse {
  success: boolean;
  message: string;
  data?: any;
  stats?: any;
  errors?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SeedResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      createApiResponse(false, 'Method not allowed', null, ['Only POST requests are supported'])
    );
  }

  try {
    const { action, options = {}, adminKey }: SeedRequest = req.body;

    // Validate admin access
    if (!isAuthorized(adminKey, req)) {
      logger.warn('Unauthorized directory seeding attempt', {
        metadata: {
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      return res.status(401).json(
        createApiResponse(false, 'Unauthorized access', null, ['Valid admin key required'])
      );
    }

    const migration = new DirectoryMigration();

    switch (action) {
      case 'validate':
        await handleValidation(migration, res);
        break;

      case 'seed':
        await handleSeeding(migration, options, res);
        break;

      case 'stats':
        await handleStats(migration, res);
        break;

      case 'reset':
        await handleReset(migration, options, res);
        break;

      default:
        return res.status(400).json(
          createApiResponse(false, 'Invalid action', null, ['Action must be: validate, seed, stats, or reset'])
        );
    }

  } catch (error) {
    logger.error('Directory seeding API error', {}, error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(
      createApiResponse(
        false, 
        'Internal server error', 
        null, 
        [error instanceof Error ? error.message : 'Unknown error occurred']
      )
    );
  }
}

async function handleValidation(migration: DirectoryMigration, res: NextApiResponse<SeedResponse>) {
  try {
    logger.info('Starting directory data validation...');

    // This will throw if validation fails
    await migration.runMigration({ 
      dryRun: true, 
      validateData: true 
    });

    const response = createApiResponse(
      true,
      'Directory data validation successful',
      {
        action: 'validate',
        timestamp: new Date().toISOString()
      }
    );

    logger.info('Directory validation completed successfully');
    return res.status(200).json(response);

  } catch (error) {
    logger.error('Directory validation failed', {}, error instanceof Error ? error : new Error(String(error)));

    return res.status(400).json(
      createApiResponse(
        false,
        'Directory data validation failed',
        null,
        [error instanceof Error ? error.message : 'Validation error']
      )
    );
  }
}

async function handleSeeding(
  migration: DirectoryMigration, 
  options: any, 
  res: NextApiResponse<SeedResponse>
) {
  try {
    logger.info('Starting directory database seeding...', { metadata: { options } });

    const migrationOptions = {
      dropExisting: options.dropExisting || false,
      validateData: options.validateData !== false, // Default to true
      batchSize: options.batchSize || 50,
      dryRun: options.dryRun || false
    };

    await migration.runMigration(migrationOptions);

    // Generate final statistics
    const stats = await migration.generateStatistics();

    const response = createApiResponse(
      true,
      options.dryRun ? 'Directory seeding validation completed (dry run)' : 'Directory database seeded successfully',
      {
        action: 'seed',
        timestamp: new Date().toISOString(),
        options: migrationOptions
      },
      null,
      stats
    );

    logger.info('Directory seeding completed successfully', { metadata: { stats } });
    return res.status(200).json(response);

  } catch (error) {
    logger.error('Directory seeding failed', {}, error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(
      createApiResponse(
        false,
        'Directory database seeding failed',
        null,
        [error instanceof Error ? error.message : 'Seeding error']
      )
    );
  }
}

async function handleStats(migration: DirectoryMigration, res: NextApiResponse<SeedResponse>) {
  try {
    logger.info('Generating directory statistics...');

    const stats = await migration.generateStatistics();

    const response = createApiResponse(
      true,
      'Directory statistics generated successfully',
      {
        action: 'stats',
        timestamp: new Date().toISOString()
      },
      null,
      stats
    );

    logger.info('Directory statistics generated', { metadata: { stats } });
    return res.status(200).json(response);

  } catch (error) {
    logger.error('Failed to generate directory statistics', {}, error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(
      createApiResponse(
        false,
        'Failed to generate directory statistics',
        null,
        [error instanceof Error ? error.message : 'Statistics error']
      )
    );
  }
}

async function handleReset(
  migration: DirectoryMigration, 
  options: any, 
  res: NextApiResponse<SeedResponse>
) {
  try {
    logger.info('Starting directory database reset...', { metadata: { options } });

    const migrationOptions = {
      dropExisting: true, // Always drop for reset
      validateData: options.validateData !== false,
      batchSize: options.batchSize || 50,
      dryRun: options.dryRun || false
    };

    await migration.runMigration(migrationOptions);

    const stats = await migration.generateStatistics();

    const response = createApiResponse(
      true,
      options.dryRun ? 'Directory reset validation completed (dry run)' : 'Directory database reset and reseeded successfully',
      {
        action: 'reset',
        timestamp: new Date().toISOString(),
        options: migrationOptions
      },
      null,
      stats
    );

    logger.info('Directory reset completed successfully', { metadata: { stats } });
    return res.status(200).json(response);

  } catch (error) {
    logger.error('Directory reset failed', {}, error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(
      createApiResponse(
        false,
        'Directory database reset failed',
        null,
        [error instanceof Error ? error.message : 'Reset error']
      )
    );
  }
}

function isAuthorized(adminKey: string | undefined, req: NextApiRequest): boolean {
  // Check admin key from body
  if (adminKey && adminKey === process.env.ADMIN_SEED_KEY) {
    return true;
  }

  // Check authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === process.env.ADMIN_SEED_KEY) {
      return true;
    }
  }

  // Check for development environment
  if (process.env.NODE_ENV === 'development' && !process.env.ADMIN_SEED_KEY) {
    return true;
  }

  return false;
}

// Export for testing
export { isAuthorized };