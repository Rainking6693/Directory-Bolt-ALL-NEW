import React, { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Staff Portal Redirect Page
 * 
 * Redirects /staff to /staff-dashboard
 * Maintains backward compatibility with old links
 */
export default function StaffRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to staff dashboard
    router.replace('/staff-dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500 mx-auto mb-4"></div>
        <p className="text-secondary-300">Redirecting to staff dashboard...</p>
      </div>
    </div>
  )
}

