import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Layout from '../components/layout/Layout'
import RealTimeCustomerDashboard from '../components/dashboard/RealTimeCustomerDashboard'
import { useRouter } from 'next/router'

interface DashboardProps {
  customerId?: string
  isAuthenticated?: boolean
}

export default function DashboardPage({ customerId, isAuthenticated }: DashboardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if customer is authenticated
    const checkAuth = async () => {
      try {
        // Get customer ID from URL params or localStorage
        const urlCustomerId = router.query.customerId as string
        const storedCustomerId = localStorage.getItem('customerId')
        const finalCustomerId = urlCustomerId || storedCustomerId

        if (!finalCustomerId) {
          // Redirect to login if no customer ID
          router.push('/customer-login')
          return
        }

        // Verify customer exists and is authenticated
        const response = await fetch(`/api/customer/validate?customerId=${finalCustomerId}`)
        const data = await response.json()

        if (!data.success) {
          setError('Invalid customer access. Please log in again.')
          router.push('/customer-login')
          return
        }

        setLoading(false)
      } catch (err) {
        setError('Failed to authenticate customer')
        console.error('Auth check failed:', err)
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-secondary-300">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-2">Authentication Error</p>
            <p className="text-secondary-300 text-sm mb-4">{error}</p>
            <button 
              onClick={() => router.push('/customer-login')}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>DirectoryBolt Dashboard</title>
        <meta name="description" content="Track your directory submissions and business growth" />
      </Head>
      
      <div className="min-h-screen bg-secondary-900">
        <RealTimeCustomerDashboard />
      </div>
    </Layout>
  )
}

export async function getServerSideProps(context: any) {
  const { customerId } = context.query

  return {
    props: {
      customerId: customerId || null,
      isAuthenticated: !!customerId
    }
  }
}
