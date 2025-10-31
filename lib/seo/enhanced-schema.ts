// Enhanced Schema Markup for DirectoryBolt SEO
// Implements comprehensive structured data for better search visibility

export interface SchemaConfig {
  type: 'service' | 'organization' | 'faq' | 'review' | 'breadcrumb'
  data: any
}

export class DirectoryBoltSchema {
  private baseUrl = 'https://directorybolt.com'

  // Organization Schema - Critical for brand recognition
  generateOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'DirectoryBolt',
      description: 'AI-powered directory submission service that automates business listings across 200+ directories with intelligent analysis and optimization.',
      url: this.baseUrl,
      logo: `${this.baseUrl}/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+1-555-DIRECTORY',
        contactType: 'customer service',
        availableLanguage: 'English'
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'US'
      },
      sameAs: [
        'https://twitter.com/directorybolt',
        'https://linkedin.com/company/directorybolt'
      ],
      foundingDate: '2024',
      numberOfEmployees: '10-50',
      industry: 'Digital Marketing Services'
    }
  }

  // Service Schema - Key for directory submission services
  generateServiceSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'AI-Powered Directory Submission Service',
      description: 'Automated business directory submissions with AI analysis, covering 200+ directories including Google Business Profile, Yelp, Yellow Pages, and industry-specific listings.',
      provider: {
        '@type': 'Organization',
        name: 'DirectoryBolt'
      },
      serviceType: 'Directory Submission Service',
      areaServed: {
        '@type': 'Country',
        name: 'United States'
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Directory Submission Packages',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Starter Package - 50 Directories',
              description: 'Professional directory submissions to 50 high-authority directories'
            },
            price: '49.00',
            priceCurrency: 'USD'
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Growth Package - 100 Directories',
              description: 'Comprehensive directory submissions to 100 directories with AI optimization'
            },
            price: '89.00',
            priceCurrency: 'USD'
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Professional Package - 200 Directories',
              description: 'Premium directory submissions to 200+ directories with full AI analysis'
            },
            price: '159.00',
            priceCurrency: 'USD'
          }
        ]
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '127',
        bestRating: '5',
        worstRating: '1'
      }
    }
  }

  // FAQ Schema - Captures long-tail searches
  generateFAQSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How many directories does DirectoryBolt submit to?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'DirectoryBolt submits your business to 200+ high-authority directories including Google Business Profile, Yelp, Yellow Pages, Bing Places, and industry-specific directories relevant to your business.'
          }
        },
        {
          '@type': 'Question',
          name: 'How long does directory submission take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Our AI-powered system completes most directory submissions within 24-48 hours. You\'ll receive a detailed report showing all completed submissions and their status.'
          }
        },
        {
          '@type': 'Question',
          name: 'What information do I need to provide for directory submissions?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You need basic business information: business name, address, phone number, website URL, business category, and a brief description. Our AI analyzes your website to optimize submissions automatically.'
          }
        },
        {
          '@type': 'Question',
          name: 'Do you guarantee directory approval?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'While we cannot guarantee approval from every directory (as each has its own criteria), our AI optimization significantly improves approval rates. We provide detailed reports on all submission attempts and their outcomes.'
          }
        },
        {
          '@type': 'Question',
          name: 'Can DirectoryBolt help with local SEO?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! Directory submissions are a crucial part of local SEO. Our service helps improve your local search rankings by building consistent NAP (Name, Address, Phone) citations across authoritative directories.'
          }
        }
      ]
    }
  }

  // Local Business Schema - Critical for local SEO
  generateLocalBusinessSchema(businessData: any) {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: businessData.name,
      description: businessData.description,
      url: businessData.website,
      telephone: businessData.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: businessData.address,
        addressLocality: businessData.city,
        addressRegion: businessData.state,
        postalCode: businessData.zipCode,
        addressCountry: 'US'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: businessData.latitude,
        longitude: businessData.longitude
      },
      openingHours: businessData.hours || 'Mo-Fr 09:00-17:00',
      priceRange: businessData.priceRange || '$$'
    }
  }

  // Review Schema - Builds trust and authority
  generateReviewSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Review',
      itemReviewed: {
        '@type': 'Service',
        name: 'DirectoryBolt Directory Submission Service'
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: '5',
        bestRating: '5'
      },
      author: {
        '@type': 'Person',
        name: 'Sarah Johnson'
      },
      reviewBody: 'DirectoryBolt saved me hours of manual work. Their AI system submitted my business to over 100 directories automatically, and I saw improved local search rankings within weeks. Highly recommended for any business owner looking to boost their online presence.'
    }
  }

  // Breadcrumb Schema - Improves navigation understanding
  generateBreadcrumbSchema(breadcrumbs: Array<{name: string, url: string}>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url
      }))
    }
  }

  // How-To Schema - Captures instructional searches
  generateHowToSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Submit Your Business to Online Directories',
      description: 'Step-by-step guide to submitting your business to online directories for better local SEO and visibility.',
      totalTime: 'PT30M',
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: '49'
      },
      supply: [
        {
          '@type': 'HowToSupply',
          name: 'Business Information (Name, Address, Phone, Website)'
        },
        {
          '@type': 'HowToSupply',
          name: 'Business Description and Category'
        }
      ],
      tool: [
        {
          '@type': 'HowToTool',
          name: 'DirectoryBolt AI Submission System'
        }
      ],
      step: [
        {
          '@type': 'HowToStep',
          name: 'Gather Business Information',
          text: 'Collect your business name, address, phone number, website URL, and business category.',
          url: `${this.baseUrl}/how-to-submit#step1`
        },
        {
          '@type': 'HowToStep',
          name: 'Choose Submission Package',
          text: 'Select from our Starter (50 directories), Growth (100 directories), or Professional (200+ directories) packages.',
          url: `${this.baseUrl}/how-to-submit#step2`
        },
        {
          '@type': 'HowToStep',
          name: 'AI Analysis and Optimization',
          text: 'Our AI analyzes your website and optimizes your business information for maximum directory approval rates.',
          url: `${this.baseUrl}/how-to-submit#step3`
        },
        {
          '@type': 'HowToStep',
          name: 'Automated Submissions',
          text: 'DirectoryBolt automatically submits your business to selected directories within 24-48 hours.',
          url: `${this.baseUrl}/how-to-submit#step4`
        },
        {
          '@type': 'HowToStep',
          name: 'Receive Detailed Report',
          text: 'Get a comprehensive report showing all submissions, approval status, and recommendations for improvement.',
          url: `${this.baseUrl}/how-to-submit#step5`
        }
      ]
    }
  }
}

export const directoryBoltSchema = new DirectoryBoltSchema()