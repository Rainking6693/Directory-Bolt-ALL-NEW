import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy - DirectoryBolt</title>
        <meta name="description" content="DirectoryBolt Privacy Policy. Learn how we collect, use, and protect your personal information." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://directorybolt.com/privacy" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
            Privacy Policy
          </h1>
          <p className="text-secondary-300 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert prose-volt max-w-none">
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">1. Information We Collect</h2>
              <p className="text-secondary-200 mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Account information (name, email address, password)</li>
                <li>Business information (business name, website, contact details)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Usage data and analytics</li>
                <li>Communications with our support team</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">2. How We Use Your Information</h2>
              <p className="text-secondary-200 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your directory submissions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">3. Information Sharing</h2>
              <p className="text-secondary-200 mb-4">
                We do not sell your personal information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li><strong>With directory platforms:</strong> To submit your business information as requested</li>
                <li><strong>With service providers:</strong> Who help us operate our business (e.g., payment processing, analytics)</li>
                <li><strong>For legal reasons:</strong> When required by law or to protect our rights</li>
                <li><strong>With your consent:</strong> When you explicitly authorize us to share information</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">4. Data Security</h2>
              <p className="text-secondary-200">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4 mt-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments</li>
                <li>Access controls and authentication</li>
                <li>Secure payment processing through Stripe</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">5. Your Rights</h2>
              <p className="text-secondary-200 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Object to processing of your information</li>
                <li>Export your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="text-secondary-200 mt-4">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:privacy@directorybolt.com" className="text-volt-400 hover:text-volt-300">
                  privacy@directorybolt.com
                </a>
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">6. Cookies and Tracking</h2>
              <p className="text-secondary-200">
                We use cookies and similar tracking technologies to collect information about your browsing activities. You can control cookies through your browser settings. We use:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4 mt-4">
                <li><strong>Essential cookies:</strong> Required for the website to function</li>
                <li><strong>Analytics cookies:</strong> To understand how you use our service</li>
                <li><strong>Preference cookies:</strong> To remember your settings</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">7. Data Retention</h2>
              <p className="text-secondary-200">
                We retain your personal information for as long as necessary to provide our services and comply with legal obligations. When you close your account, we will delete or anonymize your information within 90 days, except where we are required to retain it by law.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">8. Children's Privacy</h2>
              <p className="text-secondary-200">
                Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">9. International Data Transfers</h2>
              <p className="text-secondary-200">
                Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">10. Changes to This Policy</h2>
              <p className="text-secondary-200">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of our services after changes constitutes acceptance of the updated policy.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">11. Contact Us</h2>
              <p className="text-secondary-200 mb-4">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-secondary-200 space-y-2">
                <li>Email: <a href="mailto:privacy@directorybolt.com" className="text-volt-400 hover:text-volt-300">privacy@directorybolt.com</a></li>
                <li>Support: <a href="mailto:support@directorybolt.com" className="text-volt-400 hover:text-volt-300">support@directorybolt.com</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/" className="text-volt-400 hover:text-volt-300 font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}

