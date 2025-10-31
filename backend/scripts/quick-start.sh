#!/bin/bash
# Quick start script for DirectoryBolt backend

set -e

echo "🚀 DirectoryBolt Backend - Quick Start"
echo "======================================"

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ Error: .env file not found"
    echo "📝 Copy backend/.env.example to backend/.env and fill in your credentials"
    exit 1
fi

# Load environment variables
export $(cat backend/.env | grep -v '^#' | xargs)

echo "✅ Environment variables loaded"

# Check required variables
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "SQS_QUEUE_URL")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var not set in .env"
        exit 1
    fi
done

echo "✅ Required variables present"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd backend
pip install -r requirements.txt
playwright install chromium

echo "✅ Dependencies installed"

# Run database migrations
echo "🗄️  Running database migrations..."
echo "⚠️  Please run these SQL files in your Supabase SQL Editor:"
echo "   1. db/migrations/001_job_results_idem.sql"
echo "   2. db/migrations/002_worker_heartbeats.sql"
echo "   3. db/migrations/003_queue_history.sql"
read -p "Press Enter when migrations are complete..."

# Start Docker services
echo "🐳 Starting Docker services..."
cd infra
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
curl -f http://localhost:4200/api/health || echo "⚠️  Prefect server not ready yet"
curl -f http://localhost:8080/health || echo "⚠️  Brain service not ready yet"

echo ""
echo "✅ Services started!"
echo ""
echo "📊 Access points:"
echo "   - Prefect UI: http://localhost:4200"
echo "   - Brain API: http://localhost:8080/docs"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy Prefect flow: cd backend && python -m prefect deployment build orchestration/flows.py:process_job -n production"
echo "   2. Start subscriber: python orchestration/subscriber.py"
echo "   3. Send test message to SQS"
echo ""
echo "📖 See backend/ops/README.md for full documentation"
