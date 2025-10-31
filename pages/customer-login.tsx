import React, { useState } from 'react'
import Head from 'next/head'
import Layout from '../components/layout/Layout'
import { useRouter } from 'next/router'

export default function CustomerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/customer/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        // Store customer ID and redirect to dashboard
        localStorage.setItem('customerId', data.customerId)
        localStorage.setItem('customerEmail', email)
        router.push(`/dashboard?customerId=${data.customerId}`)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAccess = async () => {
    setLoading(true)
    setError('')

    try {
      // For demo purposes, allow quick access with email only
      const response = await fetch('/api/customer/quick-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('customerId', data.customerId)
        localStorage.setItem('customerEmail', email)
        router.push(`/dashboard?customerId=${data.customerId}`)
      } else {
        setError(data.error || 'Quick access failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
      console.error('Quick access error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <Head>
        <title>Customer Login - DirectoryBolt</title>
        <meta name="description" content="Access your DirectoryBolt dashboard" />
      </Head>
      
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Customer Portal
            </h2>
            <p className="mt-2 text-center text-sm text-secondary-300">
              Access your directory submission dashboard
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-200">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-secondary-600 placeholder-secondary-400 text-white bg-secondary-800 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-200">
                  Password (Optional)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-secondary-600 placeholder-secondary-400 text-white bg-secondary-800 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder="Enter password (optional)"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              
              <button
                type="button"
                onClick={handleQuickAccess}
                disabled={loading || !email}
                className="group relative w-full flex justify-center py-2 px-4 border border-secondary-600 text-sm font-medium rounded-md text-secondary-300 bg-secondary-800 hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Accessing...' : 'Quick Access (Email Only)'}
              </button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-sm text-secondary-400">
              Need help? Contact support at{' '}
              <a href="mailto:support@directorybolt.com" className="text-primary-400 hover:text-primary-300">
                support@directorybolt.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
