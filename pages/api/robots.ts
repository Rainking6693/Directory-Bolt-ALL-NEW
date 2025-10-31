import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set cache headers
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.setHeader('Content-Type', 'text/plain')

  const robots = `# DirectoryBolt Robots.txt
User-agent: *
Allow: /

# Disallow admin and private areas
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/private/
Disallow: /test-*
Disallow: /staff-dashboard*
Disallow: /emergency-diagnostics*
Disallow: /_next/
Disallow: /static/

# Allow important bots with crawl delay
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 1

# Sitemaps
Sitemap: https://directorybolt.com/sitemap.xml
Sitemap: https://directorybolt.com/sitemap-blog.xml
Sitemap: https://directorybolt.com/sitemap-cities.xml
Sitemap: https://directorybolt.com/sitemap-guides.xml

# Host
Host: https://directorybolt.com`

  res.status(200).send(robots)
}