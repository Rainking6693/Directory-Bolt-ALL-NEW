# API Endpoint Mappings

This document shows the mapping between old endpoints (if any) and new Motia backend endpoints.

## Customer Portal Endpoints

| Functionality | Old Endpoint | New Endpoint | Method | Authentication |
|---------------|--------------|--------------|--------|----------------|
| Create Submission | Internal | `/api/customer/submission` | POST | Required |
| Get Customer Jobs | Internal | `/api/customer/jobs` | GET | Required |
| Get Job Status | Internal | `/api/customer/jobs/{jobId}/status` | GET | Required |
| Get Directories | Internal | `/api/customer/directories` | GET | Required |
| Get Statistics | Internal | `/api/customer/stats` | GET | Required |
| Get Performance Analytics | Internal | `/api/customer/analytics/performance` | GET | Required |
| Get Directory Success Rates | Internal | `/api/customer/analytics/directories` | GET | Required |
| Cancel Submission | Internal | `/api/customer/submission/{jobId}` | DELETE | Required |

## Staff Dashboard Endpoints

| Functionality | Old Endpoint | New Endpoint | Method | Authentication |
|---------------|--------------|--------------|--------|----------------|
| Get All Jobs | Internal | `/api/staff/jobs` | GET | Required |
| Get Active Jobs | Internal | `/api/staff/jobs/active` | GET | Required |
| Get Job Results | Internal | `/api/staff/jobs/{jobId}/results` | GET | Required |
| Get Job History | Internal | `/api/staff/jobs/{jobId}/history` | GET | Required |
| Get System Stats | Internal | `/api/staff/stats` | GET | Required |

## Internal Service Endpoints

| Functionality | Old Endpoint | New Endpoint | Method | Authentication |
|---------------|--------------|--------------|--------|----------------|
| AI Field Mapping | `https://brain.onrender.com/plan` | `/plan` | POST | Not Required |
| Health Check | `https://brain.onrender.com/health` | `/health` | GET | Not Required |
| Real-time Updates | Internal | `/api/realtime/subscribe` | POST | Not Required |
| Test Endpoint | None | `/hello` | GET | Not Required |

## Example Usage

### Creating a Submission (Customer)
```javascript
// Old approach (conceptual)
// POST to some internal endpoint

// New approach
const response = await fetch('/api/customer/submission', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN' // If required
  },
  body: JSON.stringify({
    packageType: 'professional',
    businessData: {
      name: 'Example Business',
      address: '123 Main St',
      phone: '555-1234',
      // ... other business data
    }
  })
});
```

### Getting Job Status (Customer)
```javascript
// Old approach (conceptual)
// Poll some internal endpoint

// New approach
const response = await fetch(`/api/customer/jobs/${jobId}/status`, {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN' // If required
  }
});
```

### Getting Active Jobs (Staff)
```javascript
// Old approach (conceptual)
// Access internal dashboard data

// New approach
const response = await fetch('/api/staff/jobs/active', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_STAFF_TOKEN' // Staff authentication
  }
});
```

### AI Field Mapping (Internal/Advanced)
```javascript
// Old approach
// POST to https://brain.onrender.com/plan

// New approach
const response = await fetch('/plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessData: businessData,
    directory: 'example-directory.com',
    useAI: true
  })
});
```

## Authentication Notes

1. **Customer Endpoints**: Require customer authentication
2. **Staff Endpoints**: Require staff/admin authentication
3. **Internal Endpoints**: Generally don't require authentication but should not be exposed publicly
4. **Test Endpoint**: No authentication required

## Migration Steps

1. **Identify all current API calls** in your frontend code
2. **Replace endpoint URLs** with the new Motia equivalents
3. **Update authentication methods** if needed
4. **Test each endpoint** individually
5. **Verify real-time functionality** works correctly
6. **Update error handling** to match new response formats

## Response Format

All new endpoints follow a consistent response format:

```javascript
{
  status: 200, // HTTP status code
  body: {
    // Actual response data
  }
}
```

Or for errors:

```javascript
{
  status: 400, // Appropriate error status code
  body: {
    error: "Error message"
  }
}
```

## Rate Limiting

The new implementation includes proper rate limiting to prevent abuse. Make sure your frontend handles rate limit responses appropriately.

## CORS Configuration

The Motia backend is configured to handle CORS properly. If you encounter CORS issues, they likely need to be addressed in your deployment configuration rather than the frontend code.

## WebSockets for Real-time Updates

For real-time updates, the new implementation uses Supabase Realtime, which provides a more robust and scalable solution than the previous approach.