// 🔍 CONTENT GAP ANALYZER SERVICE
// Advanced content gap analysis using AI to identify competitor content opportunities

import OpenAI from 'openai'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'
import type { CompetitorContent, GapAnalysisResult } from '@/lib/types/content-gap-analysis'

interface ContentGapAnalysisOptions {
  userTier: 'professional' | 'enterprise'
  analysisDepth: 'standard' | 'comprehensive'
}

interface WebsiteContent {
  domain: string
  title: string
  description: string
  content: string
  headings: string[]
  keywords: string[]
  pages: CompetitorContent[]
}

export class ContentGapAnalyzer {
  private openai: OpenAI | null = null
  private isInitialized = false

  constructor() {
    this.initializeOpenAI()
  }

  private initializeOpenAI(): void {
    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        logger.warn('OpenAI API key not found - Content Gap Analysis will be limited')
        return
      }

      this.openai = new OpenAI({
        apiKey,
        timeout: 60000
      })

      this.isInitialized = true
      logger.info('Content Gap Analyzer initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize OpenAI for Content Gap Analysis', {}, error as Error)
    }
  }

  async analyzeContentGaps(
    targetWebsite: string,
    _options: ContentGapAnalysisOptions
  ): Promise<GapAnalysisResult> {
    if (!this.isInitialized || !this.openai) {
      throw new Error('Content Gap Analyzer not properly initialized')
    }

    try {
      const targetContent = await this.scrapeWebsiteContent(targetWebsite)
      const competitors = await this.identifyCompetitors(targetContent)
      const missingKeywords = this.findMissingKeywords(targetContent, competitors)
      const overlapScore = this.calculateOverlapScore(targetContent, competitors)

      return {
        missingKeywords,
        overlapScore
      }
    } catch (error) {
      logger.error('Content Gap Analysis failed', { targetWebsite }, error as Error)
      throw error
    }
  }

  private async scrapeWebsiteContent(url: string): Promise<WebsiteContent> {
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
      const response = await axios.get(normalizedUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'DirectoryBolt-ContentGapAnalyzer/1.0'
        }
      })

      const $ = cheerio.load(response.data) as cheerio.CheerioAPI as cheerio.CheerioAPI

      const title = $('title').text().trim()
      const description = $('meta[name="description"]').attr('content') || ''
      const headings: string[] = []
      $('h1, h2, h3, h4, h5, h6').each((_, element) => {
        const heading = $(element).text().trim()
        if (heading) headings.push(heading)
      })

      const content = $('main, article, .content')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim() || $('body').text().replace(/\s+/g, ' ').trim()

      const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || []
      const domain = new URL(normalizedUrl).hostname
      const pages = await this.discoverWebsitePages(normalizedUrl, response.data)

      return {
        domain,
        title,
        description,
        content: content.substring(0, 2000),
        headings,
        keywords,
        pages
      }
    } catch (error) {
      logger.error('Failed to scrape website content', { url }, error as Error)
      throw new Error(`Unable to analyze website: ${url}`)
    }
  }

  private async discoverWebsitePages(baseUrl: string, html: string): Promise<CompetitorContent[]> {
    const pages: CompetitorContent[] = []
    const domain = new URL(baseUrl).hostname
    const links = new Set<string>()
    const $ = cheerio.load(html) as cheerio.CheerioAPI as cheerio.CheerioAPI

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')
      if (href && href.includes(domain)) {
        links.add(href.startsWith('http') ? href : new URL(href, baseUrl).href)
      }
    })

    for (const pageUrl of Array.from(links).slice(0, 5)) {
      try {
        const pageContent = await axios.get(pageUrl, { timeout: 15000 })
        const $ = cheerio.load(pageContent.data) as cheerio.CheerioAPI;const pageTitle = $('title').text().trim();

        pages.push({
          url: pageUrl,
          title: pageTitle,
          score: pageTitle.length
        })
      } catch (error) {
        logger.debug('Skipping page during discovery', { pageUrl })
      }
    }

    return pages
  }

  private async identifyCompetitors(targetContent: WebsiteContent): Promise<CompetitorContent[]> {
    if (!this.openai) return []

    try {
      const prompt = `List 5 competitor domains for the following business:
Title: ${targetContent.title}
Description: ${targetContent.description}`

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 200
      })

      const response = completion.choices[0]?.message?.content
      if (!response) return []

      return response
        .split('\n')
        .map(domain => domain.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map(domain => ({
          url: `https://${domain}`,
          title: domain,
          score: domain.length
        }))
    } catch (error) {
      logger.warn('Failed to identify competitors', error)
      return []
    }
  }

  private findMissingKeywords(
    targetContent: WebsiteContent,
    competitors: CompetitorContent[]
  ): string[] {
    const competitorTitles = competitors.map(comp => comp.title.toLowerCase())
    return targetContent.headings
      .filter(heading => !competitorTitles.some(title => title.includes(heading.toLowerCase())))
      .slice(0, 10)
  }

  private calculateOverlapScore(
    targetContent: WebsiteContent,
    competitors: CompetitorContent[]
  ): number {
    if (competitors.length === 0) return 0

    const targetKeywords = new Set(targetContent.keywords.map(keyword => keyword.toLowerCase()))
    const competitorKeywords = new Set(
      competitors.flatMap(comp => [comp.title.toLowerCase()])
    )

    const overlap = Array.from(targetKeywords).filter(keyword => competitorKeywords.has(keyword))
    return targetKeywords.size === 0
      ? 0
      : Math.round((overlap.length / targetKeywords.size) * 100)
  }
}
