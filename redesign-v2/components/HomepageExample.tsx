// Example homepage composition using all the new components
// This shows how to structure the homepage with the Modern Artifact aesthetic

import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { StatBlock } from './ui/StatBlock';
import { Badge } from './ui/Badge';
import { ProofGallery } from './proof/ProofGallery';
import { MethodologyBlock } from './proof/MethodologyBlock';
import { ProgressStepper } from './proof/ProgressStepper';
import { GuaranteeCertificate } from './trust/GuaranteeCertificate';

export function HomepageExample() {
  // Sample data - replace with real data
  const proofSamples = [
    {
      id: '1',
      title: 'Market Analysis Report',
      caption: 'Comprehensive competitor intelligence and market positioning',
      image: '/samples/report-1-placeholder.jpg',
    },
    {
      id: '2',
      title: 'Directory Opportunities',
      caption: '500+ high-authority directory recommendations with approval probabilities',
      image: '/samples/report-2-placeholder.jpg',
    },
    {
      id: '3',
      title: 'Portal Dashboard',
      caption: 'Real-time submission tracking and status updates',
      image: '/samples/portal-placeholder.jpg',
    },
  ];

  const progressSteps = [
    { id: '1', label: 'Submit', completed: true },
    { id: '2', label: 'Analyze', completed: true },
    { id: '3', label: 'Build Brief', active: true },
    { id: '4', label: 'Execute' },
    { id: '5', label: 'Delivered' },
  ];

  const trustItems = [
    {
      id: '1',
      icon: '✓',
      title: '30-Day Guarantee',
      description: 'Money-back if not satisfied',
    },
    {
      id: '2',
      icon: '✓',
      title: 'No Recurring Fees',
      description: 'One-time purchase only',
    },
    {
      id: '3',
      icon: '✓',
      title: 'Lifetime Access',
      description: 'Own your intelligence forever',
    },
    {
      id: '4',
      icon: '✓',
      title: '48-Hour Results',
      description: 'Fast turnaround time',
    },
  ];

  return (
    <div className="bg-role-bg-primary">
      {/* Hero Section */}
      <section className="bg-role-bg-primary py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-role-border-default bg-role-bg-secondary mb-6">
            <span className="text-role-text-secondary text-sm">One-Time Investment • Lifetime Access</span>
          </div>

          {/* H1 - Neutral, never Volt */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-role-text-primary mb-6 leading-tight tracking-tight">
            Own Your Business Intelligence Forever
          </h1>

          {/* Subheadline - Neutral */}
          <p className="text-lg md:text-xl text-role-text-secondary mb-8 max-w-2xl mx-auto">
            Replace $3,000+ consultant projects with permanent AI-powered insights
          </p>

          {/* Value Card - Document Style */}
          <Card variant="artifact" className="mb-8 max-w-md mx-auto">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold text-role-text-primary mb-2">
                $4,300 <span className="text-role-text-tertiary text-xl">→</span> $299
              </div>
              <p className="text-role-text-secondary text-sm">
                Value delivered for one-time investment
              </p>
            </div>
          </Card>

          {/* Primary CTA - Volt */}
          <Button variant="primary" className="mb-4">
            Start Free Analysis
          </Button>

          {/* Secondary CTA - Ghost */}
          <div className="mt-4">
            <Button variant="ghost">
              See Sample Report
            </Button>
          </div>

          {/* Trust Line - Neutral, Small */}
          <p className="mt-6 text-role-text-tertiary text-sm">
            30-day guarantee • No subscriptions • Results in 48 hours
          </p>
        </div>
      </section>

      {/* ProofGallery Section */}
      <section className="bg-role-bg-secondary py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-4 text-center">
            See What You'll Receive
          </h2>
          <p className="text-role-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Real sample outputs from our intelligence platform
          </p>
          <ProofGallery samples={proofSamples} />
        </div>
      </section>

      {/* MethodologyBlock Section */}
      <section className="bg-role-bg-primary py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-4 text-center">
            How We Measure
          </h2>
          <p className="text-role-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Concrete methodology: inputs, analysis, and deliverables
          </p>
          <MethodologyBlock />
        </div>
      </section>

      {/* ProgressStepper Section */}
      <section className="bg-role-bg-secondary py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-4 text-center">
            Your Timeline
          </h2>
          <p className="text-role-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Results in 48 hours with clear progress tracking
          </p>
          <ProgressStepper steps={progressSteps} />
        </div>
      </section>

      {/* Trust Stack Section */}
      <section className="bg-role-bg-primary py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-12 text-center">
            Trusted by 500+ Businesses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {trustItems.map((item) => (
              <div key={item.id} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 text-role-text-secondary text-2xl">
                  {item.icon}
                </div>
                <p className="font-semibold text-role-text-primary mb-1">{item.title}</p>
                <p className="text-sm text-role-text-tertiary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GuaranteeCertificate Section */}
      <section className="bg-role-bg-secondary py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <GuaranteeCertificate />
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="bg-role-bg-primary py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-4 text-center">
            Choose Your Intelligence Package
          </h2>
          <p className="text-role-text-secondary text-center mb-12 max-w-2xl mx-auto">
            One-time investment. Lifetime access.
          </p>

          {/* Pricing Cards - Neutral styling, Volt only for CTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Starter Plan */}
            <Card variant="artifact">
              <div className="text-center">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">Starter</h3>
                <div className="font-mono text-3xl font-bold text-role-text-primary mb-4">
                  $149
                </div>
                <ul className="text-role-text-secondary text-sm space-y-2 mb-6 text-left">
                  <li>• AI Market Analysis</li>
                  <li>• 100 Directory Submissions</li>
                  <li>• Basic Reports</li>
                </ul>
                <Button variant="secondary" className="w-full">
                  Get Started
                </Button>
              </div>
            </Card>

            {/* Growth Plan - Most Popular */}
            <Card variant="artifact" className="border-2 border-volt-200 bg-volt-50">
              <div className="text-center">
                <div className="inline-block mb-2">
                  <Badge variant="volt">Most Popular</Badge>
                </div>
                <h3 className="text-xl font-bold text-role-text-primary mb-2">Growth</h3>
                <div className="font-mono text-3xl font-bold text-role-text-primary mb-4">
                  $299
                </div>
                <ul className="text-role-text-secondary text-sm space-y-2 mb-6 text-left">
                  <li>• Full AI Business Intelligence</li>
                  <li>• 250 Directory Submissions</li>
                  <li>• Advanced Reports</li>
                </ul>
                <Button variant="primary" className="w-full">
                  Get Started
                </Button>
              </div>
            </Card>

            {/* Professional Plan */}
            <Card variant="artifact">
              <div className="text-center">
                <h3 className="text-xl font-bold text-role-text-primary mb-2">Professional</h3>
                <div className="font-mono text-3xl font-bold text-role-text-primary mb-4">
                  $499
                </div>
                <ul className="text-role-text-secondary text-sm space-y-2 mb-6 text-left">
                  <li>• Enterprise Intelligence Suite</li>
                  <li>• 400 Directory Submissions</li>
                  <li>• White-label Reports</li>
                </ul>
                <Button variant="secondary" className="w-full">
                  Get Started
                </Button>
              </div>
            </Card>
          </div>

          {/* Proof Snippet - Redacted Report Thumbnail */}
          <div className="text-center">
            <Card variant="subtle" className="max-w-md mx-auto">
              <div className="aspect-[4/3] bg-neutral-100 rounded-artifactSm mb-4 flex items-center justify-center">
                <span className="text-role-text-muted text-xs font-mono">[REPORT PREVIEW]</span>
              </div>
              <p className="text-role-text-secondary text-sm">
                Sample report page from Growth package
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Free Analysis CTA Section */}
      <section className="bg-role-bg-secondary py-16 md:py-24">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-role-text-primary mb-4 text-center">
            Get Your Free Analysis
          </h2>
          <p className="text-role-text-secondary text-center mb-8">
            See your business intelligence report preview instantly
          </p>

          {/* Form Preview */}
          <Card variant="artifact" className="mb-8">
            <form className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-role-text-primary text-sm font-medium mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  id="url"
                  className="w-full px-4 py-3 border border-role-border-default rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 focus:border-volt-500 text-role-text-primary bg-role-bg-surface"
                  placeholder="https://example.com"
                />
              </div>
              <Button variant="primary" className="w-full">
                Generate Free Report
              </Button>
            </form>
          </Card>

          {/* Proof Snippet - First Page Preview */}
          <div className="text-center">
            <Card variant="subtle" className="max-w-md mx-auto">
              <div className="aspect-[4/3] bg-neutral-100 rounded-artifactSm mb-4 flex items-center justify-center">
                <span className="text-role-text-muted text-xs font-mono">[FIRST PAGE PREVIEW]</span>
              </div>
              <p className="text-role-text-secondary text-sm">
                Preview of your free analysis first page
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
