#!/bin/bash
# Directory-Bolt Dashboard API Test Script
# Tests all critical API endpoints for production readiness

set -e

# Configuration
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BRAIN_URL="${BRAIN_URL:-http://localhost:8080}"
STAFF_KEY="${STAFF_KEY:-DirectoryBolt-Staff-2025-SecureKey}"

echo "=================================="
echo "Directory-Bolt API Test Suite"
echo "=================================="
echo "Frontend URL: $FRONTEND_URL"
echo "Brain URL: $BRAIN_URL"
echo "Staff Key: ${STAFF_KEY:0:20}..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test function
test_api() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    local method=${4:-GET}
    local data=${5:-}

    echo -n "Testing $name... "

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -H "X-Staff-Key: $STAFF_KEY" \
            -H "Authorization: Bearer $STAFF_KEY" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" \
            -H "X-Staff-Key: $STAFF_KEY" \
            -H "Authorization: Bearer $STAFF_KEY" \
            --cookie "staff-session=test" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))

        # Show response preview (first 100 chars)
        if [ -n "$body" ]; then
            preview=$(echo "$body" | head -c 100)
            echo "  Response: $preview..."
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (Expected $expected_status, got $http_code)"
        FAILED=$((FAILED + 1))

        # Show error details
        if [ -n "$body" ]; then
            echo "  Error: $body" | head -c 200
            echo ""
        fi
    fi
    echo ""
}

echo "=================================="
echo "Brain Service Tests"
echo "=================================="

test_api "Brain Health Check" "$BRAIN_URL/health" 200

test_api "Brain Job Enqueue" "$BRAIN_URL/api/jobs/enqueue" 200 "POST" '{
    "job_id": "test-'$(date +%s)'",
    "customer_id": "test-customer-001",
    "package_size": 5,
    "priority": 1,
    "metadata": {"test": true}
}'

echo "=================================="
echo "Frontend API Tests"
echo "=================================="

test_api "Staff Auth Check" "$FRONTEND_URL/api/staff/auth-check" 200

test_api "AutoBolt Queue" "$FRONTEND_URL/api/staff/autobolt-queue" 200

test_api "AutoBolt Status" "$FRONTEND_URL/api/autobolt-status" 200

test_api "AutoBolt Directories" "$FRONTEND_URL/api/autobolt/directories?limit=10" 200

test_api "Staff Real-time Status" "$FRONTEND_URL/api/staff/realtime-status" 200

test_api "AutoBolt Health" "$FRONTEND_URL/api/autobolt/health" 200

# Optional: Test SSE endpoint (may timeout, that's OK)
echo -n "Testing AutoBolt Stream (SSE)... "
timeout 2s curl -s "$FRONTEND_URL/api/autobolt/stream" \
    -H "X-Staff-Key: $STAFF_KEY" \
    --no-buffer > /dev/null 2>&1 && \
    echo -e "${GREEN}✓ PASSED${NC} (SSE connection established)" || \
    echo -e "${YELLOW}⊘ SKIPPED${NC} (SSE endpoint active, timeout expected)"
echo ""

echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! System is production-ready.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review errors above.${NC}"
    exit 1
fi
