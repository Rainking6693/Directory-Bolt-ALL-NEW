import React from 'react'
import Head from 'next/head'
import Layout from '../components/layout/Layout'
import Link from 'next/link'

export default function CustomerPortalPage() {
  return (
    <Layout>
      <Head>
        <title>Customer Portal - DirectoryBolt</title>
        <meta name="description" content="Access your DirectoryBolt customer dashboard" />
      </Head>
      
      <div className="min-h-screen bg-secondary-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              DirectoryBolt Customer Portal
            </h1>
            <p className="text-xl text-secondary-300">
              Track your directory submissions and business growth
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-secondary-800 rounded-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">📊</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Dashboard Access</h2>
                <p className="text-secondary-300 mb-6">
                  View your submission progress, track directory listings, and monitor your business growth in real-time.
                </p>
                <Link 
                  href="/customer-login"
                  className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Access Dashboard
                </Link>
              </div>
            </div>

            <div className="bg-secondary-800 rounded-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">🚀</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Quick Access</h2>
                <p className="text-secondary-300 mb-6">
                  Already have an account? Use your email to quickly access your dashboard without a password.
                </p>
                <Link 
                  href="/customer-login"
                  className="inline-block bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Quick Access
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-secondary-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">What You Can Do</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg">📈</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Track Progress</h3>
                <p className="text-secondary-300 text-sm">
                  Monitor your directory submissions in real-time with live updates
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg">📋</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">View Results</h3>
                <p className="text-secondary-300 text-sm">
                  See which directories approved your listing and track success rates
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg">⚡</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Real-time Updates</h3>
                <p className="text-secondary-300 text-sm">
                  Get instant notifications when your submissions are processed
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-secondary-300 mb-4">
              Need help accessing your account?
            </p>
            <a 
              href="mailto:support@directorybolt.com"
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
