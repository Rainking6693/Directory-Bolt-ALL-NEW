import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { StartTrialButton } from '../components/CheckoutButton'
import { PRICING_TIERS, PricingTier } from '../lib/config/pricing'

// Ensure page is rendered on server side
export async function getServerSideProps() {
  return {
    props: {}
  }
}

export default function PricingPage() {
  // Convert PRICING_TIERS to array format compatible with existing component
  const plans = Object.values(PRICING_TIERS).map((tier: PricingTier) => ({
    name: tier.name,
    price: `$${tier.price}`,
    period: '', // One-time purchase, no period
    description: tier.shortDescription,
    features: tier.features,
    cta: tier.id === 'enterprise' ? 'Contact Sales' : 'Get Started',
    popular: tier.popular || false,
    priceId: tier.id,
  }))

  return (
    <>
      <Head>
        <title>Pricing - DirectoryBolt | AI-Powered Directory Submissions</title>
        <meta name="description" content="Choose the perfect plan for your business. Get AI-powered business intelligence starting at $149. One-time purchase, lifetime results. Save 93% vs consultants." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://directorybolt.com/pricing" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
              Simple, Transparent
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
                Pricing
              </span>
            </h1>
            <p className="text-xl text-secondary-200 max-w-3xl mx-auto">
              Get AI-powered business intelligence for a one-time fee. Replace $2,000-5,000 consultant fees with permanent business assets.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-secondary-800/50 backdrop-blur-sm rounded-2xl border ${
                  plan.popular
                    ? 'border-volt-500 shadow-2xl shadow-volt-500/20'
                    : 'border-secondary-700'
                } p-8 hover:border-volt-500/50 transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 px-4 py-1 rounded-full text-sm font-bold">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-black text-volt-400">{plan.price}</span>
                    {plan.period && <span className="text-secondary-400">{plan.period}</span>}
                  </div>
                  <p className="text-secondary-300 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-secondary-200">
                      <span className="text-volt-400 mr-2">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.priceId === 'enterprise' ? (
                  <a
                    href="mailto:sales@directorybolt.com"
                    className="block w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 text-center"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <StartTrialButton
                    plan={plan.name.toLowerCase()}
                    size="lg"
                    className="w-full"
                  >
                    {plan.cta}
                  </StartTrialButton>
                )}
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-6">
                <h3 className="text-xl font-bold text-volt-400 mb-2">
                  What's included?
                </h3>
                <p className="text-secondary-200">
                  All plans include AI-powered directory submissions, competitor analysis, and business intelligence reports. One-time purchase with 30-day money-back guarantee.
                </p>
              </div>
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-6">
                <h3 className="text-xl font-bold text-volt-400 mb-2">
                  Can I cancel anytime?
                </h3>
                <p className="text-secondary-200">
                  Absolutely. You can cancel your subscription at any time with no penalties or fees.
                </p>
              </div>
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-6">
                <h3 className="text-xl font-bold text-volt-400 mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-secondary-200">
                  We accept all major credit cards (Visa, MasterCard, American Express) through our secure Stripe payment processor.
                </p>
              </div>
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-6">
                <h3 className="text-xl font-bold text-volt-400 mb-2">
                  Can I upgrade or downgrade my plan?
                </h3>
                <p className="text-secondary-200">
                  Yes! You can change your plan at any time from your dashboard. Changes take effect immediately.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to boost your online visibility?
            </h2>
            <p className="text-xl text-secondary-200 mb-8">
              Get started today with a one-time purchase.
            </p>
            <StartTrialButton plan="growth" size="lg" className="px-8 py-4 text-lg">
              Get Started Now
            </StartTrialButton>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}

