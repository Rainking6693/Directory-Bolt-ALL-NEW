# DirectoryBolt Deployment Checklist

This checklist ensures you've completed all necessary steps for deploying DirectoryBolt with the new Motia backend.

## Pre-Deployment Checklist

### Environment Configuration
- [ ] Update `.env` file with actual API keys and configuration values
- [ ] Verify all required environment variables are set:
  - [ ] `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` (at least one AI service)
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_ANON_KEY`
- [ ] Set optional environment variables if needed:
  - [ ] `AWS_DEFAULT_ACCESS_KEY_ID`
  - [ ] `AWS_DEFAULT_SECRET_ACCESS_KEY`
  - [ ] `AWS_DEFAULT_REGION`
  - [ ] `SQS_QUEUE_URL`

### Code Preparation
- [ ] Verify all TypeScript files compile without errors
- [ ] Test API endpoints locally with `npx motia dev`
- [ ] Confirm database connection works with Supabase
- [ ] Verify AI service integrations work correctly

### Frontend Updates
- [ ] Update frontend to use new API endpoints (see FRONTEND_INTEGRATION.md)
- [ ] Test customer portal functionality
- [ ] Test staff dashboard functionality
- [ ] Verify real-time updates work correctly

## Deployment Options

### Motia Cloud Deployment
- [ ] Create Motia Cloud account
- [ ] Install Motia CLI
- [ ] Login to Motia Cloud: `npx motia login`
- [ ] Set environment variables in Motia Cloud
- [ ] Deploy application: `npx motia deploy`
- [ ] Verify deployment success
- [ ] Test application at deployed URL

### Docker Deployment
- [ ] Build Docker image: `docker build -t directory-bolt .`
- [ ] Run container with environment variables:
  ```bash
  docker run -p 3000:3000 \
    -e ANTHROPIC_API_KEY=your_key \
    -e SUPABASE_URL=your_url \
    -e SUPABASE_SERVICE_ROLE_KEY=your_key \
    -e SUPABASE_ANON_KEY=your_key \
    directory-bolt
  ```
- [ ] Verify container is running correctly
- [ ] Test application at http://localhost:3000

### Traditional Node.js Deployment
- [ ] Ensure Node.js (v16+) is installed on target server
- [ ] Copy application files to server
- [ ] Install dependencies: `npm install`
- [ ] Set environment variables on server
- [ ] Start application: `npx motia start`
- [ ] Configure reverse proxy (nginx, Apache, etc.) if needed
- [ ] Test application

## Post-Deployment Verification

### API Endpoints
- [ ] Test `/hello` endpoint
- [ ] Test `/health` endpoint
- [ ] Test customer portal endpoints
- [ ] Test staff dashboard endpoints
- [ ] Test `/plan` endpoint (AI field mapping)

### Database Integration
- [ ] Verify connection to Supabase
- [ ] Test CRUD operations
- [ ] Verify real-time subscriptions work

### AI Services
- [ ] Test Anthropic integration (if configured)
- [ ] Test Gemini integration (if configured)
- [ ] Verify fallback to rule-based mapping works

### Background Processing
- [ ] Test job creation and processing
- [ ] Verify progress tracking works
- [ ] Test error handling and retries

## Monitoring and Maintenance

### Logging
- [ ] Set up log aggregation (if needed)
- [ ] Configure log retention policies
- [ ] Set up log alerts for errors

### Performance Monitoring
- [ ] Monitor response times
- [ ] Track resource utilization
- [ ] Set up performance alerts

### Security
- [ ] Rotate API keys regularly
- [ ] Monitor for unauthorized access
- [ ] Keep dependencies updated

### Backups
- [ ] Implement regular database backups
- [ ] Backup environment configurations
- [ ] Test restore procedures

## Rollback Plan

### If Issues Occur
- [ ] Document current deployment state
- [ ] Identify root cause of issues
- [ ] If critical issues found, prepare rollback:
  - [ ] Restore previous version from version control
  - [ ] Restore database from backup if needed
  - [ ] Revert environment changes if necessary

### Communication
- [ ] Notify stakeholders of deployment
- [ ] Provide status updates during deployment
- [ ] Communicate any issues or delays

## Success Criteria

Deployment is considered successful when:
- [ ] All API endpoints respond correctly
- [ ] Frontend integrates successfully with new backend
- [ ] Database operations work as expected
- [ ] AI services function properly
- [ ] Background job processing works
- [ ] Real-time updates are received
- [ ] Performance meets expectations
- [ ] No critical errors in logs

## Support Contacts

- **Development Team**: [Insert contact information]
- **Motia Support**: https://motia.cloud/support
- **Supabase Support**: https://supabase.com/support
- **AI Service Support**:
  - Anthropic: https://www.anthropic.com/contact
  - Google Gemini: https://cloud.google.com/support

## Documentation

Ensure all documentation is updated:
- [ ] Deployment guide
- [ ] Frontend integration guide
- [ ] API documentation
- [ ] Troubleshooting guide
- [ ] Operational procedures