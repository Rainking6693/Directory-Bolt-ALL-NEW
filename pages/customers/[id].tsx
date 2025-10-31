import React from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/layout/Layout'
import { authenticateStaffRequest } from '../../lib/auth/guards'

type Customer = Record<string, any>

interface PageProps {
  ok: boolean
  customer?: Customer
  error?: string
}

export default function CustomerDetailPage({ ok, customer, error }: PageProps) {
  if (!ok) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load customer</p>
          <p className="text-secondary-300 text-sm">{error || 'Unauthorized or unavailable'}</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-secondary-300">No customer data available</p>
        </div>
      </div>
    )
  }

  const id = customer.id || customer.customer_id
  const businessName = customer.businessName || customer.business_name || 'Unknown Business'
  const email = customer.email || 'Unknown'
  const status = customer.status || 'unknown'
  const packageType = customer.packageType || customer.package_type || 'unknown'
  const directoriesSubmitted = customer.directoriesSubmitted ?? customer.directories_submitted ?? 0
  const directoriesFailed = customer.directoriesFailed ?? customer.failed_directories ?? 0
  const directoryLimit = customer.directoryLimit ?? customer.directories_allocated ?? 0

  return (
    <>
      <Head>
        <title>{businessName} — Customer Details</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Layout title={`${businessName} — Customer Details`} description="Customer detail view">
        <div className="min-h-screen bg-secondary-900">
          <header className="bg-secondary-800 border-b border-secondary-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-white">Customer Details</h1>
                <div className="flex items-center space-x-3">
                  <Link href="/staff-dashboard" className="text-volt-400 hover:text-volt-300 text-sm">
                    ← Back to Staff Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-secondary-800 border border-secondary-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Business Information</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Business Name</span>
                    <span className="text-white font-medium">{businessName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Email</span>
                    <span className="text-secondary-100">{email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Customer ID</span>
                    <span className="text-secondary-100 text-sm break-all">{id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Package</span>
                    <span className="text-volt-400 font-medium">{packageType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Status</span>
                    <span className="text-secondary-100">{status}</span>
                  </div>
                </div>
              </div>

              <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Progress</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Submitted</span>
                    <span className="text-green-400 font-medium">{directoriesSubmitted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Failed</span>
                    <span className="text-red-400 font-medium">{directoriesFailed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary-300">Allocated</span>
                    <span className="text-secondary-100 font-medium">{directoryLimit}</span>
                  </div>
                </div>
              </div>
            </div>

            {Array.isArray(customer.jobs) && customer.jobs.length > 0 && (
              <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Recent Jobs</h2>
                <div className="space-y-2">
                  {customer.jobs.slice(0, 10).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-secondary-700/50 rounded">
                      <span className="text-secondary-100 text-sm">{job.id}</span>
                      <span className="text-secondary-300 text-sm">{job.status || 'unknown'}</span>
                      <span className="text-secondary-400 text-xs">{job.created_at ? new Date(job.created_at).toLocaleString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </Layout>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const { req, params } = ctx
  const id = params?.id as string

  // Auth guard (allow staff or admin)
  const auth = authenticateStaffRequest(req as any)
  if (!auth.ok) {
    return {
      redirect: {
        destination: '/staff-login',
        permanent: false,
      },
    }
  }

  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
    const host = req.headers.host
    const baseUrl = `${proto}://${host}`

    const res = await fetch(`${baseUrl}/api/customers/${encodeURIComponent(id)}`, {
      headers: {
        // forward cookies to preserve session
        cookie: (req.headers.cookie as string) || '',
      },
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      return { props: { ok: false, error: payload?.message || `API Error ${res.status}` } }
    }

    const data = await res.json()
    return { props: { ok: true, customer: data.customer } }
  } catch (error: any) {
    return { props: { ok: false, error: error?.message || 'Failed to fetch customer' } }
  }
}
