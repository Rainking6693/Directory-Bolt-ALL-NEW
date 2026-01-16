import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { Card } from '../redesign-v2/components/ui/Card'
import { Button } from '../redesign-v2/components/ui/Button'
import { PRICING_TIERS } from '../lib/config/pricing'
import { logger } from '../lib/utils/logger'

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { plan } = router.query

  const planConfig = plan && typeof plan === 'string' ? PRICING_TIERS[plan as keyof typeof PRICING_TIERS] : null

  useEffect(() => {
    if (!planConfig && router.isReady) {
      setError('Invalid plan selected. Please go back to pricing page.')
    }
  }, [plan, router.isReady, planConfig])

  const handleCheckout = async () => {
    if (!planConfig || !plan) {
      setError('Invalid plan')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan as string,
          successUrl: `${window.location.origin}/checkout-success?plan=${plan}`,
          cancelUrl: `${window.location.origin}/checkout?plan=${plan}`,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      logger.error('Checkout error', {}, err instanceof Error ? err : new Error(message))
    } finally {
      setLoading(false)
    }
  }

  if (!router.isReady) {
    return (
      <>
        <Head>
          <title>Checkout - DirectoryBolt</title>
        </Head>
        <div className="min-h-screen bg-role-bg-primary flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Checkout - DirectoryBolt | Secure Payment</title>
        <meta name="description" content="Complete your DirectoryBolt purchase securely" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-role-bg-primary">
        <Header />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Back to Pricing */}
          <button
            onClick={() => router.push('/pricing')}
            className="text-volt-600 hover:text-volt-700 mb-8 font-medium"
          >
            ← Back to Pricing
          </button>

          {error && (
            <Card variant="subtle" className="bg-red-50 border-red-200 mb-8">
              <p className="text-red-700 font-semibold">{error}</p>
            </Card>
          )}

          {!planConfig ? (
            <Card variant="artifact" className="text-center py-12">
              <h2 className="text-2xl font-bold text-role-text-primary mb-4">
                Plan Not Found
              </h2>
              <p className="text-role-text-secondary mb-8">
                Please select a plan from the pricing page.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push('/pricing')}
              >
                Back to Pricing
              </Button>
            </Card>
          ) : (
            <Card variant="artifact">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-role-text-primary mb-2">
                  {planConfig.name}
                </h1>
                <p className="text-role-text-secondary">{planConfig.shortDescription}</p>
              </div>

              <div className="bg-volt-50 border border-volt-200 rounded-lg p-6 mb-8">
                <div className="text-center mb-6">
                  <div className="text-5xl font-black text-role-text-primary mb-2">
                    ${planConfig.price}
                  </div>
                  <p className="text-role-text-secondary">ONE-TIME PURCHASE</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {planConfig.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-success-500 mr-3 mt-0.5 font-bold">✓</span>
                      <span className="text-role-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-white rounded-lg p-4 mb-6">
                  <p className="text-sm text-role-text-secondary text-center">
                    💳 Secure payment processed through Stripe
                  </p>
                </div>

                <Button
                  variant="primary"
                  className="w-full py-3 text-lg font-semibold"
                  onClick={handleCheckout}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Proceed to Payment'}
                </Button>

                <p className="text-xs text-role-text-tertiary text-center mt-4">
                  30-day money-back guarantee
                </p>
              </div>

              {/* Trust Signals */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="font-semibold text-role-text-primary">🔒 Secure</p>
                  <p className="text-role-text-secondary text-xs">SSL Encrypted</p>
                </div>
                <div>
                  <p className="font-semibold text-role-text-primary">✓ Verified</p>
                  <p className="text-role-text-secondary text-xs">Stripe Certified</p>
                </div>
                <div>
                  <p className="font-semibold text-role-text-primary">💬 Support</p>
                  <p className="text-role-text-secondary text-xs">24/7 Available</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Footer />
      </div>
    </>
  )
}
