/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://directorybolt.com',
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  exclude: [
    '/admin',
    '/admin/*',
    '/admin-dashboard',
    '/admin-login',
    '/staff',
    '/staff/*',
    '/staff-dashboard',
    '/staff-login',
    '/customer-portal',
    '/customer-login',
    '/api/*',
    '/server-sitemap.xml',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/staff',
          '/staff/*',
          '/customer-portal',
          '/customer-login',
          '/api/*',
        ],
      },
    ],
    additionalSitemaps: [
      'https://directorybolt.com/sitemap-blog.xml',
      'https://directorybolt.com/sitemap-cities.xml',
      'https://directorybolt.com/sitemap-guides.xml',
    ],
  },
  transform: async (config, path) => {
    // Custom priority and changefreq based on path
    let priority = 0.7
    let changefreq = 'weekly'

    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    } else if (path.startsWith('/guides')) {
      priority = 0.8
      changefreq = 'weekly'
    } else if (path.startsWith('/pricing')) {
      priority = 0.9
      changefreq = 'monthly'
    } else if (path.startsWith('/dashboard')) {
      priority = 0.6
      changefreq = 'daily'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }
  },
}

