'use client'
import { useState } from 'react'
import { VerificationAction } from '../../../../types/dashboard'

interface PhoneCallSchedulerProps {
  action: VerificationAction
  onScheduled: () => void
  onCancel: () => void
}

interface TimeSlot {
  id: string
  date: string
  time: string
  available: boolean
  datetime: string
}

export function PhoneCallScheduler({ action, onScheduled, onCancel }: PhoneCallSchedulerProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [contactPhone, setContactPhone] = useState(action.contactInfo?.phone || '')
  const [error, setError] = useState<string | null>(null)

  const callOptions = action.phoneCallOptions || {
    availableSlots: [],
    duration: 15,
    timezone: 'America/New_York'
  }

  // Generate time slots for the current week
  const generateTimeSlots = (weekOffset = 0): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + (weekOffset * 7))
    
    // Start from next business day
    while (startDate.getDay() === 0 || startDate.getDay() === 6) {
      startDate.setDate(startDate.getDate() + 1)
    }

    for (let day = 0; day < 5; day++) { // Monday to Friday
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + day)
      
      // Skip weekends
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue
      
      // Generate time slots from 9 AM to 5 PM
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotTime = new Date(currentDate)
          slotTime.setHours(hour, minute, 0, 0)
          
          // Skip past times
          if (slotTime < new Date()) continue
          
          // Randomly make some slots unavailable for demo
          const available = Math.random() > 0.3
          
          slots.push({
            id: `${slotTime.getTime()}`,
            date: slotTime.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            }),
            time: slotTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            }),
            available,
            datetime: slotTime.toISOString()
          })
        }
      }
    }
    
    return slots.slice(0, 35) // Limit to reasonable number
  }

  const timeSlots = generateTimeSlots(currentWeekOffset)
  const availableSlots = timeSlots.filter(slot => slot.available)

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else {
      return `+${cleaned.slice(0, -10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setContactPhone(formatted)
    setError(null)
  }

  const handleSchedule = async () => {
    if (!selectedSlot) {
      setError('Please select a time slot')
      return
    }

    const cleanPhone = contactPhone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setIsScheduling(true)
    setError(null)

    try {
      // Simulate API call to schedule phone call
      await new Promise(resolve => setTimeout(resolve, 2000))
      onScheduled()
    } catch (err) {
      setError('Failed to schedule call. Please try again.')
    } finally {
      setIsScheduling(false)
    }
  }

  const groupSlotsByDate = (slots: TimeSlot[]) => {
    const grouped: { [key: string]: TimeSlot[] } = {}
    slots.forEach(slot => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = []
      }
      grouped[slot.date].push(slot)
    })
    return grouped
  }

  const groupedSlots = groupSlotsByDate(availableSlots)

  const getWeekLabel = () => {
    if (currentWeekOffset === 0) return 'This Week'
    if (currentWeekOffset === 1) return 'Next Week'
    return `${currentWeekOffset} Weeks Ahead`
  }

  return (
    <div className="mt-6 p-6 bg-secondary-700/30 rounded-lg border border-secondary-600">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h4 className="text-lg font-bold text-white mb-2">📞 Schedule Phone Verification</h4>
          <p className="text-secondary-300 text-sm">
            Schedule a {callOptions.duration}-minute verification call with our team
          </p>
        </div>

        {/* Contact Information */}
        <div className="bg-secondary-800/50 border border-secondary-600 rounded-lg p-4 mb-6">
          <h5 className="font-semibold text-white text-sm mb-3">Contact Information:</h5>
          <div>
            <label htmlFor="contact-phone" className="block text-sm font-medium text-secondary-300 mb-2">
              Phone Number for Call
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={contactPhone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="input-field max-w-xs"
              maxLength={18}
            />
            <p className="text-xs text-secondary-400 mt-1">
              We'll call you at this number for verification
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentWeekOffset(Math.max(0, currentWeekOffset - 1))}
            disabled={currentWeekOffset === 0}
            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary-700 text-secondary-300 rounded-lg hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous Week
          </button>
          
          <h5 className="font-semibold text-white">{getWeekLabel()}</h5>
          
          <button
            onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
            disabled={currentWeekOffset >= 3} // Limit to 4 weeks ahead
            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary-700 text-secondary-300 rounded-lg hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next Week →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-6">
          {Object.keys(groupedSlots).length === 0 ? (
            <div className="text-center p-8 bg-secondary-800/30 border border-secondary-600 rounded-lg">
              <span className="text-4xl mb-3 block">📅</span>
              <h6 className="text-white font-medium mb-2">No available slots</h6>
              <p className="text-secondary-400 text-sm">
                Please try a different week or contact support for alternative scheduling options.
              </p>
            </div>
          ) : (
            Object.entries(groupedSlots).map(([date, slots]) => (
              <div key={date} className="bg-secondary-800/30 border border-secondary-600 rounded-lg p-4">
                <h6 className="font-semibold text-white mb-3">{date}</h6>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedSlot === slot.id
                          ? 'bg-volt-500 text-secondary-900 ring-2 ring-volt-400'
                          : 'bg-secondary-700 text-secondary-300 hover:bg-secondary-600 hover:text-secondary-200'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Slot Display */}
        {selectedSlot && (
          <div className="mt-6 p-4 bg-volt-500/10 border border-volt-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="text-volt-400 font-bold text-sm">Selected Time Slot:</p>
                {(() => {
                  const selected = timeSlots.find(slot => slot.id === selectedSlot)
                  return selected ? (
                    <p className="text-white">
                      {selected.date} at {selected.time}
                    </p>
                  ) : null
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Call Information */}
        <div className="mt-6 bg-secondary-800/30 border border-secondary-600 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">ℹ️</span>
            <div>
              <p className="text-secondary-300 text-sm font-medium mb-2">What to Expect:</p>
              <ul className="text-xs text-secondary-400 space-y-1">
                <li>• Call duration: approximately {callOptions.duration} minutes</li>
                <li>• We'll verify your business information and directory submission</li>
                <li>• Have your business documents ready for reference</li>
                <li>• You'll receive a confirmation email with call details</li>
                <li>• Calls are conducted in {callOptions.timezone} timezone</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
            <span className="text-danger-400">❌</span>
            <span className="text-danger-400 text-sm">{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-secondary-600">
          <button
            onClick={handleSchedule}
            disabled={!selectedSlot || isScheduling || contactPhone.replace(/\D/g, '').length < 10}
            className="btn-primary flex-1"
          >
            {isScheduling ? (
              <>
                <div className="w-4 h-4 border-2 border-secondary-800 border-t-transparent rounded-full animate-spin mr-2" />
                Scheduling...
              </>
            ) : (
              <>
                <span>Schedule Call</span>
                <span aria-hidden="true">📞</span>
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="btn-secondary"
            disabled={isScheduling}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default PhoneCallScheduler