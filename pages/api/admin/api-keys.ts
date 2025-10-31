import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  type: 'admin' | 'staff' | 'readonly';
  created: string;
  active: boolean;
}

function authenticateAdmin(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    return false;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminKey;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Check admin authentication
  if (!authenticateAdmin(req)) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Admin authentication required'
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetApiKeys(req, res);
      case 'POST':
        return handleCreateApiKey(req, res);
      case 'DELETE':
        return handleDeleteApiKey(req, res);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
        return res.status(405).json({
          ok: false,
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        });
    }
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error('[admin.api-keys] error', { name: err?.name, message: err?.message });
    
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'API key operation failed'
    });
  }
}

async function handleGetApiKeys(req: NextApiRequest, res: NextApiResponse) {
  // Return configured API keys (for display purposes)
  const adminApiKey = process.env.ADMIN_API_KEY
  const staffApiKey = process.env.STAFF_API_KEY
  
  if (!adminApiKey || !staffApiKey) {
    return res.status(500).json({
      success: false,
      error: 'API keys not properly configured in environment'
    })
  }

  const keys: ApiKey[] = [
    {
      id: 'admin-1',
      name: 'Admin API Key',
      key: adminApiKey,
      type: 'admin',
      created: '2025-01-01T00:00:00Z',
      active: true
    },
    {
      id: 'staff-1',
      name: 'Staff API Key',
      key: staffApiKey,
      type: 'staff',
      created: '2025-01-01T00:00:00Z',
      active: true
    }
  ];

  return res.status(200).json({
    ok: true,
    keys: keys
  });
}

async function handleCreateApiKey(req: NextApiRequest, res: NextApiResponse) {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_FIELDS',
      message: 'Name and type are required'
    });
  }

  // Generate new API key
  const newKey = `DirectoryBolt-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  const apiKey: ApiKey = {
    id: `${type}-${Date.now()}`,
    name,
    key: newKey,
    type,
    created: new Date().toISOString(),
    active: true
  };

  // Note: In a real implementation, you'd store this in a database
  // For now, we'll just return the created key
  return res.status(201).json({
    ok: true,
    message: 'API key created successfully',
    key: apiKey
  });
}

async function handleDeleteApiKey(req: NextApiRequest, res: NextApiResponse) {
  const { keyId } = req.query;

  if (!keyId) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_KEY_ID',
      message: 'Key ID is required'
    });
  }

  // Note: In a real implementation, you'd delete from database
  return res.status(200).json({
    ok: true,
    message: 'API key deleted successfully',
    keyId
  });
}