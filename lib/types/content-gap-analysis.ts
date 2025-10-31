export interface CompetitorContent {
  url: string
  title: string
  score: number
}

export interface GapAnalysisResult {
  missingKeywords: string[]
  overlapScore: number
}
