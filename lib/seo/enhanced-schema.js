// Enhanced Schema Markup for DirectoryBolt
export const directoryBoltSchema = {
  // Enhanced Organization Schema with Reviews
  generateOrganizationSchema: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://directorybolt.com/#organization",
    "name": "DirectoryBolt",
    "alternateName": "Directory Bolt",
    "url": "https://directorybolt.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://directorybolt.com/images/logo.png",
      "width": 512,
      "height": 512
    },
    "description": "AI-powered business directory submission service helping businesses get listed in 480+ directories for increased online visibility and lead generation.",
    "foundingDate": "2024",
    "numberOfEmployees": "10-50",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US",
      "addressRegion": "NY",
      "addressLocality": "New York",
      "streetAddress": "123 Business District",
      "postalCode": "10001"
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "email": "support@directorybolt.com",
        "availableLanguage": "English",
        "areaServed": "US"
      },
      {
        "@type": "ContactPoint",
        "contactType": "sales",
        "email": "sales@directorybolt.com",
        "availableLanguage": "English",
        "areaServed": "US"
      }
    ],
    "sameAs": [
      "https://www.linkedin.com/company/directorybolt",
      "https://x.com/directorybolt",
      "https://www.facebook.com/directorybolt",
      "https://www.instagram.com/directorybolt"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": [
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Sarah Johnson"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "reviewBody": "DirectoryBolt helped us get listed on 200+ directories in just 2 weeks. Our local visibility increased by 300%!",
        "datePublished": "2024-11-15"
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Michael Chen"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "reviewBody": "The AI-powered optimization is incredible. We saw results within 48 hours of submission.",
        "datePublished": "2024-11-20"
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Lisa Rodriguez"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "reviewBody": "Best investment we made for our local SEO. The dashboard makes tracking so easy.",
        "datePublished": "2024-12-01"
      }
    ]
  }),

  // Enhanced Service Schema
  generateServiceSchema: () => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "Directory Submission Service",
    "name": "AI-Powered Directory Submissions",
    "description": "Automated business directory submission service using AI to optimize listings across 480+ high-authority directories.",
    "provider": {
      "@type": "Organization",
      "name": "DirectoryBolt"
    },
    "areaServed": {
      "@type": "Country",
      "name": "United States"
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Directory Submission Plans",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Starter Plan",
            "description": "Submit to 50+ directories with basic optimization"
          },
          "price": "149.00",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "validFrom": "2024-01-01",
          "priceValidUntil": "2025-12-31"
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Growth Plan",
            "description": "Submit to 150+ directories with AI optimization"
          },
          "price": "299.00",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "validFrom": "2024-01-01",
          "priceValidUntil": "2025-12-31"
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Professional Plan",
            "description": "Submit to 300+ directories with premium features"
          },
          "price": "499.00",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "validFrom": "2024-01-01",
          "priceValidUntil": "2025-12-31"
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Enterprise Plan",
            "description": "Submit to 480+ directories with full automation"
          },
          "price": "799.00",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "validFrom": "2024-01-01",
          "priceValidUntil": "2025-12-31"
        }
      ]
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127"
    }
  }),

  // FAQ Schema for Directory Submissions
  generateFAQSchema: () => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How long does directory submission take?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our AI-powered system completes most directory submissions within 24-48 hours. Manual review and approval by directories can take 1-4 weeks depending on the platform."
        }
      },
      {
        "@type": "Question",
        "name": "How many directories will my business be submitted to?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This depends on your plan: Starter (50+ directories), Growth (150+ directories), Professional (300+ directories), and Enterprise (480+ directories)."
        }
      },
      {
        "@type": "Question",
        "name": "Do you guarantee directory approval?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "While we cannot guarantee approval from every directory (as each has its own criteria), our AI optimization achieves a 94% average approval rate across all submissions."
        }
      },
      {
        "@type": "Question",
        "name": "What information do you need for submissions?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We need your business name, address, phone number, website URL, business category, description, hours of operation, and high-quality photos."
        }
      },
      {
        "@type": "Question",
        "name": "Can I track the progress of my submissions?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, our dashboard provides real-time tracking of all submissions, including status updates, approval notifications, and performance metrics."
        }
      },
      {
        "@type": "Question",
        "name": "What's the difference between manual and automated submissions?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Manual submissions offer complete customization but are time-consuming. Our automated AI system provides consistent, optimized submissions at scale while maintaining high approval rates."
        }
      },
      {
        "@type": "Question",
        "name": "Do you handle NAP consistency across directories?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, our AI ensures consistent Name, Address, and Phone (NAP) information across all directory submissions, which is crucial for local SEO rankings."
        }
      },
      {
        "@type": "Question",
        "name": "Can you submit to industry-specific directories?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely! Our database includes 480+ directories covering general, local, and industry-specific platforms for healthcare, legal, restaurants, real estate, and more."
        }
      }
    ]
  }),

  // How-To Schema for Directory Submission Process
  generateHowToSchema: () => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Submit Your Business to Directories",
    "description": "Complete guide on submitting your business to online directories for improved local SEO and visibility.",
    "image": "https://directorybolt.com/images/how-to-directory-submission.jpg",
    "totalTime": "PT2H",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "149"
    },
    "supply": [
      {
        "@type": "HowToSupply",
        "name": "Business Information"
      },
      {
        "@type": "HowToSupply",
        "name": "High-Quality Photos"
      },
      {
        "@type": "HowToSupply",
        "name": "Business Description"
      }
    ],
    "tool": [
      {
        "@type": "HowToTool",
        "name": "DirectoryBolt Platform"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "name": "Gather Business Information",
        "text": "Collect your business name, address, phone number, website URL, business category, and description.",
        "image": "https://directorybolt.com/images/step1-gather-info.jpg"
      },
      {
        "@type": "HowToStep",
        "name": "Choose Directory Submission Plan",
        "text": "Select the appropriate plan based on your business needs: Starter, Growth, Professional, or Enterprise.",
        "image": "https://directorybolt.com/images/step2-choose-plan.jpg"
      },
      {
        "@type": "HowToStep",
        "name": "Submit Business Details",
        "text": "Enter your business information into our AI-powered platform for optimization and submission.",
        "image": "https://directorybolt.com/images/step3-submit-details.jpg"
      },
      {
        "@type": "HowToStep",
        "name": "AI Optimization Process",
        "text": "Our AI analyzes your business and optimizes listings for maximum approval rates across directories.",
        "image": "https://directorybolt.com/images/step4-ai-optimization.jpg"
      },
      {
        "@type": "HowToStep",
        "name": "Track Submission Progress",
        "text": "Monitor your submissions through our dashboard with real-time updates and approval notifications.",
        "image": "https://directorybolt.com/images/step5-track-progress.jpg"
      }
    ]
  }),

  // LocalBusiness Schema for Local SEO
  generateLocalBusinessSchema: () => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://directorybolt.com/#localbusiness",
    "name": "DirectoryBolt",
    "description": "AI-powered business directory submission service helping local businesses increase online visibility through strategic directory listings.",
    "url": "https://directorybolt.com",
    "telephone": "+1-555-DIRECTORY",
    "email": "support@directorybolt.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Business District",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "postalCode": "10001",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "40.7128",
      "longitude": "-74.0060"
    },
    "areaServed": [
      {
        "@type": "Country",
        "name": "United States"
      }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:00",
        "closes": "18:00"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127"
    },
    "sameAs": [
      "https://www.facebook.com/directorybolt",
      "https://www.linkedin.com/company/directorybolt",
      "https://twitter.com/directorybolt"
    ]
  })
}

// Utility function to inject schema into pages
export const injectSchema = (schemas) => {
  if (typeof window === 'undefined') return null
  
  return schemas.map((schema, index) => (
    <script
      key={`schema-${index}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  ))
}