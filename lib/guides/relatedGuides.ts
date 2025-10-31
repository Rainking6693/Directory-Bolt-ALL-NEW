import { DirectoryGuideData, GuideContentManager } from './contentManager'

export async function getRelatedGuides(
  currentGuide: DirectoryGuideData,
  limit: number = 3
): Promise<DirectoryGuideData[]> {
  const contentManager = new GuideContentManager()
  const allGuides = await contentManager.getAllGuides()
  
  // Filter out current guide
  const otherGuides = allGuides.filter(guide => guide.slug !== currentGuide.slug)
  
  // Calculate similarity scores
  const scoredGuides = otherGuides.map(guide => ({
    guide,
    score: calculateSimilarityScore(currentGuide, guide)
  }))
  
  // Sort by score and return top guides
  return scoredGuides
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.guide)
}

function calculateSimilarityScore(guide1: DirectoryGuideData, guide2: DirectoryGuideData): number {
  let score = 0
  
  // Same category gets high score
  if (guide1.category === guide2.category) {
    score += 50
  }
  
  // Same difficulty level
  if (guide1.difficulty === guide2.difficulty) {
    score += 20
  }
  
  // Keyword overlap
  const commonKeywords = guide1.seo.keywords.filter(keyword => 
    guide2.seo.keywords.includes(keyword)
  )
  score += commonKeywords.length * 10
  
  // Directory name similarity (for related directories)
  if (guide1.directoryName.toLowerCase().includes(guide2.directoryName.toLowerCase()) ||
      guide2.directoryName.toLowerCase().includes(guide1.directoryName.toLowerCase())) {
    score += 30
  }
  
  // Title/description text similarity (basic implementation)
  const guide1Text = (guide1.title + ' ' + guide1.description).toLowerCase()
  const guide2Text = (guide2.title + ' ' + guide2.description).toLowerCase()
  const words1 = new Set(guide1Text.split(/\s+/))
  const words2 = new Set(guide2Text.split(/\s+/))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  const textSimilarity = intersection.size / union.size
  score += textSimilarity * 25
  
  return score
}

export function generateInternalLinks(guides: DirectoryGuideData[]): Map<string, string[]> {
  const linkMap = new Map<string, string[]>()
  
  for (const guide of guides) {
    const relatedSlugs: string[] = []
    
    // Find guides in the same category
    const sameCategory = guides.filter(g => 
      g.slug !== guide.slug && g.category === guide.category
    ).slice(0, 3)
    
    relatedSlugs.push(...sameCategory.map(g => g.slug))
    
    // Find guides with overlapping keywords
    const keywordMatches = guides.filter(g => 
      g.slug !== guide.slug && 
      !relatedSlugs.includes(g.slug) &&
      g.seo.keywords.some(keyword => guide.seo.keywords.includes(keyword))
    ).slice(0, 2)
    
    relatedSlugs.push(...keywordMatches.map(g => g.slug))
    
    linkMap.set(guide.slug, relatedSlugs)
  }
  
  return linkMap
}

export async function updateAllInternalLinks(): Promise<void> {
  const contentManager = new GuideContentManager()
  const guides = await contentManager.getAllGuides()
  const linkMap = generateInternalLinks(guides)
  
  const updates = Array.from(linkMap.entries()).map(([slug, relatedGuides]) => ({
    slug,
    data: {
      internalLinks: {
        relatedGuides,
        relatedDirectories: [] // Could be populated from directory data
      }
    }
  }))
  
  await contentManager.batchUpdate(updates)
}