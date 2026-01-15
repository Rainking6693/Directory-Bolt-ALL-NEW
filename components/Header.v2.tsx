'use client'
import { useRouter } from 'next/router'
import Link from 'next/link'
// @ts-ignore - StartTrialButton is provided from a JS module
import { StartTrialButton } from './CheckoutButton'
import { Button } from '../redesign-v2/components/ui/Button'

interface HeaderProps {
  showBackButton?: boolean
}

export default function Header({ showBackButton = false }: HeaderProps) {
  const router = useRouter()

  return (
    <nav className="relative z-20 bg-role-bg-primary/95 backdrop-blur-sm border-b border-role-border-default sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo - No emoji, neutral text */}
          <div className="flex items-center">
            <Link 
              href="/"
              className="text-2xl font-bold text-role-text-primary hover:text-volt-600 transition-colors cursor-pointer"
            >
              DirectoryBolt
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/analyze"
              className="text-role-text-secondary hover:text-volt-600 transition-colors font-medium p-2 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2"
            >
              Free Analysis
            </Link>
            <Link 
              href="/pricing"
              className="text-role-text-secondary hover:text-volt-600 transition-colors font-medium p-2 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2"
            >
              Pricing
            </Link>
            <Link 
              href="/customer-portal"
              className="text-role-text-secondary hover:text-volt-600 transition-colors font-medium p-2 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2"
            >
              Customer Portal
            </Link>
            <StartTrialButton
              plan="growth"
              size="md"
              className="ml-4 bg-volt-500 hover:bg-volt-400 text-role-text-primary font-semibold px-6 py-2 rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors min-h-[44px]"
            >
              Get Started
            </StartTrialButton>
          </div>

          {/* Mobile Menu & Back Button */}
          <div className="md:hidden flex items-center space-x-4">
            {showBackButton ? (
              <button
                onClick={() => router.back()}
                className="text-role-text-secondary hover:text-volt-600 transition-colors font-medium p-2 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2"
              >
                ← Back
              </button>
            ) : (
              <StartTrialButton
                plan="growth"
                size="sm"
                className="px-4 py-2 text-sm bg-volt-500 hover:bg-volt-400 text-role-text-primary font-semibold rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors"
              >
                Get Started
              </StartTrialButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
