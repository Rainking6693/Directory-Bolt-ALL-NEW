# Root Dockerfile for Railway
# This orchestrates all services via docker-compose
FROM docker/compose:latest

WORKDIR /app

# Copy docker-compose.yml and all Dockerfiles
COPY backend/infra/docker-compose.yml /app/docker-compose.yml
COPY backend/infra/*.dockerfile /app/
COPY backend/ /app/backend/

# Install docker-compose if not available
RUN apk add --no-cache docker-compose || \
    pip3 install docker-compose || \
    echo "docker-compose should be available"

# Start all services
CMD ["docker-compose", "up", "-d"]

