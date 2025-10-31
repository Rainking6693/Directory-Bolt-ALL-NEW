import { useState } from 'react'
import { DirectoryGuideData } from '../../lib/guides/contentManager'

interface ShareButtonProps {
  guide: DirectoryGuideData
}

export function ShareButton({ guide }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `https://directorybolt.com/guides/${guide.slug}`
  const shareTitle = guide.title

  const shareLinks = [
    {
      name: 'Twitter',
      icon: '🐦',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'LinkedIn',
      icon: '💼',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    }
  ]

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      // Track share event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'share', {
          method: 'copy_link',
          content_type: 'guide',
          item_id: guide.slug
        })
      }
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleShareClick = (platform: string, url: string) => {
    window.open(url, '_blank', 'width=600,height=400')
    
    // Track share event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'share', {
        method: platform.toLowerCase(),
        content_type: 'guide',
        item_id: guide.slug
      })
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-700 text-secondary-300 rounded-lg hover:bg-secondary-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
        </svg>
        Share
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-secondary-800 border border-secondary-700 rounded-lg shadow-xl z-50">
          <div className="p-2">
            {shareLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleShareClick(link.name, link.url)}
                className="w-full flex items-center gap-3 px-3 py-2 text-secondary-300 hover:bg-secondary-700 rounded-md transition-colors"
              >
                <span className="text-lg">{link.icon}</span>
                {link.name}
              </button>
            ))}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-3 py-2 text-secondary-300 hover:bg-secondary-700 rounded-md transition-colors"
            >
              <span className="text-lg">🔗</span>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}