# Directory-Bolt System Integration Test Report

**Test Date:** 2025-11-27T03:21:43.646111

## Summary

- **Total Tests:** 6
- **Passed:** 0
- **Failed:** 6
- **Pass Rate:** 0.0%

## Connection Status

| Connection | Status | Details |
|------------|--------|----------|
| Backend -> SQS Connection | FAIL | SQS_QUEUE_URL not configured |
| Subscriber -> Prefect Connection | FAIL | PREFECT_API_URL not configured |
| Worker -> Database Connection | FAIL | cannot import name 'create_client' from 'supabase' (unknown location) |
| Staff Dashboard -> Database Connection | FAIL | cannot import name 'create_client' from 'supabase' (unknown location) |
| Render Workers Health | FAIL | N/A |
| End-to-End Data Flow | FAIL | cannot import name 'create_client' from 'supabase' (unknown location) |

## Detailed Test Results

### Backend -> SQS Connection

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:43.659016

**Details:**

```json
{
  "error": "SQS_QUEUE_URL not configured"
}
```

### Subscriber -> Prefect Connection

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:44.661184

**Details:**

```json
{
  "error": "PREFECT_API_URL not configured",
  "severity": "warning"
}
```

### Worker -> Database Connection

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:45.666794

**Details:**

```json
{
  "error": "cannot import name 'create_client' from 'supabase' (unknown location)"
}
```

### Staff Dashboard -> Database Connection

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:46.668769

**Details:**

```json
{
  "error": "cannot import name 'create_client' from 'supabase' (unknown location)"
}
```

### Render Workers Health

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:48.499299

**Details:**

```json
{
  "Brain": {
    "status": "unhealthy",
    "code": 404
  }
}
```

### End-to-End Data Flow

**Status:** FAILED

**Timestamp:** 2025-11-27T03:21:49.512530

**Details:**

```json
{
  "error": "cannot import name 'create_client' from 'supabase' (unknown location)"
}
```

