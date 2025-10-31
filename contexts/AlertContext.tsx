import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ManualInterventionAlert, AlertSeverity, AlertStatus } from '../components/staff-dashboard/types/alerts.types'

interface AlertContextType {
  alerts: ManualInterventionAlert[]
  activeAlertsCount: number
  criticalAlertsCount: number
  addAlert: (alert: Omit<ManualInterventionAlert, 'id' | 'createdAt' | 'lastUpdatedAt'>) => void
  updateAlert: (id: string, updates: Partial<ManualInterventionAlert>) => void
  resolveAlert: (id: string, notes?: string) => void
  acknowledgeAlert: (id: string) => void
  dismissAlert: (id: string) => void
  getAlertsBySeverity: (severity: AlertSeverity) => ManualInterventionAlert[]
  getAlertsByStatus: (status: AlertStatus) => ManualInterventionAlert[]
}

const AlertContext = createContext<AlertContextType | null>(null)

interface AlertProviderProps {
  children: ReactNode
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [alerts, setAlerts] = useState<ManualInterventionAlert[]>([
    // Mock alerts for development
    {
      id: 'alert-001',
      customerId: 'DIR-2025-001234',
      businessName: 'TechStart Inc',
      severity: 'critical',
      status: 'active',
      title: 'Multiple directory failures',
      description: 'Customer processing failed with 7/10 directories failing to submit',
      failedDirectories: ['Yelp', 'Yellow Pages', 'Local.com', 'CitySearch'],
      recommendedActions: [
        {
          id: 'action-001',
          label: 'Retry after 1 hour',
          actionType: 'retry',
          successProbability: 'high',
          estimatedTime: '1 hour'
        },
        {
          id: 'action-002',
          label: 'Contact customer',
          actionType: 'contact',
          estimatedTime: '5 minutes'
        },
        {
          id: 'action-003',
          label: 'Skip failed directories',
          actionType: 'skip',
          requiresApproval: true
        }
      ],
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 minutes ago
      lastUpdatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
    },
    {
      id: 'alert-002',
      customerId: 'DIR-2025-001235',
      businessName: 'Marketing Pro',
      severity: 'warning',
      status: 'active',
      title: 'Quality review needed',
      description: 'Processing completed but with quality issues detected',
      recommendedActions: [
        {
          id: 'action-004',
          label: 'Review results',
          actionType: 'review',
          estimatedTime: '10 minutes'
        }
      ],
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString()
    },
    {
      id: 'alert-003',
      customerId: 'DIR-2025-001236',
      businessName: 'LocalBiz LLC',
      severity: 'info',
      status: 'active',
      title: 'Completed with notes',
      description: 'Processing completed successfully with minor issues noted',
      recommendedActions: [
        {
          id: 'action-005',
          label: 'Acknowledge completion',
          actionType: 'review',
          estimatedTime: '2 minutes'
        }
      ],
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
      lastUpdatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
    }
  ])

  const activeAlertsCount = alerts.filter(alert => alert.status === 'active').length
  const criticalAlertsCount = alerts.filter(alert => alert.severity === 'critical' && alert.status === 'active').length

  const addAlert = useCallback((alertData: Omit<ManualInterventionAlert, 'id' | 'createdAt' | 'lastUpdatedAt'>) => {
    const newAlert: ManualInterventionAlert = {
      ...alertData,
      id: `alert-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    }
    
    setAlerts(prev => [newAlert, ...prev])
  }, [])

  const updateAlert = useCallback((id: string, updates: Partial<ManualInterventionAlert>) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id 
        ? { ...alert, ...updates, lastUpdatedAt: new Date().toISOString() }
        : alert
    ))
  }, [])

  const resolveAlert = useCallback((id: string, notes?: string) => {
    updateAlert(id, { 
      status: 'resolved', 
      resolutionNotes: notes 
    })
  }, [updateAlert])

  const acknowledgeAlert = useCallback((id: string) => {
    updateAlert(id, { status: 'acknowledged' })
  }, [updateAlert])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const getAlertsBySeverity = useCallback((severity: AlertSeverity) => {
    return alerts.filter(alert => alert.severity === severity)
  }, [alerts])

  const getAlertsByStatus = useCallback((status: AlertStatus) => {
    return alerts.filter(alert => alert.status === status)
  }, [alerts])

  const contextValue: AlertContextType = {
    alerts,
    activeAlertsCount,
    criticalAlertsCount,
    addAlert,
    updateAlert,
    resolveAlert,
    acknowledgeAlert,
    dismissAlert,
    getAlertsBySeverity,
    getAlertsByStatus
  }

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts(): AlertContextType {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider')
  }
  return context
}