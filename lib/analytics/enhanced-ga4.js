// Enhanced Google Analytics 4 Configuration for DirectoryBolt
export const enhancedGA4Config = {
  // Core Web Vitals tracking
  trackCoreWebVitals: () => {
    if (typeof window === 'undefined' || !window.gtag) return

    // Track Core Web Vitals
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const metricName = entry.name
        const metricValue = Math.round(entry.value)
        const metricId = entry.id || 'unknown'
        
        window.gtag('event', 'web_vitals', {
          metric_name: metricName,
          metric_value: metricValue,
          metric_id: metricId,
          event_category: 'performance',
          custom_parameter_1: entry.rating || 'unknown'
        })
        
        console.log(`Core Web Vital: ${metricName} = ${metricValue}`)
      }
    }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'cumulative-layout-shift'] })

    // Track additional performance metrics
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0]
      if (navigation) {
        window.gtag('event', 'page_load_time', {
          value: Math.round(navigation.loadEventEnd - navigation.fetchStart),
          event_category: 'performance'
        })
        
        window.gtag('event', 'dom_content_loaded', {
          value: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
          event_category: 'performance'
        })
      }
    })
  },

  // Enhanced ecommerce tracking
  trackPurchase: (transactionData) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'purchase', {
      transaction_id: transactionData.id,
      value: transactionData.value,
      currency: 'USD',
      items: transactionData.items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      })),
      // Custom parameters
      plan_type: transactionData.planType,
      directory_count: transactionData.directoryCount,
      customer_type: transactionData.customerType
    })
  },

  // Track directory submission events
  trackDirectorySubmission: (directoryName, plan, status = 'started') => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'directory_submission', {
      directory_name: directoryName,
      plan_type: plan,
      submission_status: status,
      event_category: 'engagement',
      value: status === 'completed' ? 1 : 0
    })
  },

  // Track content engagement
  trackContentEngagement: (contentType, contentTitle, engagementType, value = 1) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'content_engagement', {
      content_type: contentType,
      content_title: contentTitle,
      engagement_type: engagementType,
      value: value,
      event_category: 'content'
    })
  },

  // Track search functionality
  trackSearch: (searchTerm, searchType = 'site_search', resultsCount = 0) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'search', {
      search_term: searchTerm,
      search_type: searchType,
      results_count: resultsCount,
      event_category: 'search'
    })
  },

  // Track form interactions
  trackFormInteraction: (formName, action, fieldName = null) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'form_interaction', {
      form_name: formName,
      form_action: action,
      field_name: fieldName,
      event_category: 'forms'
    })
  },

  // Track pricing page interactions
  trackPricingInteraction: (planName, action, value = null) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'pricing_interaction', {
      plan_name: planName,
      pricing_action: action,
      value: value,
      event_category: 'pricing'
    })
  },

  // Track user journey milestones
  trackUserJourney: (milestone, additionalData = {}) => {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'user_journey', {
      milestone: milestone,
      event_category: 'user_flow',
      ...additionalData
    })
  },

  // Track scroll depth
  trackScrollDepth: () => {
    if (typeof window === 'undefined' || !window.gtag) return

    let maxScroll = 0
    const milestones = [25, 50, 75, 90, 100]
    const tracked = new Set()

    const trackScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      
      maxScroll = Math.max(maxScroll, scrollPercent)
      
      milestones.forEach(milestone => {
        if (scrollPercent >= milestone && !tracked.has(milestone)) {
          tracked.add(milestone)
          window.gtag('event', 'scroll_depth', {
            scroll_percentage: milestone,
            event_category: 'engagement'
          })
        }
      })
    }

    window.addEventListener('scroll', trackScroll, { passive: true })
    window.addEventListener('beforeunload', () => {
      if (maxScroll > 0) {
        window.gtag('event', 'max_scroll_depth', {
          scroll_percentage: maxScroll,
          event_category: 'engagement'
        })
      }
    })
  },

  // Track time on page
  trackTimeOnPage: () => {
    if (typeof window === 'undefined' || !window.gtag) return

    const startTime = Date.now()
    const intervals = [30, 60, 120, 300, 600] // seconds
    const tracked = new Set()

    const checkTimeOnPage = () => {
      const timeOnPage = Math.round((Date.now() - startTime) / 1000)
      
      intervals.forEach(interval => {
        if (timeOnPage >= interval && !tracked.has(interval)) {
          tracked.add(interval)
          window.gtag('event', 'time_on_page', {
            time_threshold: interval,
            event_category: 'engagement'
          })
        }
      })
    }

    const intervalId = setInterval(checkTimeOnPage, 10000) // Check every 10 seconds
    
    window.addEventListener('beforeunload', () => {
      clearInterval(intervalId)
      const totalTime = Math.round((Date.now() - startTime) / 1000)
      window.gtag('event', 'session_duration', {
        duration_seconds: totalTime,
        event_category: 'engagement'
      })
    })
  },

  // Track external link clicks
  trackExternalLinks: () => {
    if (typeof window === 'undefined' || !window.gtag) return

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a')
      if (!link) return

      const href = link.href
      if (href && !href.includes(window.location.hostname)) {
        window.gtag('event', 'external_link_click', {
          link_url: href,
          link_text: link.textContent?.trim() || 'Unknown',
          event_category: 'outbound_links'
        })
      }
    })
  },

  // Track file downloads
  trackDownloads: () => {
    if (typeof window === 'undefined' || !window.gtag) return

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a')
      if (!link) return

      const href = link.href
      const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.csv']
      
      if (href && downloadExtensions.some(ext => href.toLowerCase().includes(ext))) {
        window.gtag('event', 'file_download', {
          file_url: href,
          file_name: href.split('/').pop() || 'Unknown',
          event_category: 'downloads'
        })
      }
    })
  },

  // Initialize all tracking
  initializeTracking: () => {
    if (typeof window === 'undefined') return

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        enhancedGA4Config.setupAllTracking()
      })
    } else {
      enhancedGA4Config.setupAllTracking()
    }
  },

  setupAllTracking: () => {
    try {
      enhancedGA4Config.trackCoreWebVitals()
      enhancedGA4Config.trackScrollDepth()
      enhancedGA4Config.trackTimeOnPage()
      enhancedGA4Config.trackExternalLinks()
      enhancedGA4Config.trackDownloads()
      
      console.log('Enhanced GA4 tracking initialized')
    } catch (error) {
      console.error('Error initializing GA4 tracking:', error)
    }
  }
}

// Custom dimensions and metrics configuration
export const customDimensions = {
  USER_TYPE: 'custom_dimension_1',
  PLAN_TYPE: 'custom_dimension_2',
  TRAFFIC_SOURCE: 'custom_dimension_3',
  DEVICE_TYPE: 'custom_dimension_4',
  GEOGRAPHIC_REGION: 'custom_dimension_5'
}

export const customMetrics = {
  DIRECTORY_SUBMISSIONS: 'custom_metric_1',
  APPROVAL_RATE: 'custom_metric_2',
  TIME_TO_CONVERSION: 'custom_metric_3',
  CONTENT_ENGAGEMENT_SCORE: 'custom_metric_4'
}

// Utility function to set custom dimensions
export const setCustomDimension = (dimension, value) => {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
    [dimension]: value
  })
}

// Enhanced conversion tracking
export const trackConversion = (conversionType, value = null, additionalData = {}) => {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'conversion', {
    conversion_type: conversionType,
    value: value,
    currency: 'USD',
    event_category: 'conversions',
    ...additionalData
  })
}

// A/B testing support
export const trackExperiment = (experimentId, variantId) => {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', 'experiment_impression', {
    experiment_id: experimentId,
    variant_id: variantId,
    event_category: 'experiments'
  })
}