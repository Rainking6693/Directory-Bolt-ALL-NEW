import { useState, useEffect } from 'react'
import { DirectoryGuideData } from '../../lib/guides/contentManager'

interface BookmarkButtonProps {
  guide: DirectoryGuideData
}

export function BookmarkButton({ guide }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if guide is bookmarked in localStorage
    const bookmarks = JSON.parse(localStorage.getItem('guideBookmarks') || '[]')
    setIsBookmarked(bookmarks.includes(guide.slug))
  }, [guide.slug])

  const handleToggleBookmark = async () => {
    setIsLoading(true)
    
    try {
      const bookmarks = JSON.parse(localStorage.getItem('guideBookmarks') || '[]')
      let updatedBookmarks: string[]

      if (isBookmarked) {
        updatedBookmarks = bookmarks.filter((slug: string) => slug !== guide.slug)
      } else {
        updatedBookmarks = [...bookmarks, guide.slug]
      }

      localStorage.setItem('guideBookmarks', JSON.stringify(updatedBookmarks))
      setIsBookmarked(!isBookmarked)

      // Track bookmark event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', isBookmarked ? 'remove_bookmark' : 'add_bookmark', {
          content_type: 'guide',
          item_id: guide.slug
        })
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggleBookmark}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isBookmarked
          ? 'bg-volt-500/20 text-volt-400 border border-volt-500/30'
          : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600'
      }`}
    >
      <svg 
        className={`w-4 h-4 ${isBookmarked ? 'fill-current' : 'stroke-current'}`} 
        fill={isBookmarked ? 'currentColor' : 'none'}
        stroke={isBookmarked ? 'none' : 'currentColor'}
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
        />
      </svg>
      {isLoading ? 'Saving...' : isBookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}