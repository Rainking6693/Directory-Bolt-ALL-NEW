import React, { useState, useEffect } from 'react'

interface DataFlowTransparencyProps {
  // Component props can be added here as needed
}

export default function DataFlowTransparency(props: DataFlowTransparencyProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [dataFlow, setDataFlow] = useState({
    totalCustomers: 0,
    activeExtractions: 0,
    completedToday: 0
  })

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading Data Flow Monitor...</div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Flow Transparency Dashboard</h1>
        <p className="text-gray-600">Real-time monitoring of customer data extraction and directory submissions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-blue-600 mb-2">Total Customers</h3>
          <p className="text-2xl font-bold text-blue-700">{dataFlow.totalCustomers}</p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-yellow-600 mb-2">Active Extractions</h3>
          <p className="text-2xl font-bold text-yellow-700">{dataFlow.activeExtractions}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-green-600 mb-2">Completed Today</h3>
          <p className="text-2xl font-bold text-green-700">{dataFlow.completedToday}</p>
        </div>
      </div>

      {/* Data Flow Process */}
      <div className="bg-gray-50 p-6 rounded-lg border mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Extraction Process</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-800">Customer Data Extraction</h4>
              <p className="text-gray-600">Extract business information from customer profiles</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-800">Data Quality Validation</h4>
              <p className="text-gray-600">Validate and enrich business data for accuracy</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-800">Directory Submission</h4>
              <p className="text-gray-600">Submit to 484+ business directories via AutoBolt</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <div className="ml-4">
              <h4 className="font-medium text-gray-800">Results Tracking</h4>
              <p className="text-gray-600">Monitor submission status and approval rates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Features */}
      <div className="bg-green-50 p-6 rounded-lg border">
        <h3 className="text-lg font-semibold text-green-800 mb-3">Transparency Features</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-700">Real-time data extraction monitoring</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-700">Complete audit trail for all submissions</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-700">Data quality scoring and validation</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-700">Customer data privacy protection</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-x-4">
        <button 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => window.location.href = '/staff-dashboard'}
        >
          View Staff Dashboard
        </button>
        <button 
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          onClick={() => window.location.reload()}
        >
          Refresh Data
        </button>
      </div>
    </div>
  )
}