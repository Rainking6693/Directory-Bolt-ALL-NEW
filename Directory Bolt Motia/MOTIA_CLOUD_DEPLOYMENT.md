# Deploying DirectoryBolt to Motia Cloud

This guide walks you through deploying your DirectoryBolt application to Motia Cloud.

## Prerequisites

1. A Motia Cloud account (sign up at https://motia.cloud)
2. The DirectoryBolt Motia application (this repository)
3. Environment variables configured in your `.env` file

## Deployment Steps

### 1. Prepare Your Application

Ensure your application is ready for deployment:

```bash
# Navigate to your project directory
cd directory-bolt-motia

# Make sure all dependencies are installed
npm install

# Verify the application builds correctly
npx motia build
```

### 2. Create a Motia Cloud Account

If you don't already have one:
1. Visit https://motia.cloud
2. Click "Sign Up" and follow the registration process
3. Verify your email address

### 3. Install the Motia CLI

```bash
# Install the Motia CLI globally
npm install -g motia

# Login to your Motia Cloud account
npx motia login
```

Follow the prompts to authenticate with your Motia Cloud account.

### 4. Configure Environment Variables

Before deploying, you need to set up your environment variables in Motia Cloud:

```bash
# Set environment variables (replace with your actual values)
npx motia env:set ANTHROPIC_API_KEY=your_actual_anthropic_key
npx motia env:set GEMINI_API_KEY=your_actual_gemini_key
npx motia env:set SUPABASE_URL=your_actual_supabase_url
npx motia env:set SUPABASE_SERVICE_ROLE_KEY=your_actual_supabase_service_key
npx motia env:set SUPABASE_ANON_KEY=your_actual_supabase_anon_key
npx motia env:set AWS_DEFAULT_ACCESS_KEY_ID=your_actual_aws_key_id
npx motia env:set AWS_DEFAULT_SECRET_ACCESS_KEY=your_actual_aws_secret_key
npx motia env:set AWS_DEFAULT_REGION=us-east-1
npx motia env:set SQS_QUEUE_URL=your_actual_sqs_queue_url
```

Alternatively, you can set environment variables through the Motia Cloud dashboard:
1. Go to your project in the Motia Cloud dashboard
2. Navigate to the "Settings" tab
3. Find the "Environment Variables" section
4. Add each variable with its corresponding value

### 5. Deploy Your Application

Deploy your application to Motia Cloud:

```bash
# Deploy the application
npx motia deploy
```

The CLI will:
1. Build your application
2. Upload the code to Motia Cloud
3. Provision necessary resources
4. Start your application

### 6. Monitor Deployment

Watch the deployment progress:

```bash
# View deployment logs
npx motia logs

# Check application status
npx motia status
```

### 7. Access Your Application

Once deployed, your application will be available at a URL provided by Motia Cloud (e.g., `https://your-app-name.motia.cloud`).

You can also find this URL in:
1. The deployment output
2. Your project dashboard in Motia Cloud
3. By running `npx motia status`

## Configuration After Deployment

### Custom Domain (Optional)

To use a custom domain:
1. In the Motia Cloud dashboard, go to your project
2. Navigate to the "Domains" tab
3. Add your custom domain
4. Follow the DNS configuration instructions

### Scaling (Optional)

Motia Cloud automatically scales your application, but you can configure specific scaling settings:
1. In the Motia Cloud dashboard, go to your project
2. Navigate to the "Scaling" tab
3. Adjust the minimum and maximum instances as needed

## Managing Your Application

### Viewing Logs

```bash
# View real-time logs
npx motia logs

# View recent logs
npx motia logs --recent
```

### Restarting Your Application

```bash
# Restart the application
npx motia restart
```

### Updating Environment Variables

```bash
# Update an environment variable
npx motia env:set VARIABLE_NAME=new_value

# The application will automatically restart with new environment variables
```

### Redeploying

After making code changes:

```bash
# Redeploy the application
npx motia deploy
```

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   - Check build logs: `npx motia logs --build`
   - Ensure all dependencies are properly declared in package.json
   - Verify environment variables are correctly set

2. **Application Crashes**
   - Check runtime logs: `npx motia logs`
   - Verify environment variables are correctly configured
   - Ensure your application listens on the correct port (provided by Motia Cloud)

3. **Performance Issues**
   - Check resource usage in the Motia Cloud dashboard
   - Consider adjusting scaling settings
   - Optimize your code for better performance

### Getting Help

If you encounter issues:
1. Check the Motia documentation: https://docs.motia.cloud
2. Contact Motia support through the dashboard
3. Join the Motia community Discord: https://discord.gg/motia

## Best Practices

1. **Environment Variables**
   - Never commit sensitive environment variables to version control
   - Use the Motia Cloud dashboard or CLI to manage secrets

2. **Monitoring**
   - Regularly check application logs
   - Set up alerts for critical errors
   - Monitor performance metrics

3. **Backups**
   - Regularly backup your Supabase database
   - Keep copies of important environment variables

4. **Security**
   - Rotate API keys regularly
   - Use strong authentication for administrative endpoints
   - Keep dependencies up to date

## Cost Management

Motia Cloud offers transparent pricing:
1. Monitor your usage in the dashboard
2. Set budget alerts to avoid unexpected charges
3. Consider using the free tier for development and testing

For detailed pricing information, visit: https://motia.cloud/pricing