'use client'
import { useState, useRef, useCallback } from 'react'
import { VerificationAction, UploadStatus } from '../../../../types/dashboard'

interface DocumentUploadInterfaceProps {
  action: VerificationAction
  onUploadComplete: () => void
  onCancel: () => void
}

export function DocumentUploadInterface({ 
  action, 
  onUploadComplete, 
  onCancel 
}: DocumentUploadInterfaceProps) {
  const [uploads, setUploads] = useState<UploadStatus[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const requirements = action.documentRequirements || {
    acceptedFormats: ['PDF', 'JPG', 'PNG', 'DOC', 'DOCX'],
    maxFileSize: 10, // MB
    maxFiles: 5,
    description: 'Upload your business verification documents'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const maxSize = requirements.maxFileSize * 1024 * 1024 // Convert MB to bytes
    
    if (!fileExtension || !requirements.acceptedFormats.some(format => 
      format.toLowerCase() === fileExtension
    )) {
      return `File type not supported. Accepted formats: ${requirements.acceptedFormats.join(', ')}`
    }
    
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${requirements.maxFileSize}MB`
    }
    
    if (uploads.length >= requirements.maxFiles) {
      return `Maximum ${requirements.maxFiles} files allowed`
    }
    
    return null
  }

  const simulateUpload = (fileId: string) => {
    const duration = 2000 + Math.random() * 3000 // 2-5 seconds
    const startTime = Date.now()
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / duration) * 100, 100)
      
      setUploads(prev => prev.map(upload => 
        upload.id === fileId 
          ? { ...upload, uploadProgress: Math.round(progress) }
          : upload
      ))
      
      if (progress < 100) {
        setTimeout(updateProgress, 50)
      } else {
        // Simulate processing phase
        setTimeout(() => {
          setUploads(prev => prev.map(upload => 
            upload.id === fileId 
              ? { ...upload, status: 'processing' }
              : upload
          ))
          
          // Complete after processing
          setTimeout(() => {
            setUploads(prev => prev.map(upload => 
              upload.id === fileId 
                ? { ...upload, status: 'completed' }
                : upload
            ))
          }, 1000)
        }, 500)
      }
    }
    
    updateProgress()
  }

  const handleFiles = async (files: FileList) => {
    setError(null)
    const filesArray = Array.from(files)
    
    for (const file of filesArray) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        continue
      }
      
      const newUpload: UploadStatus = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        fileSize: file.size,
        uploadProgress: 0,
        status: 'uploading',
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }
      
      setUploads(prev => [...prev, newUpload])
      simulateUpload(newUpload.id)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id))
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'pdf': return '📄'
      case 'doc':
      case 'docx': return '📝'
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️'
      case 'xls':
      case 'xlsx': return '📊'
      default: return '📎'
    }
  }

  const getStatusIcon = (status: UploadStatus['status']) => {
    switch (status) {
      case 'uploading': return '⏳'
      case 'processing': return '🔄'
      case 'completed': return '✅'
      case 'error': return '❌'
      default: return '📎'
    }
  }

  const canComplete = uploads.length > 0 && uploads.every(upload => upload.status === 'completed')

  const handleComplete = () => {
    if (canComplete) {
      onUploadComplete()
    }
  }

  return (
    <div className="mt-6 p-6 bg-secondary-700/30 rounded-lg border border-secondary-600">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h4 className="text-lg font-bold text-white mb-2">📄 Document Upload</h4>
          <p className="text-secondary-300 text-sm">
            {requirements.description}
          </p>
        </div>

        {/* Upload Requirements */}
        <div className="bg-secondary-800/50 border border-secondary-600 rounded-lg p-4 mb-6">
          <h5 className="font-semibold text-white text-sm mb-3">Upload Requirements:</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-secondary-400">
            <div>
              <span className="font-medium">Accepted formats:</span>
              <p>{requirements.acceptedFormats.join(', ')}</p>
            </div>
            <div>
              <span className="font-medium">Maximum size:</span>
              <p>{requirements.maxFileSize}MB per file</p>
            </div>
            <div>
              <span className="font-medium">Maximum files:</span>
              <p>{requirements.maxFiles} files total</p>
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          ref={dropZoneRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragOver
              ? 'border-volt-500 bg-volt-500/10'
              : uploads.length >= requirements.maxFiles
              ? 'border-secondary-600 bg-secondary-800/30 cursor-not-allowed'
              : 'border-secondary-600 bg-secondary-800/20 hover:border-volt-500/50 hover:bg-volt-500/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={requirements.acceptedFormats.map(format => `.${format.toLowerCase()}`).join(',')}
            onChange={handleFileInput}
            className="hidden"
            disabled={uploads.length >= requirements.maxFiles}
          />
          
          <div className="space-y-4">
            <div className="text-4xl mb-4">
              {isDragOver ? '📥' : '📎'}
            </div>
            
            <div>
              <p className="text-white font-medium">
                {uploads.length >= requirements.maxFiles
                  ? 'Maximum files reached'
                  : isDragOver
                  ? 'Drop files here'
                  : 'Drag & drop files here'
                }
              </p>
              {uploads.length < requirements.maxFiles && (
                <p className="text-secondary-400 text-sm mt-2">
                  or <span className="text-volt-400 underline">click to browse</span>
                </p>
              )}
            </div>
            
            <div className="text-xs text-secondary-400">
              {uploads.length} of {requirements.maxFiles} files uploaded
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
            <span className="text-danger-400">❌</span>
            <span className="text-danger-400 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-danger-400/80 hover:text-danger-400"
            >
              ✕
            </button>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-3">
            <h5 className="font-semibold text-white text-sm">Uploaded Files:</h5>
            <div className="space-y-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center gap-3 p-3 bg-secondary-800/50 border border-secondary-600 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFileIcon(upload.fileName)}</span>
                    <span className="text-lg">{getStatusIcon(upload.status)}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-white text-sm font-medium truncate">
                        {upload.fileName}
                      </p>
                      <span className="text-xs text-secondary-400 whitespace-nowrap">
                        {formatFileSize(upload.fileSize)}
                      </span>
                    </div>
                    
                    {upload.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-volt-400">Uploading...</span>
                          <span className="text-volt-400">{upload.uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-secondary-700 rounded-full h-1.5">
                          <div 
                            className="bg-volt-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${upload.uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {upload.status === 'processing' && (
                      <p className="text-volt-400 text-xs">Processing document...</p>
                    )}
                    
                    {upload.status === 'completed' && (
                      <p className="text-success-400 text-xs">✓ Upload completed</p>
                    )}
                    
                    {upload.status === 'error' && (
                      <p className="text-danger-400 text-xs">❌ {upload.errorMessage || 'Upload failed'}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeUpload(upload.id)}
                    className="p-1 text-secondary-400 hover:text-danger-400 transition-colors"
                    aria-label={`Remove ${upload.fileName}`}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-secondary-600">
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className={`btn-primary flex-1 ${
              !canComplete ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {canComplete ? (
              <>
                <span>Complete Upload</span>
                <span aria-hidden="true">✓</span>
              </>
            ) : (
              <>
                <span>Upload Files First</span>
                <span aria-hidden="true">⏳</span>
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentUploadInterface