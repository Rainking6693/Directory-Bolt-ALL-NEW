import Link from 'next/link'
import { DirectoryGuideData } from '../../lib/guides/contentManager'

interface RelatedGuidesProps {
  guides: DirectoryGuideData[]
}

export function RelatedGuides({ guides }: RelatedGuidesProps) {
  if (!guides.length) return null

  return (
    <div className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Related Guides</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group block"
            onClick={() => {
              // Track related guide click
              if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'related_guide_click', {
                  source_guide: window.location.pathname.split('/').pop(),
                  target_guide: guide.slug
                })
              }
            }}
          >
            <div className="bg-secondary-700/50 border border-secondary-600/50 rounded-lg overflow-hidden hover:border-volt-500/50 transition-colors">
              {guide.featuredImage && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={guide.featuredImage}
                    alt={guide.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-volt-500/20 text-volt-400 border border-volt-500/30">
                    {guide.category}
                  </span>
                  <span className="text-secondary-500 text-xs">
                    {guide.estimatedReadTime}
                  </span>
                </div>
                
                <h3 className="font-semibold text-white group-hover:text-volt-400 transition-colors line-clamp-2 mb-2">
                  {guide.title}
                </h3>
                
                <p className="text-secondary-400 text-sm line-clamp-2 mb-3">
                  {guide.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary-500">
                    Updated {new Date(guide.updatedAt).toLocaleDateString()}
                  </span>
                  <svg className="w-4 h-4 text-volt-400 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}