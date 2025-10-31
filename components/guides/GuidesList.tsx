import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DirectoryGuideData } from '../../lib/guides/contentManager'

interface GuidesListProps {
  guides: DirectoryGuideData[]
  categories: string[]
}

export default function GuidesList({ guides, categories }: GuidesListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'alphabetical'>('newest')

  const filteredAndSortedGuides = useMemo(() => {
    let filtered = guides

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(guide => guide.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(guide =>
        guide.title.toLowerCase().includes(query) ||
        guide.description.toLowerCase().includes(query) ||
        guide.directoryName.toLowerCase().includes(query)
      )
    }

    // Sort guides
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case 'popular':
        filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        break
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return filtered
  }, [guides, selectedCategory, searchQuery, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Filters */}
      <div className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:border-volt-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-volt-500 text-secondary-900'
                  : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
              }`}
            >
              All ({guides.length})
            </button>
            {categories.map((category) => {
              const count = guides.filter(guide => guide.category === category).length
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
                  }`}
                >
                  {category} ({count})
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500"
          >
            <option value="newest">Newest First</option>
            <option value="popular">Most Popular</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-6">
        <p className="text-secondary-400">
          Showing {filteredAndSortedGuides.length} of {guides.length} guides
          {selectedCategory !== 'all' && ` in "${selectedCategory}"`}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Guides Grid */}
      {filteredAndSortedGuides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group block"
              onClick={() => {
                // Track guide click from listing
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'guide_list_click', {
                    guide_name: guide.slug,
                    category: guide.category,
                    position: filteredAndSortedGuides.indexOf(guide) + 1
                  })
                }
              }}
            >
              <article className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl overflow-hidden hover:border-volt-500/50 transition-all duration-300 hover:transform hover:scale-105">
                {guide.featuredImage && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={guide.featuredImage}
                      alt={guide.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-volt-500/20 text-volt-400 border border-volt-500/30">
                      {guide.category}
                    </span>
                    <span className="text-secondary-500 text-xs">
                      {guide.estimatedReadTime}
                    </span>
                    {guide.viewCount && guide.viewCount > 0 && (
                      <div className="flex items-center gap-1 text-secondary-500 text-xs">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                        </svg>
                        {guide.viewCount}
                      </div>
                    )}
                  </div>
                  
                  <h2 className="text-xl font-bold text-white group-hover:text-volt-400 transition-colors line-clamp-2 mb-3">
                    {guide.title}
                  </h2>
                  
                  <p className="text-secondary-400 line-clamp-3 mb-4">
                    {guide.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary-500">
                      Updated {new Date(guide.updatedAt).toLocaleDateString()}
                    </span>
                    
                    <div className="flex items-center gap-2 text-volt-400 group-hover:translate-x-1 transition-transform">
                      <span className="text-sm font-medium">Read Guide</span>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl p-8">
            <svg className="w-16 h-16 text-secondary-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No Guides Found</h3>
            <p className="text-secondary-400 mb-4">
              {searchQuery
                ? `No guides match your search for "${searchQuery}"`
                : `No guides found in the "${selectedCategory}" category`}
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-volt-500 text-secondary-900 font-semibold rounded-lg hover:bg-volt-400 transition-colors"
            >
              View All Guides
            </button>
          </div>
        </div>
      )}
    </div>
  )
}