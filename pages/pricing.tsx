import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { Button } from '../redesign-v2/components/ui/Button'
import { Card } from '../redesign-v2/components/ui/Card'
import { Badge } from '../redesign-v2/components/ui/Badge'
import { GuaranteeCertificate } from '../redesign-v2/components/trust/GuaranteeCertificate'
import { PRICING_TIERS, PricingTier } from '../lib/config/pricing'

// Ensure page is rendered on server side
export async function getServerSideProps() {
  return {
    props: {}
  }
}

export default function PricingPage() {
  // Convert PRICING_TIERS to array format
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

      <div className="min-h-screen bg-role-bg-primary">
        <Header />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black text-role-text-primary mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-role-text-secondary max-w-3xl mx-auto">
              Get AI-powered business intelligence for a one-time fee. Replace $2,000-5,000 consultant fees with permanent business assets.
            </p>
            
            {/* One-Time vs Subscription Clarification */}
            <div className="mt-8 max-w-2xl mx-auto">
              <Card variant="subtle" className="bg-volt-50 border-volt-200">
                <p className="text-role-text-primary font-semibold mb-2">
                  DirectoryBolt is a one-time purchase, not a subscription.
                </p>
                <p className="text-role-text-secondary text-sm">
                  Pay once, own your business intelligence forever. No monthly fees, no cancellation needed.
                </p>
              </Card>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                variant="artifact"
                className={`relative ${
                  plan.popular
                    ? 'border-2 border-volt-200 bg-volt-50'
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge variant="volt">Most Popular</Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-role-text-primary mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="font-mono text-4xl font-black text-role-text-primary">{plan.price}</span>
                    {plan.period && <span className="text-role-text-tertiary">{plan.period}</span>}
                    <div className="text-role-text-tertiary text-sm mt-1">ONE-TIME</div>
                  </div>
                  <p className="text-role-text-secondary text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-role-text-secondary">
                      <span className="text-success-500 mr-2 mt-0.5">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.priceId === 'enterprise' ? (
                  <a
                    href="mailto:sales@directorybolt.com"
                    className="block w-full"
                  >
                    <Button variant="primary" className="w-full">
                      {plan.cta}
                    </Button>
                  </a>
                ) : (
                  <Button 
                    variant={plan.popular ? "primary" : "secondary"} 
                    className="w-full"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.location.href = `/checkout?plan=${plan.priceId}`
                      }
                    }}
                  >
                    {plan.cta}
                  </Button>
                )}
              </Card>
            ))}
          </div>

          {/* Guarantee Certificate */}
          <div className="max-w-3xl mx-auto mb-16">
            <GuaranteeCertificate />
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-role-text-primary text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <Card variant="subtle">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">
                  What's included?
                </h3>
                <p className="text-role-text-secondary">
                  All plans include AI-powered directory submissions, competitor analysis, and business intelligence reports. One-time purchase with 30-day money-back guarantee.
                </p>
              </Card>
              <Card variant="subtle">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">
                  Is this a subscription?
                </h3>
                <p className="text-role-text-secondary">
                  No. DirectoryBolt is a one-time purchase. Pay once and own your business intelligence forever. No recurring fees, no cancellation needed.
                </p>
              </Card>
              <Card variant="subtle">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-role-text-secondary">
                  We accept all major credit cards (Visa, MasterCard, American Express) through our secure Stripe payment processor.
                </p>
              </Card>
              <Card variant="subtle">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">
                  Can I upgrade my plan later?
                </h3>
                <p className="text-role-text-secondary">
                  Yes! You can upgrade to a higher plan at any time. Contact support to upgrade and pay only the difference.
                </p>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <h2 className="text-3xl font-bold text-role-text-primary mb-4">
              Ready to boost your online visibility?
            </h2>
            <p className="text-xl text-role-text-secondary mb-8">
              Get started today with a one-time purchase.
            </p>
            <Button 
              variant="primary" 
              className="px-8 py-4 text-lg"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/checkout?plan=growth'
                }
              }}
            >
              Get Started Now
            </Button>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
