import { DirectoryGuideData } from '../guides/contentManager'

export interface PerformanceMetrics {
  loadTime: number
  cumulativeLayoutShift: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  timeToInteractive: number
}

export class PerformanceOptimizer {
  
  // Optimize guide content for faster loading
  optimizeGuideContent(guide: DirectoryGuideData): DirectoryGuideData {
    const optimized = { ...guide }
    
    // Compress and optimize content sections
    optimized.content.sections = guide.content.sections.map(section => ({
      ...section,
      content: this.optimizeHTML(section.content)
    }))
    
    // Add lazy loading hints for images
    optimized.featuredImage = this.addLazyLoadingHints(guide.featuredImage)
    
    return optimized
  }

  // Optimize HTML content for performance
  private optimizeHTML(html: string): string {
    return html
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Add loading="lazy" to images
      .replace(/<img([^>]*)>/g, '<img$1 loading="lazy">')
      // Add rel="noopener" to external links
      .replace(/<a([^>]*href="https?:\/\/(?!directorybolt\.com)[^"]*"[^>]*)>/g, '<a$1 rel="noopener noreferrer" target="_blank">')
  }

  private addLazyLoadingHints(imageUrl: string): string {
    // In a real implementation, you might generate different image sizes
    return imageUrl
  }

  // Generate critical CSS for above-the-fold content
  generateCriticalCSS(guideType: string): string {
    const baseCriticalCSS = `
      /* Critical CSS for guides */
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .progress-tracker { position: fixed; top: 0; left: 0; right: 0; z-index: 50; }
      .breadcrumbs { background: rgba(30, 41, 59, 0.3); backdrop-filter: blur(12px); }
      .guide-header { padding: 2rem 0; }
      .guide-title { font-size: 2rem; font-weight: bold; color: white; line-height: 1.2; }
      .guide-description { font-size: 1.25rem; color: rgb(203, 213, 225); margin: 1rem 0; }
      .guide-meta { display: flex; gap: 1rem; align-items: center; color: rgb(148, 163, 184); }
    `
    
    // Add specific CSS based on guide type
    switch (guideType) {
      case 'Local Search':
        return baseCriticalCSS + `
          .local-seo-badge { background: rgba(34, 197, 94, 0.2); color: rgb(34, 197, 94); }
        `
      case 'Review Platforms':
        return baseCriticalCSS + `
          .review-badge { background: rgba(59, 130, 246, 0.2); color: rgb(59, 130, 246); }
        `
      default:
        return baseCriticalCSS
    }
  }

  // Preload critical resources
  generatePreloadTags(guide: DirectoryGuideData): Array<{ rel: string; href: string; as?: string; type?: string }> {
    const preloadTags = []
    
    // Preload featured image
    if (guide.featuredImage) {
      preloadTags.push({
        rel: 'preload',
        href: guide.featuredImage,
        as: 'image'
      })
    }
    
    // Preload first section image
    if (guide.content.sections[0]?.image) {
      preloadTags.push({
        rel: 'preload',
        href: guide.content.sections[0].image,
        as: 'image'
      })
    }
    
    // Preload critical fonts
    preloadTags.push({
      rel: 'preload',
      href: '/fonts/inter-var.woff2',
      as: 'font',
      type: 'font/woff2'
    })
    
    return preloadTags
  }

  // Generate resource hints for better performance
  generateResourceHints(): Array<{ rel: string; href: string; crossOrigin?: string }> {
    return [
      // DNS prefetch for external domains
      { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
      { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
      { rel: 'dns-prefetch', href: '//www.google-analytics.com' },
      
      // Preconnect to critical domains
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }
    ]
  }

  // Calculate and optimize bundle sizes
  analyzeBundleSize(guides: DirectoryGuideData[]): {
    totalGuides: number
    averageContentSize: number
    largestGuides: Array<{ slug: string; size: number }>
    recommendations: string[]
  } {
    const guideSizes = guides.map(guide => ({
      slug: guide.slug,
      size: JSON.stringify(guide).length
    }))
    
    const totalSize = guideSizes.reduce((sum, g) => sum + g.size, 0)
    const averageSize = totalSize / guides.length
    
    const largestGuides = guideSizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
    
    const recommendations = []
    
    if (averageSize > 50000) {
      recommendations.push('Consider splitting large guides into multiple pages')
    }
    
    if (largestGuides[0]?.size > 100000) {
      recommendations.push('Optimize content for the largest guides')
    }
    
    const hasLargeImages = guides.some(guide => 
      guide.content.sections.some(section => section.image)
    )
    
    if (hasLargeImages) {
      recommendations.push('Implement progressive image loading')
    }
    
    return {
      totalGuides: guides.length,
      averageContentSize: Math.round(averageSize),
      largestGuides,
      recommendations
    }
  }

  // Generate service worker cache strategy
  generateCacheStrategy(guides: DirectoryGuideData[]): {
    cacheFirst: string[]
    networkFirst: string[]
    staleWhileRevalidate: string[]
  } {
    return {
      cacheFirst: [
        '/images/',
        '/fonts/',
        '/_next/static/',
        '.woff2',
        '.woff',
        '.jpg',
        '.jpeg',
        '.png',
        '.webp'
      ],
      networkFirst: [
        '/api/',
        '/guides/*/comments',
        '/analytics/'
      ],
      staleWhileRevalidate: [
        '/guides/',
        '/',
        '/pricing',
        '/analyze'
      ]
    }
  }

  // Monitor Core Web Vitals
  generateWebVitalsScript(): string {
    return `
      // Core Web Vitals monitoring
      import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

      function sendToAnalytics(metric) {
        // Send to your analytics service
        if (window.gtag) {
          window.gtag('event', metric.name, {
            event_category: 'Web Vitals',
            value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            event_label: metric.id,
            non_interaction: true,
            custom_map: {
              'guide_slug': window.location.pathname.split('/').pop()
            }
          });
        }
      }

      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getFCP(sendToAnalytics);
      getLCP(sendToAnalytics);
      getTTFB(sendToAnalytics);
    `
  }

  // Optimize images for different screen sizes
  generateResponsiveImages(imageUrl: string): {
    srcSet: string
    sizes: string
    placeholder: string
  } {
    // In a real implementation, you would generate multiple sizes
    const baseUrl = imageUrl.split('.').slice(0, -1).join('.')
    const extension = imageUrl.split('.').pop()
    
    return {
      srcSet: `
        ${baseUrl}-400w.${extension} 400w,
        ${baseUrl}-800w.${extension} 800w,
        ${baseUrl}-1200w.${extension} 1200w
      `,
      sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
      placeholder: `${baseUrl}-placeholder.${extension}`
    }
  }
}

// Utility function to measure performance
export function measurePagePerformance(): Promise<PerformanceMetrics> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({
        loadTime: 0,
        cumulativeLayoutShift: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        timeToInteractive: 0
      })
      return
    }

    // Wait for the page to fully load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paintEntries = performance.getEntriesByType('paint')
        
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
        
        resolve({
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          cumulativeLayoutShift: 0, // Would need to be measured with IntersectionObserver
          firstContentfulPaint: fcp,
          largestContentfulPaint: 0, // Would need LCP API
          timeToInteractive: navigation.domInteractive - (navigation.fetchStart || 0)
        })
      }, 1000)
    })
  })
}