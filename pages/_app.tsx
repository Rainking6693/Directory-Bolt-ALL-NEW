import type { AppProps, NextWebVitalsMetric } from 'next/app'
import Head from 'next/head'
import Script from 'next/script'
import { useEffect } from 'react'
import '../styles/globals.css'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { NotificationProvider } from '../components/ui/NotificationSystem'
import { enhancedGA4Config } from '../lib/analytics/enhanced-ga4'
import { inlineCriticalCSS } from '../lib/utils/critical-css'
import CookieConsent from '../components/CookieConsent'

const GA = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const value = metric.name === 'CLS' ? metric.value * 1000 : metric.value
  console.log('[WebVitals]', metric.name, {
    id: metric.id,
    label: metric.label,
    value,
  })
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register service worker for performance
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error)
        })
    }

    // Initialize enhanced analytics
    if (GA) {
      enhancedGA4Config.initializeTracking?.()
    }

    // Inline critical CSS for performance
    inlineCriticalCSS()
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ccff0a" />
        <meta name="msapplication-TileColor" content="#ccff0a" />
        
        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="dns-prefetch" href="//js.stripe.com" />
        
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/hero.svg" as="image" />
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* Prefetch likely next pages */}
        <link rel="prefetch" href="/pricing" />
        <link rel="prefetch" href="/analyze" />
      </Head>
      
      {/* Enhanced GA4 with custom tracking */}
      {GA && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              
              // Set default consent state
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'analytics_storage': 'denied',
                'functionality_storage': 'granted',
                'personalization_storage': 'denied',
                'security_storage': 'granted'
              });
              
              gtag('config', '${GA}', {
                page_path: window.location.pathname,
                custom_map: {
                  'custom_dimension_1': 'user_type',
                  'custom_dimension_2': 'plan_type',
                  'custom_dimension_3': 'traffic_source'
                },
                send_page_view: false, // Will send after consent check
                anonymize_ip: true,
                allow_google_signals: true,
                allow_ad_personalization_signals: false
              });
              
              // Check existing consent and track page view if analytics allowed
              const existingConsent = localStorage.getItem('cookie-consent');
              if (existingConsent) {
                const consent = JSON.parse(existingConsent);
                gtag('consent', 'update', {
                  'analytics_storage': consent.analytics ? 'granted' : 'denied',
                  'ad_storage': consent.marketing ? 'granted' : 'denied'
                });
                
                if (consent.analytics) {
                  gtag('event', 'page_view', {
                    page_title: document.title,
                    page_location: window.location.href,
                    content_group1: 'DirectoryBolt',
                    content_group2: window.location.pathname.split('/')[1] || 'home'
                  });
                }
              }
            `}
          </Script>
        </>
      )}
      
      {/* Structured Data for Organization */}
      <Script id="organization-schema" type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "DirectoryBolt",
            "url": "https://directorybolt.com",
            "logo": "https://directorybolt.com/images/logo.png",
            "description": "AI-powered business directory submission service helping businesses get listed in 480+ directories for increased online visibility.",
            "sameAs": [
              "https://www.linkedin.com/company/directorybolt",
              "https://x.com/directorybolt",
              "https://www.facebook.com/directorybolt"
            ]
          }
        `}
      </Script>
      
      {/* Performance monitoring */}
      <Script id="performance-monitor" strategy="afterInteractive">
        {`
          // Monitor Core Web Vitals
          function sendToAnalytics(metric) {
            if (window.gtag) {
              gtag('event', metric.name, {
                value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
                event_category: 'Web Vitals',
                event_label: metric.id,
                non_interaction: true
              });
            }
          }
          
          // Load web-vitals library
          import('https://unpkg.com/web-vitals@3/dist/web-vitals.js').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
            getCLS(sendToAnalytics);
            getFID(sendToAnalytics);
            getFCP(sendToAnalytics);
            getLCP(sendToAnalytics);
            getTTFB(sendToAnalytics);
          }).catch(console.error);
        `}
      </Script>
      
      <ErrorBoundary>
        <NotificationProvider>
          <Component {...pageProps} />
          <CookieConsent />
        </NotificationProvider>
      </ErrorBoundary>
    </>
  )
}
