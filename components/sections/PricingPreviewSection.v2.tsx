import { Button } from '../../redesign-v2/components/ui/Button'
import { Card } from '../../redesign-v2/components/ui/Card'
import { Badge } from '../../redesign-v2/components/ui/Badge'
import { Link } from '../../redesign-v2/components/ui/Link'

export default function PricingPreviewSection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 max-w-7xl mx-auto bg-role-bg-primary">
      <div className="text-center mb-12">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 text-role-text-primary">One-Time Purchase Business Intelligence Plans</h2>
        <p className="text-role-text-secondary mb-8 max-w-3xl mx-auto text-lg">
          Stop paying $3,000+ for consultant projects. <strong className="text-role-text-primary">Pay once, own forever.</strong> Get enterprise-level AI insights and automated growth strategies with one strategic investment.
        </p>
        
        {/* Market Comparison */}
        <div className="bg-role-bg-secondary border border-role-border-default rounded-artifact p-6 mb-8 max-w-4xl mx-auto">
          <h3 className="text-role-text-primary font-bold mb-4">Market Comparison: What Others Charge</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-role-text-primary mb-1">$2,500-5,000</div>
              <div className="text-role-text-secondary">Consultant Projects</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-role-text-primary mb-1">$1,200-3,000</div>
              <div className="text-role-text-secondary">Market Research Projects</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-role-text-primary mb-1">$800-1,500</div>
              <div className="text-role-text-secondary">Directory Project Fees</div>
            </div>
          </div>
          <div className="text-center font-mono text-xl font-bold text-role-text-primary">
            DirectoryBolt: $149-799 ONE-TIME → Save 93%
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 max-w-7xl mx-auto">
        {/* Starter Intelligence Plan */}
        <Card variant="artifact">
          <div className="text-center">
            <h3 className="text-xl font-bold text-role-text-primary mb-2">Starter Intelligence</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-role-text-tertiary line-through">$2,700</span>
              <div className="font-mono text-3xl font-black text-role-text-primary">$149</div>
            </div>
            <div className="text-success-500 font-bold text-sm mb-4">Save 94% vs. Consultant Projects</div>
            <ul className="text-xs text-role-text-secondary space-y-2 mb-6 text-left">
              <li>• <strong className="text-role-text-primary">AI Market Analysis</strong> (Worth $1,500)</li>
              <li>• <strong className="text-role-text-primary">100 Directory Submissions</strong> (Worth $400)</li>
              <li>• <strong className="text-role-text-primary">Competitor Intelligence</strong> (Worth $800)</li>
              <li>• Basic optimization reports</li>
              <li>• Email support</li>
            </ul>
            <Button variant="secondary" className="w-full">
              Get Full Analysis - $149
            </Button>
          </div>
        </Card>

        {/* Growth Intelligence Plan - Most Popular */}
        <Card variant="artifact" className="border-2 border-volt-200 bg-volt-50 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <Badge variant="volt">Most Popular</Badge>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-role-text-primary mb-2">Growth Intelligence</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-role-text-tertiary line-through">$4,300</span>
              <div className="font-mono text-3xl font-black text-role-text-primary">$299</div>
            </div>
            <div className="text-success-500 font-bold text-sm mb-4">Save 93% vs. Consultant Projects</div>
            <ul className="text-xs text-role-text-secondary space-y-2 mb-6 text-left">
              <li>• <strong className="text-role-text-primary">Full AI Business Intelligence</strong> (Worth $2,000)</li>
              <li>• <strong className="text-role-text-primary">250 Premium Directory Submissions</strong> (Worth $1,000)</li>
              <li>• <strong className="text-role-text-primary">Advanced Competitor Analysis</strong> (Worth $1,200)</li>
              <li>• <strong className="text-role-text-primary">Growth Strategy Reports</strong> (Worth $800)</li>
              <li>• Priority support & optimization</li>
            </ul>
            <Button variant="primary" className="w-full">
              Get Full Analysis - $299
            </Button>
          </div>
        </Card>

        {/* Professional Intelligence Plan */}
        <Card variant="artifact">
          <div className="text-center">
            <h3 className="text-xl font-bold text-role-text-primary mb-2">Professional Intelligence</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-role-text-tertiary line-through">$7,500</span>
              <div className="font-mono text-3xl font-black text-role-text-primary">$499</div>
            </div>
            <div className="text-success-500 font-bold text-sm mb-4">Save 93% vs. Consultant Projects</div>
            <ul className="text-xs text-role-text-secondary space-y-2 mb-6 text-left">
              <li>• <strong className="text-role-text-primary">Enterprise AI Intelligence Suite</strong> (Worth $3,000)</li>
              <li>• <strong className="text-role-text-primary">400 Premium Directory Network</strong> (Worth $1,500)</li>
              <li>• <strong className="text-role-text-primary">Deep Market Intelligence</strong> (Worth $2,000)</li>
              <li>• <strong className="text-role-text-primary">White-label Reports</strong> (Worth $1,000)</li>
              <li>• Dedicated account manager</li>
            </ul>
            <Button variant="secondary" className="w-full">
              Get Full Analysis - $499
            </Button>
          </div>
        </Card>

        {/* Enterprise Intelligence Plan */}
        <Card variant="artifact">
          <div className="text-center">
            <h3 className="text-xl font-bold text-role-text-primary mb-2">Enterprise Intelligence</h3>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-role-text-tertiary line-through">$9,700</span>
              <div className="font-mono text-3xl font-black text-role-text-primary">$799</div>
            </div>
            <div className="text-success-500 font-bold text-sm mb-4">Save 92% vs. Consultant Projects</div>
            <ul className="text-xs text-role-text-secondary space-y-2 mb-6 text-left">
              <li>• <strong className="text-role-text-primary">Complete AI Intelligence Platform</strong> (Worth $4,000)</li>
              <li>• <strong className="text-role-text-primary">500+ Premium Directory Network</strong> (Worth $2,000)</li>
              <li>• <strong className="text-role-text-primary">Advanced Market Intelligence</strong> (Worth $2,500)</li>
              <li>• <strong className="text-role-text-primary">Custom White-label Reports</strong> (Worth $1,200)</li>
              <li>• Dedicated success manager + SLA</li>
            </ul>
            <Button variant="secondary" className="w-full">
              Get Full Analysis - $799
            </Button>
          </div>
        </Card>
      </div>

      <div className="text-center">
        <Link
          href="/pricing"
          className="text-role-text-primary hover:text-volt-600 font-medium text-lg underline underline-offset-4 hover:underline-offset-8 transition-all duration-300"
        >
          View Full Pricing Details & Features →
        </Link>
      </div>
    </section>
  )
}
