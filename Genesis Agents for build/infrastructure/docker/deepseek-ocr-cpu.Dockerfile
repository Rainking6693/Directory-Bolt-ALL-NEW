# DeepSeek-OCR CPU-Optimized Dockerfile
# Optimized for AMD EPYC processors

FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    flask==3.0.0 \
    pytesseract==0.3.10 \
    pillow==10.1.0 \
    redis==5.0.1 \
    requests==2.31.0

# Copy OCR service
COPY infrastructure/ocr/deepseek_ocr_service.py /app/deepseek_ocr_service.py

# Create cache directory
RUN mkdir -p /cache

# Expose service port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run service
CMD ["python", "deepseek_ocr_service.py"]
