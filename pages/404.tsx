import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Header from '../components/Header'

export default function Custom404() {
  const router = useRouter()

  const popularPages = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Pricing', href: '/pricing', icon: '💰' },
    { name: 'Free Analysis', href: '/analyze', icon: '🔍' },
    { name: 'Customer Portal', href: '/customer-portal', icon: '👤' },
    { name: 'Blog', href: '/blog', icon: '📝' },
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  ]

  return (
    <>
      <Head>
        <title>404 - Page Not Found | DirectoryBolt</title>
        <meta name="description" content="The page you're looking for doesn't exist. Return to DirectoryBolt homepage or explore our services." />
        <meta name="robots" content="noindex, follow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          {/* 404 Animation */}
          <div className="mb-8">
            <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-pulse">
              404
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
            Oops! Page Not Found
          </h1>
          <p className="text-xl text-secondary-200 mb-8 max-w-2xl mx-auto">
            The page you're looking for doesn't exist or has been moved. Don't worry, we'll help you find what you need.
          </p>

          {/* Current Path */}
          <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-4 mb-12 max-w-2xl mx-auto">
            <p className="text-secondary-400 text-sm mb-2">You tried to access:</p>
            <code className="text-volt-400 font-mono text-sm break-all">
              {router.asPath}
            </code>
          </div>

          {/* Quick Actions */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Quick Links</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {popularPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="bg-secondary-800/50 backdrop-blur-sm border border-secondary-700 rounded-xl p-6 hover:border-volt-500/50 hover:bg-secondary-800 transition-all duration-300 group"
                >
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                    {page.icon}
                  </div>
                  <div className="text-white font-medium group-hover:text-volt-400 transition-colors">
                    {page.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Search Suggestion */}
          <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 max-w-2xl mx-auto mb-12">
            <h3 className="text-xl font-bold text-white mb-4">Looking for something specific?</h3>
            <p className="text-secondary-200 mb-6">
              Try searching or contact our support team for help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
              >
                Go to Homepage
              </button>
              <a
                href="mailto:support@directorybolt.com"
                className="flex-1 bg-secondary-800 border border-volt-500/30 text-white font-bold px-6 py-3 rounded-xl hover:border-volt-500 transition-all duration-300 text-center"
              >
                Contact Support
              </a>
            </div>
          </div>

          {/* Helpful Resources */}
          <div className="text-secondary-400 text-sm">
            <p className="mb-2">Need help? Check out these resources:</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/blog" className="text-volt-400 hover:text-volt-300">
                Blog
              </Link>
              <span>•</span>
              <Link href="/pricing" className="text-volt-400 hover:text-volt-300">
                Pricing
              </Link>
              <span>•</span>
              <Link href="/privacy" className="text-volt-400 hover:text-volt-300">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="text-volt-400 hover:text-volt-300">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

