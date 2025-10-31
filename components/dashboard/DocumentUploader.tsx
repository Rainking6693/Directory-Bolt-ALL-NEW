'use client'
import { useState, useRef, useCallback } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { PendingAction, VerificationFormData, DocumentUpload } from '../../types/dashboard'

interface DocumentUploaderProps {
  action: PendingAction
  onSubmit: (formData: VerificationFormData) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function DocumentUploader({
  action,
  onSubmit,
  onCancel,
  isLoading
}: DocumentUploaderProps) {
  const [uploads, setUploads] = useState<DocumentUpload[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptedFileTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
  const maxFileSize = 10 * 1024 * 1024 // 10MB
  const maxFiles = 5

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File "${file.name}" is too large. Maximum size is 10MB.`
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedFileTypes.includes(fileExtension)) {
      return `File type "${fileExtension}" is not supported. Please use: ${acceptedFileTypes.join(', ')}`
    }

    // Check for duplicate names
    if (uploads.some(upload => upload.filename === file.name)) {
      return `File "${file.name}" has already been uploaded.`
    }

    return null
  }

  const generateFileId = () => {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const simulateFileUpload = async (file: File): Promise<DocumentUpload> => {
    const upload: DocumentUpload = {
      id: generateFileId(),
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadUrl: URL.createObjectURL(file),
      status: 'uploading'
    }

    setUploads(prev => [...prev, upload])

    try {
      // Simulate upload progress
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate upload success
      const updatedUpload: DocumentUpload = {
        ...upload,
        status: 'uploaded'
      }

      setUploads(prev => prev.map(u => u.id === upload.id ? updatedUpload : u))
      return updatedUpload

    } catch (err) {
      const failedUpload: DocumentUpload = {
        ...upload,
        status: 'rejected',
        rejectionReason: 'Upload failed. Please try again.'
      }

      setUploads(prev => prev.map(u => u.id === upload.id ? failedUpload : u))
      throw err
    }
  }

  const handleFileSelect = async (files: FileList) => {
    setError(null)

    // Check total file limit
    if (uploads.length + files.length > maxFiles) {
      setError(`You can upload a maximum of ${maxFiles} files. Please remove some files first.`)
      return
    }

    const validFiles: File[] = []
    const errors: string[] = []

    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const error = validateFile(file)
      
      if (error) {
        errors.push(error)
      } else {
        validFiles.push(file)
      }
    }

    if (errors.length > 0) {
      setError(errors.join(' '))
      return
    }

    // Upload valid files
    setIsUploading(true)

    try {
      await Promise.all(validFiles.map(file => simulateFileUpload(file)))
    } catch (err) {
      setError('Some files failed to upload. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }, [handleFileSelect])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files)
    }
    // Reset input value to allow same file to be selected again
    e.target.value = ''
  }

  const removeFile = (fileId: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== fileId))
  }

  const retryUpload = async (fileId: string) => {
    const upload = uploads.find(u => u.id === fileId)
    if (!upload) return

    setIsUploading(true)
    
    try {
      // Reset to uploading state
      setUploads(prev => prev.map(u => 
        u.id === fileId ? { ...u, status: 'uploading' } : u
      ))

      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mark as uploaded
      setUploads(prev => prev.map(u => 
        u.id === fileId ? { ...u, status: 'uploaded' } : u
      ))
    } catch (err) {
      setUploads(prev => prev.map(u => 
        u.id === fileId ? { ...u, status: 'rejected', rejectionReason: 'Retry failed. Please try again.' } : u
      ))
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const uploadedFiles = uploads.filter(upload => upload.status === 'uploaded')
    
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one document before submitting.')
      return
    }

    setError(null)

    try {
      await onSubmit({
        actionId: action.id,
        type: 'document',
        data: {
          documents: uploadedFiles,
          totalFiles: uploadedFiles.length
        }
      })
    } catch (err) {
      setError('Failed to submit documents. Please try again.')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'pdf': return '📄'
      case 'doc':
      case 'docx': return '📝'
      case 'jpg':
      case 'jpeg':
      case 'png': return '🖼️'
      default: return '📎'
    }
  }

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'uploading': return '⏳'
      case 'uploaded': return '✅'
      case 'processing': return '🔄'
      case 'verified': return '✅'
      case 'rejected': return '❌'
      default: return '❓'
    }
  }

  const uploadedCount = uploads.filter(u => u.status === 'uploaded').length
  const requiredTypes = action.metadata?.documentTypes || []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📄</span>
          <div>
            <h3 className="text-xl font-bold text-white">Document Upload</h3>
            <p className="text-secondary-400 text-sm">{action.directory}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-secondary-400 hover:text-secondary-300 text-xl"
          disabled={isLoading || isUploading}
        >
          ✕
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-secondary-700/50 rounded-lg p-4 mb-6 border border-secondary-600">
        <p className="text-secondary-300 text-sm leading-relaxed mb-3">
          {action.instructions}
        </p>
        
        {requiredTypes.length > 0 && (
          <div>
            <p className="text-white font-medium text-sm mb-2">Required Documents:</p>
            <ul className="list-disc list-inside space-y-1">
              {requiredTypes.map((type, index) => (
                <li key={index} className="text-secondary-300 text-sm">
                  {type}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-volt-400 bg-volt-500/10'
              : uploads.length >= maxFiles
              ? 'border-secondary-600 bg-secondary-700/30'
              : 'border-secondary-600 hover:border-secondary-500 bg-secondary-700/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploads.length >= maxFiles || isUploading}
          />
          
          <div className="space-y-4">
            <span className="text-6xl block">📁</span>
            
            {uploads.length >= maxFiles ? (
              <div>
                <p className="text-secondary-400 text-lg font-medium">
                  Maximum files reached ({maxFiles})
                </p>
                <p className="text-secondary-500 text-sm">
                  Remove some files to upload more
                </p>
              </div>
            ) : isDragOver ? (
              <div>
                <p className="text-volt-400 text-lg font-medium">
                  Drop files here to upload
                </p>
              </div>
            ) : (
              <div>
                <p className="text-white text-lg font-medium">
                  Drag & drop files here or click to browse
                </p>
                <p className="text-secondary-400 text-sm">
                  Supported: {acceptedFileTypes.join(', ')} • Max size: 10MB • Max files: {maxFiles}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="bg-secondary-700/50 rounded-lg p-4 border border-secondary-600">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-volt-400/20 border-t-volt-400 rounded-full" />
              <span className="text-volt-400 font-medium">Uploading files...</span>
            </div>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploads.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-white font-medium">
              Uploaded Files ({uploadedCount}/{uploads.length})
            </h4>
            
            <div className="space-y-3">
              {uploads.map((upload) => (
                <div 
                  key={upload.id}
                  className="bg-secondary-700/50 rounded-lg p-4 border border-secondary-600"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl">{getFileIcon(upload.filename)}</span>
                      
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">
                          {upload.filename}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-secondary-400">
                          <span>{formatFileSize(upload.fileSize)}</span>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(upload.status)}
                            {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                          </span>
                        </div>
                        
                        {upload.rejectionReason && (
                          <p className="text-danger-400 text-xs mt-1">
                            {upload.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-3">
                      {upload.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => retryUpload(upload.id)}
                          disabled={isUploading}
                          className="text-volt-400 hover:text-volt-300 text-sm underline"
                        >
                          Retry
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeFile(upload.id)}
                        disabled={isUploading}
                        className="text-danger-400 hover:text-danger-300"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploadedCount === 0 || isLoading || isUploading}
            className="btn-primary flex-1"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                Submitting...
              </div>
            ) : (
              `Submit Documents (${uploadedCount})`
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading || isUploading}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-danger-500/20 border border-danger-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2 text-danger-400">
            <span className="text-lg">❌</span>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 pt-4 border-t border-secondary-700">
        <h4 className="text-white font-medium mb-2">Upload Guidelines</h4>
        <div className="space-y-2 text-xs text-secondary-400">
          <p>• Ensure documents are clear and readable</p>
          <p>• All text should be legible and not blurry</p>
          <p>• Documents should be recent (within 90 days if applicable)</p>
          <p>• Personal information should match your business registration</p>
          <p>• Supported formats: PDF, JPG, PNG, DOC, DOCX</p>
        </div>
      </div>

      {/* Attempt Counter */}
      {action.attempts !== undefined && action.maxAttempts && (
        <div className="mt-4 text-center">
          <p className="text-xs text-secondary-400">
            Attempt {action.attempts + 1} of {action.maxAttempts}
          </p>
        </div>
      )}
    </div>
  )
}

export default DocumentUploader