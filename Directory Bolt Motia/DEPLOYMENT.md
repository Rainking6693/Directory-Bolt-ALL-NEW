# DirectoryBolt - Motia Implementation Deployment Guide

## Overview

This document provides instructions for deploying the DirectoryBolt Motia implementation, which replaces the existing 4 Render apps with a single cohesive Motia application.

## Prerequisites

1. Node.js (version 16 or higher)
2. npm or yarn package manager
3. Git (for version control)
4. Access to Supabase database
5. AI service API keys (Anthropic and/or Google Gemini)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd directory-bolt-motia
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see below)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# AI Service Keys (at least one required)
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# AWS Configuration (if using SQS)
AWS_DEFAULT_ACCESS_KEY_ID=your_aws_access_key
AWS_DEFAULT_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=us-east-1
SQS_QUEUE_URL=your_sqs_queue_url
```

## Development

To run the application locally for development:

```bash
npx motia dev
```

The application will be available at `http://localhost:3000`

## Building for Production

To build the application for production deployment:

```bash
npx motia build
```

## Deployment Options

### 1. Motia Cloud (Recommended)

Motia provides its own cloud hosting platform which is the easiest way to deploy your application:

1. Sign up at [Motia Cloud](https://motia.cloud)
2. Follow the deployment instructions in the Motia dashboard
3. Connect your Git repository
4. Configure environment variables in the dashboard

### 2. Docker Deployment

You can containerize the application using Docker:

1. Create a Dockerfile:
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["npx", "motia", "start"]
   ```

2. Build and run the container:
   ```bash
   docker build -t directory-bolt-motia .
   docker run -p 3000:3000 directory-bolt-motia
   ```

### 3. Traditional Node.js Hosting

You can deploy to any Node.js hosting platform (Heroku, DigitalOcean, AWS, etc.):

1. Build the application:
   ```bash
   npx motia build
   ```

2. Deploy the built files to your hosting platform

3. Ensure environment variables are set on the hosting platform

## API Endpoints

### Customer Portal APIs

- `POST /api/customer/submission` - Create a new directory submission job
- `GET /api/customer/jobs` - Get all jobs for the customer
- `GET /api/customer/jobs/{jobId}/status` - Get status of a specific job
- `GET /api/customer/directories` - Get all directories the customer has submitted to
- `GET /api/customer/stats` - Get customer statistics
- `GET /api/customer/analytics/performance` - Get performance analytics
- `GET /api/customer/analytics/directories` - Get directory success rates
- `DELETE /api/customer/submission/{jobId}` - Cancel a submission job

### Staff Dashboard APIs

- `GET /api/staff/jobs` - Get all jobs
- `GET /api/staff/jobs/active` - Get active jobs
- `GET /api/staff/jobs/{jobId}/results` - Get results for a specific job
- `GET /api/staff/jobs/{jobId}/history` - Get history for a specific job
- `GET /api/staff/stats` - Get system statistics

### Internal Service APIs

- `POST /plan` - AI-powered field mapping service
- `GET /health` - Health check endpoint
- `POST /api/realtime/subscribe` - Real-time updates configuration

## Migration from Render

### Current Render Services

1. **Brain Service** (Web Service) - FastAPI service for field mapping
2. **Subscriber Service** (Background Worker) - Polls SQS and triggers Prefect flows
3. **Worker Service** (Background Worker) - Executes directory submissions
4. **Monitor Service** (Background Worker) - Monitors for stale jobs

### Migration Steps

1. **Backup Current Data**
   - Export all data from Supabase
   - Document current environment variables
   - Take screenshots of the current dashboard

2. **Deploy New Application**
   - Deploy the Motia application using one of the deployment options above
   - Configure environment variables
   - Verify the application starts without errors

3. **Test Functionality**
   - Test API endpoints
   - Verify database connections
   - Test AI service integration
   - Verify real-time updates work

4. **Update Frontend**
   - Update API endpoints in the frontend to point to the new Motia backend
   - Update Supabase configuration if needed
   - Test the complete workflow

5. **Monitor and Verify**
   - Monitor logs for errors
   - Verify all features work as expected
   - Check performance metrics

6. **Decommission Old Services**
   - Once everything is verified, decommission the old Render services
   - Update DNS records if needed
   - Update documentation

## Benefits of Migration

1. **Simplified Operations**
   - Single deployment instead of managing 4 services
   - Reduced infrastructure complexity

2. **Unified Architecture**
   - All backend functionality in one codebase
   - Consistent development experience

3. **Built-in Observability**
   - Native tracing and debugging capabilities
   - Better error handling and monitoring

4. **Event-Driven Architecture**
   - More efficient processing with Motia's event system
   - Better scalability

5. **Reduced Complexity**
   - Eliminate inter-service communication issues
   - Simplified error handling

## Troubleshooting

### Common Issues

1. **Module Not Found Errors**
   - Ensure all dependencies are installed: `npm install`
   - Check that the motia package is properly installed

2. **Environment Variables Not Set**
   - Verify all required environment variables are set
   - Check for typos in variable names

3. **Database Connection Issues**
   - Verify Supabase credentials are correct
   - Check network connectivity to Supabase

4. **AI Service Errors**
   - Verify API keys are correct
   - Check AI service quotas and limits

### Getting Help

If you encounter issues not covered in this guide:

1. Check the Motia documentation: https://docs.motia.dev
2. Join the Motia Discord community: https://discord.gg/motia
3. File an issue on the GitHub repository

## Support

For support with this DirectoryBolt implementation, contact the development team or refer to the project documentation.