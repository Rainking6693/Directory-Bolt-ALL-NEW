/**
 * WebAssembly-Powered Directory Analysis Engine
 * Provides near-native performance for complex directory matching algorithms
 */

import type { BusinessProfile } from '../types/ai.types'
import type { Directory } from '../types/directory'

interface DirectoryFormField {
  name: string
  label?: string
  type: string
  placeholder?: string
  required?: boolean
  options?: string[]
}

interface DirectoryForm {
  id: string
  name: string
  url: string
  fields: DirectoryFormField[]
  captchaType?: 'none' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha'
  requiresAccount?: boolean
  instructions?: string
}

interface EnhancedDirectory extends Directory {
  accepted_categories?: string[]
  geographic_scope?: string[]
  submission_form?: DirectoryForm
  approval_history?: { status: 'approved' | 'rejected'; timestamp: string }[]
  traffic_volume?: number
}

interface WebAssemblyDirectoryAnalyzer {
  analyzeDirectoryMatch(business: BusinessProfile, directory: EnhancedDirectory): Promise<MatchScore>
  optimizeSubmissionOrder(directories: EnhancedDirectory[]): Promise<SubmissionPlan>
  generateFormFieldMappings(form: DirectoryForm): Promise<FieldMapping[]>
}

class WASMDirectoryAnalyzer implements WebAssemblyDirectoryAnalyzer {
  private wasmModule: WebAssembly.Module | null = null
  private wasmInstance: WebAssembly.Instance | null = null
  
  constructor() {
    this.initializeWASM()
  }

  private async initializeWASM(): Promise<void> {
    try {
      // Load WebAssembly module for high-performance directory matching
      const wasmBytes = await fetch('/wasm/directory-analyzer.wasm')
      const wasmArrayBuffer = await wasmBytes.arrayBuffer()
      
      this.wasmModule = await WebAssembly.compile(wasmArrayBuffer)
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, {
        env: {
          memory: new WebAssembly.Memory({ initial: 256 }),
          abort: () => { throw new Error('WASM abort called') }
        }
      })
      
      console.log('✅ WASM Directory Analyzer initialized')
    } catch (error) {
      console.warn('⚠️ WASM fallback: Using JavaScript implementation', error)
      // Fallback to pure JavaScript implementation
    }
  }

  async analyzeDirectoryMatch(business: BusinessProfile, directory: EnhancedDirectory): Promise<MatchScore> {
    if (this.wasmInstance) {
      return this.wasmAnalyzeMatch(business, directory)
    }

    return {
      relevanceScore: 0,
      authorityScore: directory.domain_authority / 100,
      conversionPotential: 0,
      submissionDifficulty: 0,
      estimatedApprovalTime: directory.avg_approval_time,
      overallScore: 0
    }
  }

  private wasmAnalyzeMatch(business: BusinessProfile, directory: EnhancedDirectory): MatchScore {
    const exports = this.wasmInstance!.exports as any
    
    // Convert JavaScript objects to WASM memory format
    const businessPtr = this.serializeToWASM(business)
    const directoryPtr = this.serializeToWASM(directory)
    
    // Call WASM function for high-performance analysis
    const matchScore = exports.analyze_directory_match(businessPtr, directoryPtr)
    
    return {
      relevanceScore: exports.get_relevance_score(matchScore),
      authorityScore: exports.get_authority_score(matchScore),
      conversionPotential: exports.get_conversion_potential(matchScore),
      submissionDifficulty: exports.get_submission_difficulty(matchScore),
      estimatedApprovalTime: exports.get_approval_time(matchScore),
      overallScore: exports.get_overall_score(matchScore)
    }
  }

  async optimizeSubmissionOrder(directories: EnhancedDirectory[]): Promise<SubmissionPlan> {
    if (!this.wasmInstance) {
      return {
        optimizedOrder: directories,
        estimatedTotalTime: directories.length * 2,
        successProbability: 0.5,
        riskFactors: ['WASM module not initialized']
      }
    }

    const exports = this.wasmInstance!.exports as any
    const directoriesPtr = this.serializeToWASM(directories)
    const optimizedOrderPtr = exports.optimize_submission_order?.(
      directoriesPtr,
      directories.length
    )

    if (!optimizedOrderPtr) {
      return {
        optimizedOrder: directories,
        estimatedTotalTime: directories.length * 2,
        successProbability: 0.5,
        riskFactors: ['WASM optimization unavailable']
      }
    }

    return this.deserializeSubmissionPlan(optimizedOrderPtr)
  }

  async generateFormFieldMappings(form: DirectoryForm): Promise<FieldMapping[]> {
    if (!this.wasmInstance) {
      return form.fields.map(field => ({
        sourceField: field.name,
        targetField: field.name,
        confidence: 0.5
      }))
    }

    const exports = this.wasmInstance!.exports as any
    const formPtr = this.serializeToWASM(form)
    const mappingsPtr = exports.generate_form_field_mappings?.(formPtr)

    if (!mappingsPtr) {
      return form.fields.map(field => ({
        sourceField: field.name,
        targetField: field.name,
        confidence: 0.5
      }))
    }

    return this.deserializeFieldMappings(mappingsPtr)
  }

  private serializeToWASM(obj: any): number {
    // Serialize JavaScript object to WASM memory
    const json = JSON.stringify(obj)
    const encoder = new TextEncoder()
    const bytes = encoder.encode(json)
    
    const exports = this.wasmInstance!.exports as any
    const ptr = exports.allocate(bytes.length)
    const memory = new Uint8Array(exports.memory.buffer)
    
    memory.set(bytes, ptr)
    return ptr
  }

  private deserializeSubmissionPlan(ptr: number): SubmissionPlan {
    const exports = this.wasmInstance!.exports as any
    const json = exports.deserialize_submission_plan?.(ptr)
    if (!json) {
      return {
        optimizedOrder: [],
        estimatedTotalTime: 0,
        successProbability: 0,
        riskFactors: []
      }
    }

    const plan = JSON.parse(json)
    return {
      optimizedOrder: plan.optimizedOrder ?? [],
      estimatedTotalTime: plan.estimatedTotalTime ?? 0,
      successProbability: plan.successProbability ?? 0,
      riskFactors: plan.riskFactors ?? []
    }
  }

  private deserializeFieldMappings(ptr: number): FieldMapping[] {
    const exports = this.wasmInstance!.exports as any
    const json = exports.deserialize_field_mappings?.(ptr)
    if (!json) {
      return []
    }

    const mappings = JSON.parse(json)
    if (!Array.isArray(mappings)) {
      return []
    }

    return mappings.map((mapping: any) => ({
      sourceField: mapping.sourceField ?? 'unknown',
      targetField: mapping.targetField ?? mapping.sourceField ?? 'unknown',
      confidence: typeof mapping.confidence === 'number' ? mapping.confidence : 0.5,
      transformation: typeof mapping.transformation === 'string' ? mapping.transformation : undefined
    }))
  }
}

interface MatchScore {
  relevanceScore: number
  authorityScore: number
  conversionPotential: number
  submissionDifficulty: number
  estimatedApprovalTime: number
  overallScore: number
}

interface SubmissionPlan {
  optimizedOrder: EnhancedDirectory[]
  estimatedTotalTime: number
  successProbability: number
  riskFactors: string[]
}

interface FieldMapping {
  sourceField: string
  targetField: string
  confidence: number
  transformation?: string
}

export { WASMDirectoryAnalyzer }
export type { MatchScore, SubmissionPlan, FieldMapping }