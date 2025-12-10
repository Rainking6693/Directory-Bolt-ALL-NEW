import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/layout/Footer'

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms of Service - DirectoryBolt</title>
        <meta name="description" content="DirectoryBolt Terms of Service. Read our terms and conditions for using our AI-powered directory submission service." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://directorybolt.com/terms" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <Header />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
            Terms of Service
          </h1>
          <p className="text-secondary-300 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-invert prose-volt max-w-none">
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">1. Acceptance of Terms</h2>
              <p className="text-secondary-200">
                By accessing and using DirectoryBolt ("Service"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">2. Description of Service</h2>
              <p className="text-secondary-200 mb-4">
                DirectoryBolt provides AI-powered directory submission services for businesses. Our Service includes:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Automated submission to business directories</li>
                <li>AI-powered business profile optimization</li>
                <li>Analytics and reporting</li>
                <li>Customer support</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">3. User Accounts</h2>
              <p className="text-secondary-200 mb-4">
                To use our Service, you must:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Be at least 18 years old</li>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Be responsible for all activities under your account</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">4. Subscription and Payment</h2>
              <p className="text-secondary-200 mb-4">
                <strong>4.1 Free Trial:</strong> We offer a 14-day free trial for new users. No credit card is required to start the trial.
              </p>
              <p className="text-secondary-200 mb-4">
                <strong>4.2 Subscription Plans:</strong> After the trial period, you must subscribe to a paid plan to continue using the Service.
              </p>
              <p className="text-secondary-200 mb-4">
                <strong>4.3 Billing:</strong> Subscriptions are billed monthly or annually in advance. All fees are non-refundable.
              </p>
              <p className="text-secondary-200 mb-4">
                <strong>4.4 Cancellation:</strong> You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.
              </p>
              <p className="text-secondary-200">
                <strong>4.5 Price Changes:</strong> We reserve the right to change our pricing with 30 days' notice.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">5. Acceptable Use</h2>
              <p className="text-secondary-200 mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Violate any laws or regulations</li>
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Infringe on intellectual property rights</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the Service for spam or unsolicited communications</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Resell or redistribute the Service without permission</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">6. Service Guarantees and Limitations</h2>
              <p className="text-secondary-200 mb-4">
                <strong>6.1 Best Efforts:</strong> We will make reasonable efforts to submit your business to directories, but we cannot guarantee acceptance by all directories.
              </p>
              <p className="text-secondary-200 mb-4">
                <strong>6.2 Third-Party Directories:</strong> Directory acceptance is subject to each directory's own terms and policies, which are beyond our control.
              </p>
              <p className="text-secondary-200">
                <strong>6.3 Service Availability:</strong> We strive for 99.9% uptime but do not guarantee uninterrupted service.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">7. Intellectual Property</h2>
              <p className="text-secondary-200 mb-4">
                <strong>7.1 Our IP:</strong> The Service, including all content, features, and functionality, is owned by DirectoryBolt and protected by copyright, trademark, and other laws.
              </p>
              <p className="text-secondary-200">
                <strong>7.2 Your Content:</strong> You retain ownership of your business information. By using our Service, you grant us a license to use your content solely to provide the Service.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-secondary-200">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">9. Limitation of Liability</h2>
              <p className="text-secondary-200">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, DIRECTORYBOLT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">10. Indemnification</h2>
              <p className="text-secondary-200">
                You agree to indemnify and hold harmless DirectoryBolt from any claims, damages, losses, liabilities, and expenses arising from your use of the Service or violation of these Terms.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">11. Termination</h2>
              <p className="text-secondary-200 mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including:
              </p>
              <ul className="list-disc list-inside text-secondary-200 space-y-2 ml-4">
                <li>Violation of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>At our sole discretion</li>
              </ul>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">12. Governing Law</h2>
              <p className="text-secondary-200">
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">13. Changes to Terms</h2>
              <p className="text-secondary-200">
                We reserve the right to modify these Terms at any time. We will notify you of material changes via email or through the Service. Your continued use after changes constitutes acceptance of the new Terms.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8 mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">14. Ownership</h2>
              <p className="text-secondary-200">
                This Service is owned and operated by Bullrush Investments LLC.
              </p>
            </div>

            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-secondary-700 p-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-4">15. Contact Information</h2>
              <p className="text-secondary-200 mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <ul className="list-none text-secondary-200 space-y-2">
                <li>Email: <a href="mailto:legal@directorybolt.com" className="text-volt-400 hover:text-volt-300">legal@directorybolt.com</a></li>
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

