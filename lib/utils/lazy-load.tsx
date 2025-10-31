import { ComponentType, lazy, Suspense } from 'react'
import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic'

// Generic loading fallback
export const DefaultLoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  </div>
)

// Small loading fallback for components
export const SmallLoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

// Utility for creating lazy loaded components with Next.js dynamic
export function createLazyComponent<T = any>(
  importFunc: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    loading?: (loadingProps: DynamicOptionsLoadingProps) => JSX.Element | null
    ssr?: boolean
    fallback?: ComponentType<any>
  }
) {
  return dynamic(importFunc, {
    loading: options?.loading || (() => <SmallLoadingFallback />),
    ssr: options?.ssr ?? true,
  })
}

// Pre-configured lazy components for common patterns
export const createPageComponent = <T = any>(importFunc: () => Promise<{ default: ComponentType<T> }>) =>
  createLazyComponent(importFunc, {
    loading: () => <DefaultLoadingFallback />,
    ssr: true,
  })

export const createDashboardComponent = <T = any>(importFunc: () => Promise<{ default: ComponentType<T> }>) =>
  createLazyComponent(importFunc, {
    loading: () => <SmallLoadingFallback />,
    ssr: false,
  })

// For heavy analysis components
export const createAnalysisComponent = <T = any>(importFunc: () => Promise<{ default: ComponentType<T> }>) =>
  createLazyComponent(importFunc, {
    loading: () => <DefaultLoadingFallback message="Loading analysis tools..." />,
    ssr: false,
  })