import Link from 'next/link'
import { DirectoryGuideData } from '../../lib/guides/contentManager'

interface BreadcrumbsProps {
  guide: DirectoryGuideData
}

export function Breadcrumbs({ guide }: BreadcrumbsProps) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://directorybolt.com'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: 'https://directorybolt.com/guides'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: guide.title,
        item: `https://directorybolt.com/guides/${guide.slug}`
      }
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      
      <nav className="bg-secondary-800/30 backdrop-blur-sm border-b border-secondary-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link 
                href="/"
                className="text-secondary-400 hover:text-volt-400 transition-colors"
              >
                Home
              </Link>
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 text-secondary-500 mx-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
              <Link 
                href="/guides"
                className="text-secondary-400 hover:text-volt-400 transition-colors"
              >
                Guides
              </Link>
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 text-secondary-500 mx-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="text-volt-400 font-medium truncate">
                {guide.title}
              </span>
            </li>
          </ol>
        </div>
      </nav>
    </>
  )
}