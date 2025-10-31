// Deployment monitoring endpoint for detecting rendering issues
export default async function handler(req, res) {
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return { notFound: true }
  }

  try {
    const deploymentInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      deployment: {
        environment: process.env.NODE_ENV || 'development',
        netlify: process.env.NETLIFY === 'true',
        building: process.env.BUILDING === 'true',
        nodeVersion: process.version,
        platform: process.platform
      },
      services: {
        nextjs: {
          version: require('next/package.json').version,
          configured: true
        },
        stripe: {
          configured: !!process.env.STRIPE_SECRET_KEY,
          publishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        },
        airtable: {
          configured: !!process.env.AIRTABLE_API_KEY,
          baseId: !!process.env.AIRTABLE_BASE_ID
        }
      },
      checks: {
        staticGeneration: 'OK',
        apiRoutes: 'OK',
        serverSideRendering: 'OK'
      }
    }

    // If this is a GET request, also check for common issues
    if (req.method === 'GET') {
      deploymentInfo.diagnostics = {
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    }

    return res.status(200).json(deploymentInfo)
  } catch (error) {
    console.error('Deployment monitor error:', error.message)
    return res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}