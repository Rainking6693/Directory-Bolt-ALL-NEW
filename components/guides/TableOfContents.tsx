import { useState } from 'react'

interface Section {
  id: string
  title: string
  content: string
  tips?: string[]
  image?: string
}

interface TableOfContentsProps {
  sections: Section[]
  activeSection: string
}

export function TableOfContents({ sections, activeSection }: TableOfContentsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      
      // Track navigation event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'guide_navigation', {
          method: 'toc_click',
          section: sectionId
        })
      }
    }
  }

  return (
    <div className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Table of Contents</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="lg:hidden text-secondary-400 hover:text-volt-400 transition-colors"
        >
          <svg 
            className={`w-5 h-5 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      <nav className={`${isCollapsed ? 'hidden lg:block' : 'block'}`}>
        <ol className="space-y-2">
          {sections.map((section, index) => (
            <li key={section.id}>
              <button
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                  activeSection === section.id
                    ? 'bg-volt-500/20 text-volt-400 border-l-2 border-volt-500'
                    : 'text-secondary-300 hover:text-volt-400 hover:bg-secondary-700/30'
                }`}
              >
                <span className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    activeSection === section.id
                      ? 'bg-volt-500 text-secondary-900'
                      : 'bg-secondary-700 text-secondary-400'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="leading-tight">{section.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Progress Indicator */}
      <div className="mt-6 pt-4 border-t border-secondary-700">
        <div className="flex items-center justify-between text-xs text-secondary-400 mb-2">
          <span>Progress</span>
          <span>{Math.round((sections.findIndex(s => s.id === activeSection) + 1) / sections.length * 100)}%</span>
        </div>
        <div className="w-full bg-secondary-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-volt-400 to-volt-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(sections.findIndex(s => s.id === activeSection) + 1) / sections.length * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}