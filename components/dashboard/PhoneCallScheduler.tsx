'use client'
import { useState } from 'react'
import { LoadingState } from '../ui/LoadingState'
import { PendingAction, VerificationFormData } from '../../types/dashboard'

interface PhoneCallSchedulerProps {
  action: PendingAction
  onSubmit: (formData: VerificationFormData) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function PhoneCallScheduler({
  action,
  onSubmit,
  onCancel,
  isLoading
}: PhoneCallSchedulerProps) {
  const [formData, setFormData] = useState({
    phoneNumber: action.metadata?.phoneNumber || '',
    preferredDate: '',
    preferredTime: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notes: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'schedule' | 'confirmation'>('schedule')

  // Generate available time slots (business hours: 9 AM - 5 PM)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        slots.push({ value: time, display: displayTime })
      }
    }
    return slots
  }

  // Generate available dates (next 14 business days)
  const generateAvailableDates = () => {
    const dates = []
    const today = new Date()
    let currentDate = new Date(today)
    currentDate.setDate(currentDate.getDate() + 1) // Start from tomorrow

    while (dates.length < 14) {
      const dayOfWeek = currentDate.getDay()
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push({
          value: currentDate.toISOString().split('T')[0],
          display: currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        })
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return dates
  }

  const timeZones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu'
  ]

  const timeSlots = generateTimeSlots()
  const availableDates = generateAvailableDates()

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    }
    return digits
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData(prev => ({ ...prev, phoneNumber: formatted }))
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!validatePhoneNumber(formData.phoneNumber)) {
      setError('Please enter a valid phone number')
      return
    }

    if (!formData.preferredDate) {
      setError('Please select a preferred date')
      return
    }

    if (!formData.preferredTime) {
      setError('Please select a preferred time')
      return
    }

    setError(null)

    try {
      await onSubmit({
        actionId: action.id,
        type: 'phone_call',
        data: {
          ...formData,
          scheduled: true,
          scheduledFor: `${formData.preferredDate}T${formData.preferredTime}:00.000Z`,
          timeZoneOffset: new Date().getTimezoneOffset()
        }
      })
    } catch (err) {
      setError('Failed to schedule phone call. Please try again.')
    }
  }

  const getTimeZoneDisplay = (tz: string) => {
    const display = tz.replace('America/', '').replace('Pacific/', '').replace('_', ' ')
    const now = new Date()
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'short'
    }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value
    
    return `${display} (${offset})`
  }

  const formatScheduledDateTime = () => {
    if (!formData.preferredDate || !formData.preferredTime) return ''
    
    const date = new Date(`${formData.preferredDate}T${formData.preferredTime}`)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: formData.timeZone
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📞</span>
          <div>
            <h3 className="text-xl font-bold text-white">Phone Call Scheduling</h3>
            <p className="text-secondary-400 text-sm">{action.directory}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-secondary-400 hover:text-secondary-300 text-xl"
          disabled={isLoading}
        >
          ✕
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-secondary-700/50 rounded-lg p-4 mb-6 border border-secondary-600">
        <p className="text-secondary-300 text-sm leading-relaxed">
          {action.instructions}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Phone Number */}
        <div>
          <label className="block text-white font-medium mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            className="input-field w-full"
            disabled={isLoading}
            maxLength={14}
            required
          />
          <p className="text-secondary-400 text-xs mt-1">
            We'll call you at this number at the scheduled time
          </p>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-white font-medium mb-2">
            Preferred Date
          </label>
          <select
            value={formData.preferredDate}
            onChange={(e) => handleInputChange('preferredDate', e.target.value)}
            className="input-field w-full"
            disabled={isLoading}
            required
          >
            <option value="">Select a date...</option>
            {availableDates.map((date) => (
              <option key={date.value} value={date.value}>
                {date.display}
              </option>
            ))}
          </select>
          <p className="text-secondary-400 text-xs mt-1">
            Available business days only (Monday - Friday)
          </p>
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-white font-medium mb-2">
            Preferred Time
          </label>
          <select
            value={formData.preferredTime}
            onChange={(e) => handleInputChange('preferredTime', e.target.value)}
            className="input-field w-full"
            disabled={isLoading}
            required
          >
            <option value="">Select a time...</option>
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.display}
              </option>
            ))}
          </select>
          <p className="text-secondary-400 text-xs mt-1">
            Business hours: 9:00 AM - 5:00 PM
          </p>
        </div>

        {/* Time Zone */}
        <div>
          <label className="block text-white font-medium mb-2">
            Time Zone
          </label>
          <select
            value={formData.timeZone}
            onChange={(e) => handleInputChange('timeZone', e.target.value)}
            className="input-field w-full"
            disabled={isLoading}
          >
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {getTimeZoneDisplay(tz)}
              </option>
            ))}
          </select>
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-white font-medium mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Any specific topics to discuss or special requirements..."
            className="input-field w-full h-24 resize-none"
            disabled={isLoading}
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-secondary-400 text-xs">
              Help us prepare for your call
            </p>
            <p className="text-secondary-500 text-xs">
              {formData.notes.length}/500
            </p>
          </div>
        </div>

        {/* Scheduled Time Preview */}
        {formData.preferredDate && formData.preferredTime && (
          <div className="bg-volt-500/20 border border-volt-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-volt-400 mb-2">
              <span className="text-lg">📅</span>
              <p className="font-medium">Scheduled Call Time</p>
            </div>
            <p className="text-white font-mono text-lg">
              {formatScheduledDateTime()}
            </p>
            <p className="text-volt-300 text-sm mt-1">
              Duration: Approximately 15-20 minutes
            </p>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!formData.phoneNumber || !formData.preferredDate || !formData.preferredTime || isLoading}
            className="btn-primary flex-1"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                Scheduling...
              </div>
            ) : (
              'Schedule Call'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
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
        <h4 className="text-white font-medium mb-2">What to Expect</h4>
        <div className="space-y-2 text-xs text-secondary-400">
          <p>• A verification specialist will call you at the scheduled time</p>
          <p>• The call typically takes 15-20 minutes</p>
          <p>• Please have your business documents ready for reference</p>
          <p>• We'll verify your business details and services</p>
          <p>• You'll receive a confirmation email with call details</p>
          <p>• If you need to reschedule, please contact us at least 4 hours in advance</p>
        </div>

        <div className="mt-4 p-3 bg-secondary-700/30 rounded-lg">
          <p className="text-xs text-secondary-400 mb-1">Required for call:</p>
          <ul className="text-white text-sm space-y-1">
            <li>• Business registration documents</li>
            <li>• Contact information verification</li>
            <li>• Service/product details</li>
            <li>• Business location confirmation</li>
          </ul>
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

export default PhoneCallScheduler