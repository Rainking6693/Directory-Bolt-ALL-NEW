import { Card } from '../../redesign-v2/components/ui/Card'

export default function TestimonialsSection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-role-bg-secondary text-center">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-role-text-primary">Made the Smart One-Time Investment in DirectoryBolt</h2>
        
        {/* Social proof numbers - Neutral, not Volt */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="font-mono text-2xl sm:text-3xl font-black text-role-text-primary">$3,200</div>
            <div className="text-xs sm:text-sm text-role-text-secondary">Average Project Savings</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl sm:text-3xl font-black text-role-text-primary">93%</div>
            <div className="text-xs sm:text-sm text-role-text-secondary">Cost Reduction vs. Consultant Projects</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl sm:text-3xl font-black text-role-text-primary">30 Days</div>
            <div className="text-xs sm:text-sm text-role-text-secondary">ROI Payback Period</div>
          </div>
        </div>
        
        <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto">
          <Card variant="subtle">
            <blockquote className="text-left">
              <p className="text-sm sm:text-base lg:text-lg mb-4 text-role-text-secondary italic">
                &quot;We were quoted $4,200 for a business analysis consultant project. DirectoryBolt's AI gave us <strong className="text-role-text-primary not-italic">better insights for a $299 one-time investment</strong>. Saved us $3,900 and we own the intelligence forever.&quot;
              </p>
              <cite className="text-role-text-primary font-medium not-italic block mt-4">
                — Michael Rodriguez, Tech Startup CEO
              </cite>
              <div className="mt-2 text-xs text-success-500 font-bold">Saved $3,900 vs. Consultant Project</div>
            </blockquote>
          </Card>
          
          <Card variant="subtle">
            <blockquote className="text-left">
              <p className="text-sm sm:text-base lg:text-lg mb-4 text-role-text-secondary italic">
                &quot;DirectoryBolt replaced our $2,500 market research project quote and $1,800 SEO consultant project fee. Our <strong className="text-role-text-primary not-italic">$299 one-time investment paid for itself immediately</strong> with better leads and we own the intelligence forever.&quot;
              </p>
              <cite className="text-role-text-primary font-medium not-italic block mt-4">
                — Lisa Thompson, E-commerce Business Owner
              </cite>
              <div className="mt-2 text-xs text-success-500 font-bold">ROI: One-time investment vs. $4,300 in project fees</div>
            </blockquote>
          </Card>
          
          <Card variant="subtle">
            <blockquote className="text-left">
              <p className="text-sm sm:text-base lg:text-lg mb-4 text-role-text-secondary italic">
                &quot;Our agency was paying $5,000+ per client for outsourced business intelligence projects. DirectoryBolt's <strong className="text-role-text-primary not-italic">$799 one-time investment now delivers enterprise-level insights for all our clients</strong> and increased our profit margins by 300%.&quot;
              </p>
              <cite className="text-role-text-primary font-medium not-italic block mt-4">
                — David Park, Marketing Agency Owner
              </cite>
              <div className="mt-2 text-xs text-success-500 font-bold">ROI: One $799 investment replaced $5,000+ per client costs</div>
            </blockquote>
          </Card>
          
          <Card variant="subtle" className="bg-volt-50 border-volt-200">
            <p className="font-semibold text-role-text-primary text-base sm:text-lg mb-2">Enterprise-Level Business Intelligence Platform</p>
            <p className="text-xs sm:text-sm text-role-text-secondary">Join 500+ businesses that made the smart one-time investment vs. expensive consultant projects</p>
          </Card>
        </div>
      </div>
    </section>
  )
}
