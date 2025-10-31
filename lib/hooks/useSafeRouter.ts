import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

/**
 * Safe router hook that prevents routing issues and handles errors gracefully
 */
export function useSafeRouter() {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [navigationError, setNavigationError] = useState<string | null>(null)

  useEffect(() => {
    const handleRouteChangeStart = () => {
      setIsNavigating(true)
      setNavigationError(null)
    }

    const handleRouteChangeComplete = () => {
      setIsNavigating(false)
    }

    const handleRouteChangeError = (error: any) => {
      setIsNavigating(false)
      setNavigationError('Navigation failed. Please try again.')
      console.error('Router error:', error)
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    router.events.on('routeChangeError', handleRouteChangeError)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
      router.events.off('routeChangeError', handleRouteChangeError)
    }
  }, [router])

  const safePush = useCallback(async (url: string, as?: string, options?: any) => {
    try {
      setNavigationError(null)
      await router.push(url, as, options)
    } catch (error) {
      console.error('Navigation error:', error)
      setNavigationError('Navigation failed. Please try again.')
    }
  }, [router])

  const safeReplace = useCallback(async (url: string, as?: string, options?: any) => {
    try {
      setNavigationError(null)
      await router.replace(url, as, options)
    } catch (error) {
      console.error('Navigation error:', error)
      setNavigationError('Navigation failed. Please try again.')
    }
  }, [router])

  const safeBack = useCallback(() => {
    try {
      setNavigationError(null)
      router.back()
    } catch (error) {
      console.error('Navigation error:', error)
      setNavigationError('Navigation failed. Please try again.')
      // Fallback to home page if back fails
      router.push('/')
    }
  }, [router])

  const clearError = useCallback(() => {
    setNavigationError(null)
  }, [])

  return {
    router,
    isNavigating,
    navigationError,
    push: safePush,
    replace: safeReplace,
    back: safeBack,
    clearError,
    // Pass through other router properties safely
    pathname: router.pathname,
    query: router.query,
    asPath: router.asPath,
    isReady: router.isReady,
  }
}

export default useSafeRouter