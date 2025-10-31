'use client'
import { useState, useEffect, ReactNode } from 'react'

interface ClientWrapperProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * ClientWrapper prevents hydration mismatches by ensuring client-only rendering
 * for components that use browser-specific APIs
 */
export function ClientWrapper({ children, fallback = null }: ClientWrapperProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Prevent hydration mismatch by not rendering client-specific content on server
  if (!hasMounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default ClientWrapper