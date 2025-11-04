#!/bin/bash
# Multi-service launcher for DirectoryBolt Backend
# Starts Brain Service, SQS Subscriber, and optional Prefect Worker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration from environment
ENABLE_PREFECT_WORKER=${ENABLE_PREFECT_WORKER:-"true"}
PREFECT_WORK_POOL=${PREFECT_WORK_POOL:-"default"}
BRAIN_PORT=${PORT:-8080}

# PID files for graceful shutdown
BRAIN_PID=""
SUBSCRIBER_PID=""
WORKER_PID=""

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to handle shutdown signals
cleanup() {
    log "Shutting down services..."
    
    # Kill services in reverse order
    if [ ! -z "$WORKER_PID" ]; then
        log "Stopping Prefect worker (PID: $WORKER_PID)..."
        kill $WORKER_PID 2>/dev/null || true
        wait $WORKER_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$SUBSCRIBER_PID" ]; then
        log "Stopping SQS subscriber (PID: $SUBSCRIBER_PID)..."
        kill $SUBSCRIBER_PID 2>/dev/null || true
        wait $SUBSCRIBER_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$BRAIN_PID" ]; then
        log "Stopping Brain service (PID: $BRAIN_PID)..."
        kill $BRAIN_PID 2>/dev/null || true
        wait $BRAIN_PID 2>/dev/null || true
    fi
    
    log "All services stopped. Exiting."
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Validate required environment variables
if [ -z "$SUPABASE_URL" ] && [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    log_error "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set"
    exit 1
fi

if [ -z "$SQS_QUEUE_URL" ]; then
    log_error "SQS_QUEUE_URL must be set"
    exit 1
fi

# Start Brain Service (FastAPI)
log "Starting Brain Service on port $BRAIN_PORT..."
cd /app
python -m uvicorn brain.service:app --host 0.0.0.0 --port $BRAIN_PORT &
BRAIN_PID=$!
log "Brain Service started (PID: $BRAIN_PID)"

# Wait for Brain service to be ready
sleep 3
if ! kill -0 $BRAIN_PID 2>/dev/null; then
    log_error "Brain Service failed to start"
    exit 1
fi

# Health check for Brain service
for i in {1..10}; do
    if curl -f http://localhost:$BRAIN_PORT/health >/dev/null 2>&1; then
        log "Brain Service is healthy"
        break
    fi
    if [ $i -eq 10 ]; then
        log_error "Brain Service health check failed"
        exit 1
    fi
    sleep 2
done

# Start SQS Subscriber
log "Starting SQS Subscriber..."
python -m orchestration.subscriber &
SUBSCRIBER_PID=$!
log "SQS Subscriber started (PID: $SUBSCRIBER_PID)"

# Wait a moment to check if subscriber started successfully
sleep 2
if ! kill -0 $SUBSCRIBER_PID 2>/dev/null; then
    log_error "SQS Subscriber failed to start"
    exit 1
fi

# Start Prefect Worker (optional)
if [ "$ENABLE_PREFECT_WORKER" = "true" ]; then
    if [ -z "$PREFECT_API_URL" ]; then
        log_warn "PREFECT_API_URL not set, skipping Prefect worker"
    else
        log "Starting Prefect Worker for pool: $PREFECT_WORK_POOL..."
        prefect worker start --pool "$PREFECT_WORK_POOL" &
        WORKER_PID=$!
        log "Prefect Worker started (PID: $WORKER_PID)"
    fi
else
    log "Prefect Worker disabled (ENABLE_PREFECT_WORKER=false)"
fi

log "All services started successfully!"
log "Brain Service: http://localhost:$BRAIN_PORT"
log "Health Check: http://localhost:$BRAIN_PORT/health"

# Wait for all background processes
wait
