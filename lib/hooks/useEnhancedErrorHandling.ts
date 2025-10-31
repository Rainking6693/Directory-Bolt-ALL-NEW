import { useState, useEffect, useCallback } from 'react'
import { enhancedErrorHandler, FormValidationRule } from '../services/enhanced-error-handler'

interface UseEnhancedFormOptions {
  formId: string
  userId?: string
  validationRules?: FormValidationRule[]
  autoSave?: boolean
  recoveryEnabled?: boolean
  onError?: (error: Error) => void
  onRetry?: (attempt: number) => void
  onRecovery?: (data: Record<string, any>) => void
}

interface FormState {
  data: Record<string, any>
  errors: Record<string, string[]>
  isValid: boolean
  isDirty: boolean
  isSaving: boolean
  lastSaved?: Date
  changeCount: number
}

interface SubmissionState {
  isSubmitting: boolean
  error?: Error
  retryCount: number
  canRetry: boolean
  recoveryStrategy?: any
}

export function useEnhancedForm(options: UseEnhancedFormOptions) {
  const {
    formId,
    userId,
    validationRules = [],
    autoSave = true,
    recoveryEnabled = true,
    onError,
    onRetry,
    onRecovery
  } = options

  const [formState, setFormState] = useState<FormState>({
    data: {},
    errors: {},
    isValid: true,
    isDirty: false,
    isSaving: false,
    changeCount: 0
  })

  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    isSubmitting: false,
    retryCount: 0,
    canRetry: false
  })

  // Load recovered data on mount
  useEffect(() => {
    if (recoveryEnabled && userId) {
      loadRecoveredData()
    }
  }, [formId, userId, recoveryEnabled])

  // Setup form change tracking
  useEffect(() => {
    if (formState.isDirty && userId) {
      enhancedErrorHandler.trackFormChanges(
        formId,
        userId,
        formState.data,
        autoSave
      )
    }
  }, [formState.data, formState.isDirty, formId, userId, autoSave])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      enhancedErrorHandler.clearFormTracking(formId)
    }
  }, [formId])

  const loadRecoveredData = async () => {
    if (!userId) return

    try {
      const recoveredData = await enhancedErrorHandler.recoverFormData(formId, userId)
      if (recoveredData) {
        setFormState(prev => ({
          ...prev,
          data: recoveredData,
          isDirty: true,
          changeCount: 1
        }))
        onRecovery?.(recoveredData)
      }
    } catch (error) {
      console.error('Failed to load recovered data:', error)
    }
  }

  const updateField = useCallback((field: string, value: any) => {
    setFormState(prev => {
      const newData = { ...prev.data, [field]: value }
      const validation = enhancedErrorHandler.validateForm(newData, validationRules)
      
      return {
        ...prev,
        data: newData,
        errors: validation.errors,
        isValid: validation.isValid,
        isDirty: true,
        changeCount: prev.changeCount + 1
      }
    })
  }, [validationRules])

  const setMultipleFields = useCallback((fields: Record<string, any>) => {
    setFormState(prev => {
      const newData = { ...prev.data, ...fields }
      const validation = enhancedErrorHandler.validateForm(newData, validationRules)
      
      return {
        ...prev,
        data: newData,
        errors: validation.errors,
        isValid: validation.isValid,
        isDirty: true,
        changeCount: prev.changeCount + Object.keys(fields).length
      }
    })
  }, [validationRules])

  const validateForm = useCallback(() => {
    const validation = enhancedErrorHandler.validateForm(formState.data, validationRules)
    
    setFormState(prev => ({
      ...prev,
      errors: validation.errors,
      isValid: validation.isValid
    }))

    return validation.isValid
  }, [formState.data, validationRules])

  const submitWithRetry = useCallback(async (
    submitFunction: () => Promise<any>,
    operationType = 'form_submission'
  ) => {
    if (!formState.isValid) {
      validateForm()
      return Promise.reject(new Error('Form validation failed'))
    }

    setSubmissionState(prev => ({
      ...prev,
      isSubmitting: true,
      retryCount: 0
    }))

    try {
      const result = await enhancedErrorHandler.executeWithRetry(
        submitFunction,
        operationType,
        userId ? {
          userId,
          action: 'form_submission',
          formId,
          metadata: { formData: formState.data },
          timestamp: new Date()
        } : undefined
      )

      setSubmissionState(prev => ({
        ...prev,
        isSubmitting: false,
        retryCount: 0,
        canRetry: false
      }))

      // Clear form tracking on successful submission
      enhancedErrorHandler.clearFormTracking(formId)
      
      setFormState(prev => ({
        ...prev,
        isDirty: false,
        changeCount: 0
      }))

      return result

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const strategy = enhancedErrorHandler.determineRecoveryStrategy(err, userId ? {
        userId,
        action: 'form_submission',
        formId,
        timestamp: new Date()
      } : undefined)

      setSubmissionState(prev => ({
        ...prev,
        isSubmitting: false,
        error: err,
        retryCount: prev.retryCount + 1,
        canRetry: strategy.type === 'retry',
        recoveryStrategy: strategy
      }))

      onError?.(err)
      throw err
    }
  }, [formState, formId, userId, validateForm, onError])

  const retrySubmission = useCallback(async (
    submitFunction: () => Promise<any>,
    operationType = 'form_submission'
  ) => {
    if (!submissionState.canRetry) {
      throw new Error('Retry not available for this error')
    }

    onRetry?.(submissionState.retryCount + 1)
    return submitWithRetry(submitFunction, operationType)
  }, [submissionState, submitWithRetry, onRetry])

  const resetForm = useCallback(() => {
    setFormState({
      data: {},
      errors: {},
      isValid: true,
      isDirty: false,
      isSaving: false,
      changeCount: 0
    })

    setSubmissionState({
      isSubmitting: false,
      retryCount: 0,
      canRetry: false
    })

    enhancedErrorHandler.clearFormTracking(formId)
  }, [formId])

  const getFieldError = useCallback((field: string): string | undefined => {
    return formState.errors[field]?.[0]
  }, [formState.errors])

  const hasFieldError = useCallback((field: string): boolean => {
    return Boolean(formState.errors[field]?.length)
  }, [formState.errors])

  const getFormStats = useCallback(() => {
    return enhancedErrorHandler.getFormChangeStats(formId)
  }, [formId])

  return {
    // Form state
    formData: formState.data,
    errors: formState.errors,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    isSaving: formState.isSaving,
    lastSaved: formState.lastSaved,
    changeCount: formState.changeCount,

    // Submission state
    isSubmitting: submissionState.isSubmitting,
    submissionError: submissionState.error,
    retryCount: submissionState.retryCount,
    canRetry: submissionState.canRetry,
    recoveryStrategy: submissionState.recoveryStrategy,

    // Actions
    updateField,
    setMultipleFields,
    validateForm,
    submitWithRetry,
    retrySubmission,
    resetForm,
    getFieldError,
    hasFieldError,
    getFormStats
  }
}

// Hook for handling async operations with retry logic
export function useRetryOperation() {
  const [state, setState] = useState({
    isExecuting: false,
    error: null as Error | null,
    retryCount: 0,
    canRetry: false
  })

  const execute = useCallback(async (
    operation: () => Promise<any>,
    operationType = 'async_operation',
    context?: any
  ) => {
    setState(prev => ({
      ...prev,
      isExecuting: true,
      error: null,
      retryCount: 0
    }))

    try {
      const result = await enhancedErrorHandler.executeWithRetry(
        operation,
        operationType,
        context
      )

      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: null,
        canRetry: false
      }))

      return result

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const strategy = enhancedErrorHandler.determineRecoveryStrategy(err, context)

      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: err,
        retryCount: prev.retryCount + 1,
        canRetry: strategy.type === 'retry'
      }))

      throw err
    }
  }, [])

  const retry = useCallback(async (
    operation: () => Promise<any>,
    operationType = 'async_operation',
    context?: any
  ) => {
    if (!state.canRetry) {
      throw new Error('Retry not available')
    }
    return execute(operation, operationType, context)
  }, [state.canRetry, execute])

  return {
    isExecuting: state.isExecuting,
    error: state.error,
    retryCount: state.retryCount,
    canRetry: state.canRetry,
    execute,
    retry
  }
}

// Hook for form field validation
export function useFieldValidation(rules: FormValidationRule[]) {
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const validateField = useCallback((field: string, value: any) => {
    const fieldRules = rules.filter(rule => rule.field === field)
    const validation = enhancedErrorHandler.validateForm({ [field]: value }, fieldRules)
    
    setErrors(prev => ({
      ...prev,
      [field]: validation.errors[field] || []
    }))

    return validation.errors[field]?.length === 0
  }, [rules])

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const hasError = useCallback((field: string) => {
    return Boolean(errors[field]?.length)
  }, [errors])

  const getError = useCallback((field: string) => {
    return errors[field]?.[0]
  }, [errors])

  return {
    errors,
    validateField,
    clearFieldError,
    hasError,
    getError
  }
}