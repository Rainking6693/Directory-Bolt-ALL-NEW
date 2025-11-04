# Dockerfile that works with Render's current settings
# Build context: backend/infra/.
# This means we're already IN the infra directory
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (build context is backend/, so files are directly accessible)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (build context is backend/, so all dirs are accessible)
COPY orchestration /app/orchestration/
COPY workers /app/workers/
COPY brain /app/brain/
COPY db /app/db/
COPY utils /app/utils/
# AI directory - only copy if it exists (subscriber doesn't need it)
# COPY AI /app/AI/

# Set Python path
ENV PYTHONPATH=/app

# Expose port for health checks
EXPOSE 8080

# Start subscriber
CMD ["python", "orchestration/subscriber.py"]
