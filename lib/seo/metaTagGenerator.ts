import { DirectoryGuideData } from '../guides/contentManager'

export interface SEOMetaTags {
  title: string
  description: string
  keywords: string
  canonical: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogUrl: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  jsonLd: any
}

export class MetaTagGenerator {
  private baseUrl = 'https://directorybolt.com'

  generateGuideMetaTags(guide: DirectoryGuideData): SEOMetaTags {
    const url = `${this.baseUrl}/guides/${guide.slug}`
    
    return {
      title: guide.seo.title,
      description: guide.seo.description,
      keywords: guide.seo.keywords.join(', '),
      canonical: url,
      ogTitle: guide.seo.title,
      ogDescription: guide.seo.description,
      ogImage: guide.featuredImage || `${this.baseUrl}/images/default-guide-og.jpg`,
      ogUrl: url,
      twitterTitle: guide.seo.title,
      twitterDescription: guide.seo.description,
      twitterImage: guide.featuredImage || `${this.baseUrl}/images/default-guide-twitter.jpg`,
      jsonLd: this.generateGuideStructuredData(guide)
    }
  }

  generateGuidesListingMetaTags(category?: string): SEOMetaTags {
    const title = category 
      ? `${category} Directory Submission Guides | DirectoryBolt`
      : 'Directory Submission Guides | DirectoryBolt'
    
    const description = category
      ? `Expert ${category.toLowerCase()} guides for directory submissions. Learn proven strategies and best practices.`
      : 'Comprehensive directory submission guides. Master local SEO, Google My Business, Yelp, and 500+ other directories.'
    
    const url = category 
      ? `${this.baseUrl}/guides?category=${encodeURIComponent(category)}`
      : `${this.baseUrl}/guides`

    return {
      title,
      description,
      keywords: 'directory submission guides, local SEO, business listings, online presence',
      canonical: url,
      ogTitle: title,
      ogDescription: description,
      ogImage: `${this.baseUrl}/images/guides-og.jpg`,
      ogUrl: url,
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: `${this.baseUrl}/images/guides-twitter.jpg`,
      jsonLd: this.generateGuidesListingStructuredData(category)
    }
  }

  generateHomePageMetaTags(): SEOMetaTags {
    return {
      title: 'DirectoryBolt | AI-Powered Directory Submission Service',
      description: 'Get your business listed on 500+ premium directories with our AI-powered submission service. Boost local SEO, increase visibility, and attract more customers.',
      keywords: 'directory submission service, local SEO, business listings, online presence, Google My Business, Yelp',
      canonical: this.baseUrl,
      ogTitle: 'DirectoryBolt | AI-Powered Directory Submission Service',
      ogDescription: 'Get your business listed on 500+ premium directories with our AI-powered submission service.',
      ogImage: `${this.baseUrl}/images/home-og.jpg`,
      ogUrl: this.baseUrl,
      twitterTitle: 'DirectoryBolt | AI-Powered Directory Submission Service',
      twitterDescription: 'Get your business listed on 500+ premium directories with our AI-powered submission service.',
      twitterImage: `${this.baseUrl}/images/home-twitter.jpg`,
      jsonLd: this.generateOrganizationStructuredData()
    }
  }

  private generateGuideStructuredData(guide: DirectoryGuideData): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: guide.title,
      description: guide.description,
      image: {
        '@type': 'ImageObject',
        url: guide.featuredImage,
        width: 1200,
        height: 630
      },
      totalTime: guide.estimatedReadTime,
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: '0'
      },
      supply: guide.content.requirements?.map(req => ({
        '@type': 'HowToSupply',
        name: req
      })) || [],
      tool: guide.content.tools?.map(tool => ({
        '@type': 'HowToTool',
        name: tool
      })) || [],
      step: guide.content.sections.map((section, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: section.title,
        text: this.stripHtml(section.content),
        image: section.image ? {
          '@type': 'ImageObject',
          url: section.image,
          width: 800,
          height: 450
        } : undefined
      })),
      author: {
        '@type': 'Organization',
        name: 'DirectoryBolt',
        url: this.baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${this.baseUrl}/images/logo.png`,
          width: 200,
          height: 60
        }
      },
      publisher: {
        '@type': 'Organization',
        name: 'DirectoryBolt',
        logo: {
          '@type': 'ImageObject',
          url: `${this.baseUrl}/images/logo.png`,
          width: 200,
          height: 60
        }
      },
      datePublished: guide.publishedAt,
      dateModified: guide.updatedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${this.baseUrl}/guides/${guide.slug}`
      }
    }
  }

  private generateGuidesListingStructuredData(category?: string): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category ? `${category} Directory Guides` : 'Directory Submission Guides',
      description: category 
        ? `Comprehensive ${category.toLowerCase()} guides for directory submissions`
        : 'Complete collection of directory submission guides and tutorials',
      url: category 
        ? `${this.baseUrl}/guides?category=${encodeURIComponent(category)}`
        : `${this.baseUrl}/guides`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: this.baseUrl
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Guides',
            item: `${this.baseUrl}/guides`
          }
        ].concat(category ? [{
          '@type': 'ListItem',
          position: 3,
          name: category,
          item: `${this.baseUrl}/guides?category=${encodeURIComponent(category)}`
        }] : [])
      },
      mainEntity: {
        '@type': 'ItemList',
        name: 'Directory Submission Guides'
      }
    }
  }

  private generateOrganizationStructuredData(): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'DirectoryBolt',
      url: this.baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${this.baseUrl}/images/logo.png`,
        width: 200,
        height: 60
      },
      description: 'AI-powered directory submission service helping businesses improve their online presence',
      foundingDate: '2024',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        email: 'support@directorybolt.com'
      },
      sameAs: [
        'https://twitter.com/directorybolt',
        'https://linkedin.com/company/directorybolt'
      ],
      offers: {
        '@type': 'Offer',
        description: 'Directory submission services for businesses',
        category: 'Digital Marketing Services'
      }
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
  }

  // Generate meta tags for API routes
  generateAPIDocumentationMeta(): SEOMetaTags {
    return {
      title: 'DirectoryBolt API Documentation',
      description: 'Complete API documentation for DirectoryBolt directory submission services.',
      keywords: 'API documentation, directory submission API, business listings API',
      canonical: `${this.baseUrl}/docs/api`,
      ogTitle: 'DirectoryBolt API Documentation',
      ogDescription: 'Complete API documentation for DirectoryBolt directory submission services.',
      ogImage: `${this.baseUrl}/images/api-docs-og.jpg`,
      ogUrl: `${this.baseUrl}/docs/api`,
      twitterTitle: 'DirectoryBolt API Documentation',
      twitterDescription: 'Complete API documentation for DirectoryBolt directory submission services.',
      twitterImage: `${this.baseUrl}/images/api-docs-twitter.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        name: 'DirectoryBolt API Documentation',
        description: 'Complete API documentation for DirectoryBolt directory submission services.'
      }
    }
  }
}