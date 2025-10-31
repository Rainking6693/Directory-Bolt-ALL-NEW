import fs from 'fs/promises'
import path from 'path'
import { GuideContentManager } from '../guides/contentManager'

interface SitemapEntry {
  url: string
  lastModified: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export class SitemapGenerator {
  private baseUrl = 'https://directorybolt.com'
  private sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml')
  private guidesSitemapPath = path.join(process.cwd(), 'public', 'sitemap-guides.xml')

  async generateSitemap(): Promise<void> {
    const entries: SitemapEntry[] = []
    
    // Add static pages
    entries.push(...this.getStaticPageEntries())
    
    // Add dynamic guide pages
    const guideEntries = await this.getGuideEntries()
    entries.push(...guideEntries)
    
    // Generate main sitemap
    const mainSitemap = this.generateXML(entries.slice(0, 50000)) // XML sitemap limit
    await fs.writeFile(this.sitemapPath, mainSitemap, 'utf-8')
    
    // Generate guides-specific sitemap
    const guidesSitemap = this.generateXML(guideEntries)
    await fs.writeFile(this.guidesSitemapPath, guidesSitemap, 'utf-8')
    
    // Generate sitemap index if needed
    if (entries.length > 50000) {
      await this.generateSitemapIndex()
    }
  }

  private getStaticPageEntries(): SitemapEntry[] {
    const staticPages = [
      { path: '', priority: 1.0, changeFreq: 'weekly' as const },
      { path: '/analyze', priority: 0.9, changeFreq: 'weekly' as const },
      { path: '/pricing', priority: 0.8, changeFreq: 'monthly' as const },
      { path: '/guides', priority: 0.9, changeFreq: 'daily' as const },
      { path: '/success', priority: 0.3, changeFreq: 'monthly' as const },
      { path: '/cancel', priority: 0.3, changeFreq: 'monthly' as const },
    ]

    return staticPages.map(page => ({
      url: `${this.baseUrl}${page.path}`,
      lastModified: new Date().toISOString().split('T')[0],
      changeFrequency: page.changeFreq,
      priority: page.priority
    }))
  }

  private async getGuideEntries(): Promise<SitemapEntry[]> {
    const contentManager = new GuideContentManager()
    const guides = await contentManager.getAllGuides()
    
    return guides.map(guide => ({
      url: `${this.baseUrl}/guides/${guide.slug}`,
      lastModified: guide.updatedAt.split('T')[0],
      changeFrequency: 'weekly' as const,
      priority: this.calculateGuidePriority(guide)
    }))
  }

  private calculateGuidePriority(guide: any): number {
    let priority = 0.7 // Base priority for guides
    
    // Boost priority for popular guides
    if (guide.viewCount > 1000) priority += 0.1
    if (guide.viewCount > 5000) priority += 0.1
    
    // Boost priority for recently updated guides
    const daysSinceUpdate = (Date.now() - new Date(guide.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUpdate < 30) priority += 0.05
    
    // Boost priority for certain categories
    const highPriorityCategories = ['Local Search', 'SEO', 'Google']
    if (highPriorityCategories.some(cat => guide.category.includes(cat))) {
      priority += 0.05
    }
    
    return Math.min(1.0, priority)
  }

  private generateXML(entries: SitemapEntry[]): string {
    const urls = entries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`
  }

  private async generateSitemapIndex(): Promise<void> {
    const indexPath = path.join(process.cwd(), 'public', 'sitemap-index.xml')
    
    const sitemaps = [
      {
        url: `${this.baseUrl}/sitemap.xml`,
        lastModified: new Date().toISOString().split('T')[0]
      },
      {
        url: `${this.baseUrl}/sitemap-guides.xml`,
        lastModified: new Date().toISOString().split('T')[0]
      }
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemaps.map(sitemap => `
  <sitemap>
    <loc>${sitemap.url}</loc>
    <lastmod>${sitemap.lastModified}</lastmod>
  </sitemap>`).join('')}
</sitemapindex>`

    await fs.writeFile(indexPath, xml, 'utf-8')
  }

  async generateRobotsTxt(): Promise<void> {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt')
    
    const content = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${this.baseUrl}/sitemap.xml
Sitemap: ${this.baseUrl}/sitemap-guides.xml

# Disallow admin and private pages
Disallow: /api/
Disallow: /_next/
Disallow: /admin/
Disallow: /.well-known/

# Allow crawling of guides
Allow: /guides/

# Crawl delay for better server performance
Crawl-delay: 1`

    await fs.writeFile(robotsPath, content, 'utf-8')
  }
}

// Utility function for Next.js build process
export async function generateSitemap(): Promise<void> {
  const generator = new SitemapGenerator()
  await generator.generateSitemap()
  await generator.generateRobotsTxt()
  console.log('✅ Sitemap and robots.txt generated successfully')
}

// Auto-update sitemap when guides are modified
export async function updateSitemapForGuide(guideSlug: string): Promise<void> {
  // In a production environment, you might want to implement incremental updates
  // For now, regenerate the entire sitemap
  await generateSitemap()
}