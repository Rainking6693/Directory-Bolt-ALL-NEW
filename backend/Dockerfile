# Production Dockerfile for DirectoryBolt Backend
# Optimized for Render deployment with Playwright + Chromium
FROM python:3.11-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only for smaller image)
# System deps already installed above, just install browser binaries
RUN playwright install chromium

# Copy application code
COPY orchestration /app/orchestration/
COPY workers /app/workers/
COPY brain /app/brain/
COPY db /app/db/
COPY utils /app/utils/
# AI directory is optional - code handles ImportError gracefully
# COPY AI /app/AI/

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Set Python path
ENV PYTHONPATH=/app

# Expose ports
# 8080: Brain service (FastAPI)
# 4200: Prefect API (if running worker)
EXPOSE 8080 4200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start services via start.sh
CMD ["./start.sh"]
