export default function TestimonialsSection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-secondary-800 text-center">
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-success-500/20 to-success-600/10 border border-success-500/30 px-4 py-2 rounded-full text-sm font-bold text-success-300 mb-6 backdrop-blur-sm">
          <span>💰</span>
          Businesses Saving $3,000+ on One-Time Investment vs. Consultant Projects
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-volt-400">Made the Smart One-Time Investment in DirectoryBolt</h2>
        
        {/* Social proof numbers */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-volt-400">$3,200</div>
            <div className="text-xs sm:text-sm text-secondary-400">Average Project Savings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-volt-400">93%</div>
            <div className="text-xs sm:text-sm text-secondary-400">Cost Reduction vs. Consultant Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-volt-400">30 Days</div>
            <div className="text-xs sm:text-sm text-secondary-400">ROI Payback Period</div>
          </div>
        </div>
        <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto">
          <blockquote className="italic text-secondary-300 bg-secondary-700 p-4 sm:p-6 lg:p-8 rounded-lg transform hover:scale-105 transition-all duration-300 hover:shadow-xl border border-volt-500/10 group hover:border-volt-500/30">
            <p className="text-sm sm:text-base lg:text-lg mb-4 group-hover:text-secondary-200 transition-colors">&quot;We were quoted $4,200 for a business analysis consultant project. DirectoryBolt's AI gave us <span className="text-volt-400 font-bold">better insights for a $299 one-time investment</span>. Saved us $3,900 and we own the intelligence forever.&quot;</p>
            <cite className="text-volt-400 font-medium not-italic group-hover:text-volt-300 transition-colors">— Michael Rodriguez, Tech Startup CEO</cite>
            <div className="mt-2 text-xs text-success-400 font-bold">Saved $3,900 vs. Consultant Project</div>
          </blockquote>
          <blockquote className="italic text-secondary-300 bg-secondary-700 p-4 sm:p-6 lg:p-8 rounded-lg transform hover:scale-105 transition-all duration-300 hover:shadow-xl border border-volt-500/10 group hover:border-volt-500/30">
            <p className="text-sm sm:text-base lg:text-lg mb-4 group-hover:text-secondary-200 transition-colors">&quot;DirectoryBolt replaced our $2,500 market research project quote and $1,800 SEO consultant project fee. Our <span className="text-volt-400 font-bold">$299 one-time investment paid for itself immediately</span> with better leads and we own the intelligence forever.&quot;</p>
            <cite className="text-volt-400 font-medium not-italic group-hover:text-volt-300 transition-colors">— Lisa Thompson, E-commerce Business Owner</cite>
            <div className="mt-2 text-xs text-success-400 font-bold">ROI: One-time investment vs. $4,300 in project fees</div>
          </blockquote>
          <blockquote className="italic text-secondary-300 bg-secondary-700 p-4 sm:p-6 lg:p-8 rounded-lg transform hover:scale-105 transition-all duration-300 hover:shadow-xl border border-volt-500/10 group hover:border-volt-500/30">
            <p className="text-sm sm:text-base lg:text-lg mb-4 group-hover:text-secondary-200 transition-colors">&quot;Our agency was paying $5,000+ per client for outsourced business intelligence projects. DirectoryBolt's <span className="text-volt-400 font-bold">$799 one-time investment now delivers enterprise-level insights for all our clients</span> and increased our profit margins by 300%.&quot;</p>
            <cite className="text-volt-400 font-medium not-italic group-hover:text-volt-300 transition-colors">— David Park, Marketing Agency Owner</cite>
            <div className="mt-2 text-xs text-success-400 font-bold">ROI: One $799 investment replaced $5,000+ per client costs</div>
          </blockquote>
          <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-4 sm:p-6 mt-8 max-w-2xl mx-auto">
            <p className="font-semibold text-volt-400 text-base sm:text-lg mb-2">💼 Enterprise-Level Business Intelligence Platform</p>
            <p className="text-xs sm:text-sm text-secondary-300">Join 500+ businesses that made the smart one-time investment vs. expensive consultant projects</p>
          </div>
        </div>
      </div>
    </section>
  )
}