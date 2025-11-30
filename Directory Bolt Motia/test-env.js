// Test script to verify environment variables are properly configured
console.log('Testing Environment Variables Configuration...\n');

// Required environment variables
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
];

// Optional environment variables
const optionalEnvVars = [
  'AWS_DEFAULT_ACCESS_KEY_ID',
  'AWS_DEFAULT_SECRET_ACCESS_KEY',
  'AWS_DEFAULT_REGION',
  'SQS_QUEUE_URL'
];

console.log('=== Required Environment Variables ===');
let allRequiredPresent = true;

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✓ ${envVar}: SET`);
  } else {
    console.log(`✗ ${envVar}: NOT SET`);
    allRequiredPresent = false;
  }
});

console.log('\n=== Optional Environment Variables ===');

optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✓ ${envVar}: SET`);
  } else {
    console.log(`○ ${envVar}: NOT SET (optional)`);
  }
});

console.log('\n=== Summary ===');
if (allRequiredPresent) {
  console.log('✓ All required environment variables are set');
  console.log('✓ Application is ready for deployment');
} else {
  console.log('✗ Some required environment variables are missing');
  console.log('✗ Please set all required environment variables before deployment');
}

console.log('\nNote: You can set environment variables by:');
console.log('1. Creating a .env file with your values');
console.log('2. Setting them in your deployment environment');
console.log('3. Using the Motia Cloud dashboard or CLI');