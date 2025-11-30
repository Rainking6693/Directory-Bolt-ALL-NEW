# Frontend Integration Guide

This guide explains how to update your frontend to use the new Motia backend API endpoints.

## API Endpoint Changes

### Previous Endpoints (Render Services)
- Brain Service: `https://brain.onrender.com/plan`
- Other services were internal and not directly accessed by frontend

### New Endpoints (Motia Backend)
All endpoints are now available at your deployed Motia application URL (e.g., `http://localhost:3000` or your production URL)

## Customer Portal Endpoints

### 1. Create Directory Submission
**Previous:** Various internal endpoints
**New:** `POST /api/customer/submission`

```javascript
// Example implementation
const createSubmission = async (packageType, businessData) => {
  const response = await fetch('/api/customer/submission', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    },
    body: JSON.stringify({
      packageType: packageType, // 'starter', 'growth', 'professional', 'enterprise'
      businessData: businessData
    })
  });
  
  return await response.json();
};
```

### 2. Get Customer Jobs
**New:** `GET /api/customer/jobs`

```javascript
// Example implementation
const getCustomerJobs = async () => {
  const response = await fetch('/api/customer/jobs', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 3. Get Job Status
**New:** `GET /api/customer/jobs/{jobId}/status`

```javascript
// Example implementation
const getJobStatus = async (jobId) => {
  const response = await fetch(`/api/customer/jobs/${jobId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 4. Get Submitted Directories
**New:** `GET /api/customer/directories`

```javascript
// Example implementation
const getSubmittedDirectories = async () => {
  const response = await fetch('/api/customer/directories', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 5. Get Customer Statistics
**New:** `GET /api/customer/stats`

```javascript
// Example implementation
const getCustomerStats = async () => {
  const response = await fetch('/api/customer/stats', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 6. Get Performance Analytics
**New:** `GET /api/customer/analytics/performance`

```javascript
// Example implementation
const getPerformanceAnalytics = async (startDate, endDate) => {
  const response = await fetch(`/api/customer/analytics/performance?start=${startDate}&end=${endDate}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 7. Get Directory Success Rates
**New:** `GET /api/customer/analytics/directories`

```javascript
// Example implementation
const getDirectorySuccessRates = async () => {
  const response = await fetch('/api/customer/analytics/directories', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 8. Cancel Submission
**New:** `DELETE /api/customer/submission/{jobId}`

```javascript
// Example implementation
const cancelSubmission = async (jobId) => {
  const response = await fetch(`/api/customer/submission/${jobId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

## Staff Dashboard Endpoints

### 1. Get All Jobs
**New:** `GET /api/staff/jobs`

```javascript
// Example implementation
const getAllJobs = async (limit = 100, offset = 0, status = null) => {
  let url = `/api/staff/jobs?limit=${limit}&offset=${offset}`;
  if (status) {
    url += `&status=${status}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 2. Get Active Jobs
**New:** `GET /api/staff/jobs/active`

```javascript
// Example implementation
const getActiveJobs = async () => {
  const response = await fetch('/api/staff/jobs/active', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 3. Get Job Results
**New:** `GET /api/staff/jobs/{jobId}/results`

```javascript
// Example implementation
const getJobResults = async (jobId) => {
  const response = await fetch(`/api/staff/jobs/${jobId}/results`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 4. Get Job History
**New:** `GET /api/staff/jobs/{jobId}/history`

```javascript
// Example implementation
const getJobHistory = async (jobId) => {
  const response = await fetch(`/api/staff/jobs/${jobId}/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

### 5. Get System Statistics
**New:** `GET /api/staff/stats`

```javascript
// Example implementation
const getSystemStats = async () => {
  const response = await fetch('/api/staff/stats', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication headers as needed
    }
  });
  
  return await response.json();
};
```

## Internal Service Endpoints

### 1. AI Field Mapping
**New:** `POST /plan`

This endpoint is used internally by the job processor but can also be called directly:

```javascript
// Example implementation
const getFieldMapping = async (businessData, directory) => {
  const response = await fetch('/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      businessData: businessData,
      directory: directory,
      useAI: true
    })
  });
  
  return await response.json();
};
```

### 2. Health Check
**New:** `GET /health`

```javascript
// Example implementation
const checkHealth = async () => {
  const response = await fetch('/health', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  
  return await response.json();
};
```

## Implementation Steps

1. **Update API Base URL**
   Replace any references to the old Render services with your new Motia backend URL.

2. **Update Authentication**
   Ensure your frontend is sending the correct authentication headers for protected endpoints.

3. **Replace Old Endpoints**
   Replace calls to the old Brain Service (`https://brain.onrender.com/plan`) with the new `/plan` endpoint.

4. **Test All Functionality**
   - Customer submission workflow
   - Job tracking and status updates
   - Analytics and reporting
   - Staff dashboard functionality

5. **Handle Real-time Updates**
   The new implementation supports real-time updates through Supabase. Make sure your frontend is properly configured to receive these updates.

## Environment Configuration

Make sure your frontend is configured to point to the correct backend URL:

```javascript
// Example configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

## Error Handling

The new API returns standardized error responses:

```javascript
// Example error handling
try {
  const response = await fetch('/api/customer/submission', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Unknown error occurred');
  }
  
  return await response.json();
} catch (error) {
  console.error('API Error:', error);
  // Handle error appropriately in your UI
}
```

## Testing

1. Start your Motia backend locally: `npx motia dev`
2. Update your frontend to point to `http://localhost:3000`
3. Test all customer and staff functionality
4. Verify real-time updates are working
5. Deploy to production when ready