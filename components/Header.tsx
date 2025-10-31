'use client'
import { useRouter } from 'next/router'
import Link from 'next/link'
// @ts-ignore - StartTrialButton is provided from a JS module
import { StartTrialButton } from './CheckoutButton'

interface HeaderProps {
  showBackButton?: boolean
}

export default function Header({ showBackButton = false }: HeaderProps) {
  const router = useRouter()

  return (
    <nav className="relative z-20 bg-secondary-900/80 backdrop-blur-sm border-b border-volt-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-volt-400 to-volt-600 bg-clip-text text-transparent animate-glow cursor-pointer"
            >
              ⚡ DirectoryBolt
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/analyze"
              className="text-secondary-300 hover:text-volt-400 transition-colors font-medium tap-target p-2"
            >
              Free Analysis
            </Link>
            <Link 
              href="/pricing"
              className="text-secondary-300 hover:text-volt-400 transition-colors font-medium tap-target p-2"
            >
              Pricing
            </Link>
            <Link 
              href="/customer-portal"
              className="text-secondary-300 hover:text-volt-400 transition-colors font-medium tap-target p-2"
            >
              Customer Portal
            </Link>
            <StartTrialButton
              plan="growth"
              size="md"
              className="px-6 py-2"
            >
              Start Free Trial
            </StartTrialButton>
          </div>

          {/* Mobile Menu & Back Button */}
          <div className="md:hidden flex items-center space-x-4">
            {showBackButton ? (
              <button
                onClick={() => router.back()}
                className="text-secondary-300 hover:text-volt-400 transition-colors font-medium tap-target p-2"
              >
                ← Back
              </button>
            ) : (
              <StartTrialButton
                plan="growth"
                size="sm"
                className="px-4 py-2 text-sm"
              >
                Start Trial
              </StartTrialButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}