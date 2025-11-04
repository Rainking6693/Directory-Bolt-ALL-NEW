# Master Dockerfile for Render
# This runs the subscriber service which is the main entry point
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (from parent directory)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code (from parent backend/ directory)
COPY orchestration /app/orchestration/
COPY workers /app/workers/
COPY brain /app/brain/
COPY db /app/db/
COPY utils /app/utils/
COPY AI /app/AI/

# Set Python path
ENV PYTHONPATH=/app

# Expose port (for health checks)
EXPOSE 8080

# Start subscriber (this is the main service that triggers Prefect flows)
CMD ["python", "orchestration/subscriber.py"]

