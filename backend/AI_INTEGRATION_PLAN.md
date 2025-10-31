# AI Features Integration Plan

## Overview

Integrating AI features from the previous JavaScript-based DirectoryBolt website into the new Python backend system.

## AI Services from Previous System

### 1. **AIFormMapper** ✅ PORTED
- **Purpose**: Intelligent form field detection and mapping for directory submission pages
- **Features**:
  - Pattern matching for common field types
  - AI-powered analysis for unknown fields
  - Learning system that improves over time
  - Confidence scoring for field mappings
- **Status**: Ported to `ai/form_mapper.py`
- **Integration**: Will be used in `workers/submission_runner.py` to dynamically map form fields

### 2. **DescriptionCustomizer** 🔄 TODO
- **Purpose**: Customizes business descriptions for specific directories using AI
- **Features**:
  - Directory-specific content optimization
  - Multiple style variations (professional, friendly, technical, etc.)
  - Keyword optimization based on directory preferences
  - Success pattern analysis from historical submissions
- **Status**: To be ported
- **Integration**: Will be called before submission to customize content per directory

### 3. **IntelligentRetryAnalyzer** 🔄 TODO
- **Purpose**: Analyzes submission failures and determines optimal retry strategies
- **Features**:
  - Failure reason categorization using AI
  - Retry probability prediction
  - Optimal retry timing calculation
  - Content improvement suggestions
- **Status**: To be ported
- **Integration**: Will be used in Prefect flows when submissions fail

### 4. **SuccessProbabilityCalculator** 🔄 TODO
- **Purpose**: Calculates probability of successful directory submission
- **Features**:
  - Multi-factor success prediction
  - Historical submission data analysis
  - Directory-specific success patterns
  - Business profile compatibility scoring
- **Status**: To be ported
- **Integration**: Will be used to prioritize jobs in the queue

### 5. **SubmissionTimingOptimizer** 🔄 TODO
- **Purpose**: Optimizes submission timing based on directory patterns
- **Features**:
  - Directory-specific timing pattern analysis
  - Peak/off-peak submission optimization
  - Success rate correlation with timing
  - Automated scheduling recommendations
- **Status**: To be ported
- **Integration**: Will be used to schedule submissions at optimal times

### 6. **AISubmissionOrchestrator** 🔄 TODO
- **Purpose**: Orchestrates all AI services together
- **Features**:
  - Coordinates all AI services
  - Circuit breaker patterns for reliability
  - Service health monitoring
  - Fallback strategies
- **Status**: To be ported
- **Integration**: High-level orchestration layer for Prefect flows

### 7. **AIEnhancedQueueManager** 🔄 TODO
- **Purpose**: AI-enhanced queue management with intelligent prioritization
- **Features**:
  - AI-driven priority scoring
  - Success probability-based queue ordering
  - Dynamic priority adjustment
- **Status**: To be ported
- **Integration**: Will enhance the SQS queue subscriber

## Integration Strategy

### Phase 1: Core AI Services (Current)
1. ✅ Port AIFormMapper - Form field detection
2. 🔄 Port DescriptionCustomizer - Content customization
3. 🔄 Port IntelligentRetryAnalyzer - Failure analysis

### Phase 2: Predictive Services
4. 🔄 Port SuccessProbabilityCalculator - Success prediction
5. 🔄 Port SubmissionTimingOptimizer - Timing optimization

### Phase 3: Orchestration
6. 🔄 Port AISubmissionOrchestrator - Service coordination
7. 🔄 Integrate with Prefect flows
8. 🔄 Integrate with submission runner

## Integration Points

### Prefect Flows (`orchestration/flows.py`)
- Use `SuccessProbabilityCalculator` to prioritize directories
- Use `SubmissionTimingOptimizer` to schedule submissions
- Use `IntelligentRetryAnalyzer` on failures

### Submission Runner (`workers/submission_runner.py`)
- Use `AIFormMapper` to detect form fields dynamically
- Use `DescriptionCustomizer` to customize content per directory
- Store form mappings for future use

### Queue Subscriber (`orchestration/subscriber.py`)
- Use `SuccessProbabilityCalculator` to score jobs
- Use `AIEnhancedQueueManager` for intelligent prioritization

## Dependencies

### Already Installed
- `anthropic==0.8.0` - Claude AI API
- `supabase==2.3.0` - Database access

### New Dependencies Added
- `beautifulsoup4==4.12.2` - HTML parsing for form mapping
- `lxml==4.9.3` - Fast XML/HTML parser

## Next Steps

1. ✅ Complete AIFormMapper port (DONE)
2. Port DescriptionCustomizer
3. Port IntelligentRetryAnalyzer  
4. Port SuccessProbabilityCalculator
5. Port SubmissionTimingOptimizer
6. Integrate into Prefect flows
7. Integrate into submission runner
8. Add configuration for enabling/disabling AI features

## Configuration

AI features will be controlled via environment variables:
- `ENABLE_AI_FEATURES=true` - Master switch
- `ENABLE_FORM_MAPPING=true` - Enable AI form mapping
- `ENABLE_CONTENT_CUSTOMIZATION=true` - Enable content customization
- `ENABLE_RETRY_ANALYSIS=true` - Enable intelligent retry analysis
- `ENABLE_SUCCESS_PREDICTION=true` - Enable success probability calculation
- `ENABLE_TIMING_OPTIMIZATION=true` - Enable timing optimization

