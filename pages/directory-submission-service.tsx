import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'
import { StartTrialButton } from '../components/CheckoutButton'

export default function DirectorySubmissionServicePage() {
  return (
    <>
      <Head>
        <title>Directory Submission Service - DirectoryBolt | AI-Powered Automation</title>
        <meta name="description" content="Professional directory submission service powered by AI. Submit your business to 480+ directories automatically. Save time and boost your online visibility." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://directorybolt.com/directory-submission-service" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
              AI-Powered Directory
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
                Submission Service
              </span>
            </h1>
            <p className="text-xl text-secondary-200 max-w-3xl mx-auto mb-8">
              Submit your business to 480+ directories automatically. Save hundreds of hours and boost your online visibility with our AI-powered automation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <StartTrialButton plan="growth" size="lg" className="px-8 py-4 text-lg">
                Start Free Trial
              </StartTrialButton>
              <Link
                href="/analyze"
                className="bg-secondary-800 border border-volt-500/30 text-white font-bold px-8 py-4 rounded-xl hover:border-volt-500 transition-all duration-300 text-center"
              >
                Get Free Analysis
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 hover:border-volt-500/50 transition-all duration-300">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold text-white mb-3">AI-Powered</h3>
              <p className="text-secondary-200">
                Our AI automatically optimizes your business profile for each directory, ensuring maximum acceptance rates.
              </p>
            </div>
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 hover:border-volt-500/50 transition-all duration-300">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold text-white mb-3">Lightning Fast</h3>
              <p className="text-secondary-200">
                Submit to hundreds of directories in minutes, not months. Our automation handles all the tedious work for you.
              </p>
            </div>
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 hover:border-volt-500/50 transition-all duration-300">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-white mb-3">Detailed Analytics</h3>
              <p className="text-secondary-200">
                Track your submissions, monitor acceptance rates, and measure the impact on your online visibility.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { step: '1', title: 'Sign Up', description: 'Create your account and enter your business information' },
                { step: '2', title: 'AI Analysis', description: 'Our AI analyzes your business and finds the best directories' },
                { step: '3', title: 'Auto Submit', description: 'We automatically submit your business to selected directories' },
                { step: '4', title: 'Track Results', description: 'Monitor submissions and track your growing online presence' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-volt-500 to-volt-600 rounded-full flex items-center justify-center text-secondary-900 font-black text-2xl mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-secondary-200">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-700 p-8 md:p-12 mb-16">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Why Choose DirectoryBolt?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                'Save 100+ hours of manual submission work',
                'Increase online visibility and local SEO rankings',
                'Access to 480+ high-quality directories',
                'AI-optimized business profiles for each directory',
                'Automated submission tracking and reporting',
                'Higher acceptance rates than manual submissions',
                'Consistent NAP (Name, Address, Phone) across all listings',
                'Priority customer support',
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-volt-400 text-xl">✓</span>
                  <span className="text-secondary-200">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-volt-500/10 to-volt-600/10 border border-volt-500/30 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Boost Your Online Visibility?
            </h2>
            <p className="text-xl text-secondary-200 mb-8 max-w-2xl mx-auto">
              Join hundreds of businesses using DirectoryBolt to automate their directory submissions and grow their online presence.
            </p>
            <StartTrialButton plan="growth" size="lg" className="px-8 py-4 text-lg">
              Start Your Free Trial
            </StartTrialButton>
            <p className="text-secondary-400 mt-4 text-sm">
              14-day free trial • No credit card required • Cancel anytime
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}

