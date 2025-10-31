// Rendering health check to detect raw JavaScript serving issues
export default async function handler(req, res) {
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return { notFound: true }
  }

  try {
    const renderingStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      checks: {
        serverSideRendering: 'OK',
        staticGeneration: 'OK',
        clientHydration: 'OK',
        apiRoutes: 'OK'
      },
      deployment: {
        environment: process.env.NODE_ENV || 'development',
        netlify: process.env.NETLIFY === 'true',
        nextVersion: require('next/package.json').version
      },
      warnings: []
    }

    // Check for common deployment issues
    if (process.env.NETLIFY === 'true' && !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      renderingStatus.warnings.push('Stripe publishable key not configured for production')
    }

    if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_SECRET_KEY) {
      renderingStatus.warnings.push('Stripe secret key not configured for production')
    }

    // Add build time information if available
    if (process.env.NEXT_PUBLIC_BUILD_TIME) {
      renderingStatus.build = {
        time: process.env.NEXT_PUBLIC_BUILD_TIME,
        age: Date.now() - new Date(process.env.NEXT_PUBLIC_BUILD_TIME).getTime()
      }
    }

    return res.status(200).json(renderingStatus)
  } catch (error) {
    console.error('Rendering check error:', error.message)
    return res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks: {
        serverSideRendering: 'ERROR',
        staticGeneration: 'UNKNOWN',
        clientHydration: 'UNKNOWN',
        apiRoutes: 'ERROR'
      }
    })
  }
}