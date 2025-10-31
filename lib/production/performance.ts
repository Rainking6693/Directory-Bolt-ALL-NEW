// PRODUCTION PERFORMANCE OPTIMIZATION UTILITIES
// Code splitting, caching, and performance monitoring tools

import { memo, lazy, Suspense, ComponentType, ReactNode } from 'react'
import { logger } from './logger'

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private observers: Map<string, PerformanceObserver> = new Map()
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers()
    }
  }

  private initializeObservers() {
    // Navigation timing
    this.observeNavigationTiming()
    
    // Resource loading
    this.observeResourceTiming()
    
    // Long tasks
    this.observeLongTasks()
    
    // Layout shifts
    this.observeLayoutShifts()
  }

  private observeNavigationTiming() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            
            logger.performance('navigation.domContentLoaded', 
              navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart)
            logger.performance('navigation.loadComplete', 
              navEntry.loadEventEnd - navEntry.loadEventStart)
            logger.performance('navigation.firstByte', 
              navEntry.responseStart - navEntry.requestStart)
          }
        }
      })

      observer.observe({ entryTypes: ['navigation'] })
      this.observers.set('navigation', observer)
    }
  }

  private observeResourceTiming() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            
            // Log slow resources
            if (resourceEntry.duration > 1000) {
              logger.warn('Slow resource loading', {
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                type: resourceEntry.initiatorType
              })
            }
          }
        }
      })

      observer.observe({ entryTypes: ['resource'] })
      this.observers.set('resource', observer)
    }
  }

  private observeLongTasks() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            logger.warn('Long task detected', {
              duration: entry.duration,
              startTime: entry.startTime
            })
          }
        }
      })

      try {
        observer.observe({ entryTypes: ['longtask'] })
        this.observers.set('longtask', observer)
      } catch (e) {
        // longtask may not be supported
      }
    }
  }

  private observeLayoutShifts() {
    if ('PerformanceObserver' in window) {
      let cumulativeLayoutShift = 0

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            cumulativeLayoutShift += (entry as any).value
          }
        }

        // Report CLS if it's getting high
        if (cumulativeLayoutShift > 0.1) {
          logger.warn('High cumulative layout shift', { value: cumulativeLayoutShift })
        }
      })

      try {
        observer.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('layout-shift', observer)
      } catch (e) {
        // layout-shift may not be supported
      }
    }
  }

  public measureFunction<T extends (...args: any[]) => any>(
    fn: T,
    name: string
  ): T {
    return ((...args: any[]) => {
      const start = performance.now()
      const result = fn(...args)
      const duration = performance.now() - start

      this.recordMetric(name, duration)

      if (duration > 100) {
        logger.warn(`Slow function execution: ${name}`, { duration })
      }

      return result
    }) as T
  }

  public measureAsync<T>(
    promise: Promise<T>,
    name: string
  ): Promise<T> {
    const start = performance.now()
    
    return promise.finally(() => {
      const duration = performance.now() - start
      this.recordMetric(name, duration)
      
      if (duration > 1000) {
        logger.warn(`Slow async operation: ${name}`, { duration })
      }
    })
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(value)
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift()
    }
  }

  public getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        }
      }
    }
    
    return result
  }

  public disconnect() {
    for (const observer of this.observers.values()) {
      observer.disconnect()
    }
    this.observers.clear()
  }
}

// Memory management
export class MemoryManager {
  private static instance: MemoryManager
  private cleanupTasks: (() => void)[] = []
  private intervalId: NodeJS.Timeout | null = null

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  private constructor() {
    this.startMemoryMonitoring()
  }

  private startMemoryMonitoring() {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      this.intervalId = setInterval(() => {
        const memory = (performance as any).memory
        if (memory) {
          const usedMB = Math.round(memory.usedJSHeapSize / 1048576)
          const totalMB = Math.round(memory.totalJSHeapSize / 1048576)
          const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576)
          
          logger.performance('memory.used', usedMB)
          logger.performance('memory.total', totalMB)
          
          // Warn if memory usage is high
          if (usedMB > limitMB * 0.8) {
            logger.warn('High memory usage detected', {
              used: usedMB,
              total: totalMB,
              limit: limitMB,
              percentage: Math.round((usedMB / limitMB) * 100)
            })
            
            this.runCleanup()
          }
        }
      }, 30000) // Check every 30 seconds
    }
  }

  public addCleanupTask(task: () => void) {
    this.cleanupTasks.push(task)
  }

  public runCleanup() {
    logger.info('Running memory cleanup tasks', { taskCount: this.cleanupTasks.length })
    
    for (const task of this.cleanupTasks) {
      try {
        task()
      } catch (error) {
        logger.error('Error in cleanup task', error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  public destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.runCleanup()
  }
}

// Enhanced lazy loading with error boundaries
export function createLazyComponent<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: {
    fallback?: ReactNode
    errorFallback?: ReactNode
    name?: string
  } = {}
) {
  const LazyComponent = lazy(() => {
    const start = performance.now()
    
    return factory()
      .then((module) => {
        const duration = performance.now() - start
        logger.performance(`lazy.${options.name || 'component'}`, duration)
        return module
      })
      .catch((error) => {
        logger.error(`Failed to load lazy component: ${options.name || 'unknown'}`, error)
        throw error
      })
  })

  return function LazyWrapper(props: any) {
    // Return JSX as createElement calls to avoid TSX issues
    const { createElement } = require('react')
    return createElement(
      Suspense,
      { fallback: options.fallback || createElement('div', null, 'Loading...') },
      createElement(LazyComponent, props)
    )
  }
}

// Optimized memo with performance tracking
export function createMemoComponent<T extends ComponentType<any>>(
  component: T,
  areEqual?: (prevProps: any, nextProps: any) => boolean,
  name?: string
): T {
  const MemoComponent = memo(component, areEqual)
  
  if (name) {
    MemoComponent.displayName = name
  }
  
  return MemoComponent as unknown as T
}

// Bundle analyzer utilities
export const bundleAnalyzer = {
  logChunkSizes: () => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      
      const jsChunks = entries.filter(entry => 
        entry.name.includes('.js') && 
        (entry.name.includes('chunk') || entry.name.includes('_next'))
      )
      
      jsChunks.forEach(chunk => {
        logger.info('Bundle chunk loaded', {
          name: chunk.name.split('/').pop(),
          size: chunk.transferSize,
          duration: chunk.duration
        })
      })
    }
  },

  detectUnusedCode: () => {
    // This would integrate with tools like webpack-bundle-analyzer
    logger.info('Bundle analysis needed - integrate with webpack-bundle-analyzer')
  }
}

// Cache management
export class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private maxSize = 100
  private cleanupInterval = 60000 // 1 minute

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  private constructor() {
    setInterval(() => this.cleanup(), this.cleanupInterval)
  }

  public set<T>(key: string, data: T, ttl: number = 300000): void { // 5 minute default TTL
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  public has(key: string): boolean {
    return this.get(key) !== null
  }

  public delete(key: string): boolean {
    return this.cache.delete(key)
  }

  public clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { 
        cleaned, 
        remaining: this.cache.size 
      })
    }
  }

  public getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  const performanceMonitor = PerformanceMonitor.getInstance()
  const memoryManager = MemoryManager.getInstance()
  const cacheManager = CacheManager.getInstance()

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    performanceMonitor.disconnect()
    memoryManager.destroy()
  })
}

export const performanceMonitor = PerformanceMonitor.getInstance()
export const memoryManager = MemoryManager.getInstance()
export const cacheManager = CacheManager.getInstance()