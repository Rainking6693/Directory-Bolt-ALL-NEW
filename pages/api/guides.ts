import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

interface Guide {
  id: string
  title: string
  category: string
  difficulty: string
  estimatedReadTime: string
  publishedAt: string
  updatedAt: string
}

// Safe JSON parser with comprehensive error handling for build stability
function safeJsonParse(content: string, filename: string): any | null {
  try {
    // Check for empty or whitespace-only content
    if (!content || !content.trim()) {
      console.warn(`Empty JSON file detected: ${filename}`)
      return null
    }

    // Check for incomplete JSON (common cause of "Unexpected end of JSON input")
    const trimmed = content.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      console.warn(`Malformed JSON structure in file: ${filename}`)
      return null
    }

    // Attempt to parse JSON
    const parsed = JSON.parse(content)
    
    // Validate that parsed result is an object
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn(`Invalid JSON object in file: ${filename}`)
      return null
    }

    return parsed
  } catch (error) {
    console.error(`JSON parsing error in file ${filename}:`, error)
    return null
  }
}

// Safe file reader with error handling
function safeReadFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File does not exist: ${filePath}`)
      return null
    }

    const stats = fs.statSync(filePath)
    if (stats.size === 0) {
      console.warn(`Empty file detected: ${filePath}`)
      return null
    }

    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    console.error(`File reading error for ${filePath}:`, error)
    return null
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const guidesDirectory = path.join(process.cwd(), 'data', 'guides')
    
    // Check if guides directory exists
    if (!fs.existsSync(guidesDirectory)) {
      console.warn('Guides directory does not exist, returning empty array')
      return res.status(200).json({
        success: true,
        count: 0,
        guides: [],
        message: 'No guides directory found'
      })
    }

    // Read directory contents safely
    let guideFiles: string[] = []
    try {
      guideFiles = fs.readdirSync(guidesDirectory).filter(file => file.endsWith('.json'))
    } catch (error) {
      console.error('Error reading guides directory:', error)
      return res.status(200).json({
        success: true,
        count: 0,
        guides: [],
        message: 'Error reading guides directory'
      })
    }

    const guides: Guide[] = []
    const errors: string[] = []

    // Process each guide file with comprehensive error handling
    for (const file of guideFiles) {
      try {
        const filePath = path.join(guidesDirectory, file)
        
        // Safe file reading
        const fileContent = safeReadFile(filePath)
        if (!fileContent) {
          errors.push(`Failed to read file: ${file}`)
          continue
        }

        // Safe JSON parsing
        const guide = safeJsonParse(fileContent, file)
        if (!guide) {
          errors.push(`Failed to parse JSON in file: ${file}`)
          continue
        }

        // Extract and validate guide information
        const guideInfo: Guide = {
          id: guide.id || guide.slug || path.basename(file, '.json'),
          title: guide.title || guide.directoryName || 'Untitled Guide',
          category: guide.category || 'General',
          difficulty: guide.difficulty || 'beginner',
          estimatedReadTime: guide.estimatedReadTime || '5 min read',
          publishedAt: guide.publishedAt || new Date().toISOString(),
          updatedAt: guide.updatedAt || new Date().toISOString()
        }

        guides.push(guideInfo)
      } catch (error) {
        console.error(`Unexpected error processing file ${file}:`, error)
        errors.push(`Unexpected error in file: ${file}`)
        continue // Continue processing other files
      }
    }

    // Sort guides by updated date (newest first)
    guides.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    // Return response with success status even if some files failed
    const response = {
      success: true,
      count: guides.length,
      guides: guides,
      totalFiles: guideFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0 ? `Successfully processed ${guides.length} of ${guideFiles.length} guide files` : undefined
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Critical error in guides API:', error)
    
    // Return a safe fallback response to prevent build failures
    res.status(200).json({
      success: false,
      count: 0,
      guides: [],
      error: 'Failed to fetch guides',
      message: 'Critical error occurred, returning empty guides list',
      fallback: true
    })
  }
}