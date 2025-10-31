import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'

interface MobileNavigationProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')

  // Navigation items
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z" />
        </svg>
      )
    },
    {
      id: 'directories',
      label: 'Directories',
      href: '/directories',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 'submit',
      label: 'Submit',
      href: '/submit',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      isPrimary: true
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/analytics',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ]

  // Update active tab based on current route
  useEffect(() => {
    const currentPath = router.pathname
    const activeItem = navItems.find(item => currentPath.startsWith(item.href))
    if (activeItem) {
      setActiveTab(activeItem.id)
    }
  }, [router.pathname])

  // Handle navigation
  const handleNavigation = (href: string, id: string) => {
    setActiveTab(id)
    router.push(href)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Side Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-secondary-900 border-r border-secondary-700 z-50 lg:hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-secondary-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-volt-500 rounded-lg flex items-center justify-center">
                    <span className="text-secondary-900 font-bold text-sm">⚡</span>
                  </div>
                  <span className="text-white font-semibold text-lg">DirectoryBolt</span>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 text-secondary-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 py-6">
              <nav className="space-y-2 px-4">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.href, item.id)}
                      className={`
                        w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all duration-200
                        ${isActive 
                          ? 'bg-volt-500/10 text-volt-500 border border-volt-500/20' 
                          : 'text-secondary-400 hover:text-white hover:bg-secondary-800'
                        }
                        ${item.isPrimary ? 'ring-2 ring-volt-500/20' : ''}
                      `}
                    >
                      <span className={`${isActive ? 'text-volt-500' : 'text-secondary-500'}`}>
                        {item.icon}
                      </span>
                      
                      <span className="font-medium">
                        {item.label}
                      </span>
                      
                      {isActive && (
                        <motion.div
                          layoutId="mobile-nav-indicator"
                          className="ml-auto w-2 h-2 bg-volt-500 rounded-full"
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-secondary-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-secondary-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">JD</span>
                </div>
                <div>
                  <div className="text-white font-medium text-sm">John Doe</div>
                  <div className="text-secondary-400 text-xs">Pro Plan</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 text-secondary-400 hover:text-white transition-colors text-sm"
                  onClick={onClose}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                
                <button className="flex items-center gap-3 text-secondary-400 hover:text-white transition-colors text-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Bottom Tab Navigation for Mobile
export function MobileBottomNavigation() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-volt-500' : 'text-secondary-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      )
    },
    {
      id: 'directories',
      label: 'Browse',
      href: '/directories',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-volt-500' : 'text-secondary-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 'submit',
      label: 'Submit',
      href: '/submit',
      icon: (active: boolean) => (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${active ? 'bg-volt-500' : 'bg-volt-500'}`}>
          <svg className="w-6 h-6 text-secondary-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      ),
      isPrimary: true
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/analytics',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-volt-500' : 'text-secondary-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-volt-500' : 'text-secondary-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ]

  // Update active tab based on current route
  useEffect(() => {
    const currentPath = router.pathname
    const activeItem = tabItems.find(item => currentPath.startsWith(item.href))
    if (activeItem) {
      setActiveTab(activeItem.id)
    }
  }, [router.pathname])

  // Handle navigation
  const handleNavigation = (href: string, id: string) => {
    setActiveTab(id)
    router.push(href)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary-900 border-t border-secondary-700 safe-area-inset-bottom lg:hidden z-40">
      <div className="flex items-center justify-around py-2">
        {tabItems.map((item) => {
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href, item.id)}
              className={`
                flex flex-col items-center justify-center p-2 min-w-0 flex-1 relative
                ${item.isPrimary ? 'transform -translate-y-2' : ''}
              `}
            >
              {item.icon(isActive)}
              
              <span className={`
                text-xs mt-1 font-medium transition-colors
                ${isActive ? 'text-volt-500' : 'text-secondary-500'}
                ${item.isPrimary ? 'text-secondary-900' : ''}
              `}>
                {item.label}
              </span>
              
              {isActive && !item.isPrimary && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-volt-500 rounded-full"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}