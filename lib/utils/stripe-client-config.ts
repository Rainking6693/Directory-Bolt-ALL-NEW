// 🔒 STRIPE CLIENT CONFIGURATION - Frontend Stripe configuration validation
// Validates client-side Stripe environment variables and provides fallback handling

export interface StripeClientConfig {
  publishableKey: string;
  isTestMode: boolean;
  isConfigured: boolean;
  configurationErrors: string[];
  developmentMode: boolean;
}

/**
 * Validate and get Stripe client configuration
 * Handles both development and production environments
 */
export function getStripeClientConfig(): StripeClientConfig {
  const config: StripeClientConfig = {
    publishableKey: '',
    isTestMode: false,
    isConfigured: false,
    configurationErrors: [],
    developmentMode: process.env.NODE_ENV !== 'production'
  };

  // Try to get the publishable key from environment
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    config.configurationErrors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured');
    return config;
  }

  // Check if it's a mock/placeholder key
  if (publishableKey.includes('mock') || 
      publishableKey.includes('test_123') || 
      publishableKey.includes('your_key_here') ||
      publishableKey.includes('replace_with_actual')) {
    config.configurationErrors.push('Stripe publishable key appears to be a placeholder/mock value');
    // In development mode, we'll allow mock keys but mark as not configured for production use
    if (config.developmentMode) {
      config.publishableKey = publishableKey;
      config.isTestMode = true;
      config.isConfigured = false; // Mock keys don't count as properly configured
    }
    return config;
  }

  // Validate key format
  if (!publishableKey.startsWith('pk_')) {
    config.configurationErrors.push('Stripe publishable key must start with "pk_"');
    return config;
  }

  // Determine if it's test or live mode
  config.isTestMode = publishableKey.startsWith('pk_test_');
  const isLiveMode = publishableKey.startsWith('pk_live_');
  
  if (!config.isTestMode && !isLiveMode) {
    config.configurationErrors.push('Invalid Stripe publishable key format');
    return config;
  }

  // Warn about test keys in production
  if (config.isTestMode && !config.developmentMode) {
    config.configurationErrors.push('Using test Stripe key in production environment');
  }

  // Warn about live keys in development
  if (isLiveMode && config.developmentMode) {
    config.configurationErrors.push('Using live Stripe key in development environment');
  }

  config.publishableKey = publishableKey;
  config.isConfigured = true;

  return config;
}

/**
 * Check if Stripe is properly configured for the current environment
 */
export function isStripeConfigured(): boolean {
  const config = getStripeClientConfig();
  return config.isConfigured && config.configurationErrors.length === 0;
}

/**
 * Get user-friendly error message for Stripe configuration issues
 */
export function getStripeConfigurationMessage(): {
  isConfigured: boolean;
  message: string;
  type: 'error' | 'warning' | 'info';
  recommendations?: string[];
} {
  const config = getStripeClientConfig();
  
  if (config.isConfigured && config.configurationErrors.length === 0) {
    return {
      isConfigured: true,
      message: `Stripe is configured in ${config.isTestMode ? 'test' : 'live'} mode`,
      type: 'info'
    };
  }

  if (config.configurationErrors.length === 0) {
    return {
      isConfigured: false,
      message: 'Stripe configuration is valid but not fully set up',
      type: 'info'
    };
  }

  // Handle specific error cases
  const hasPlaceholderKey = config.configurationErrors.some(err => 
    err.includes('placeholder') || err.includes('mock')
  );
  
  const hasMissingKey = config.configurationErrors.some(err => 
    err.includes('not configured')
  );

  if (hasMissingKey) {
    return {
      isConfigured: false,
      message: config.developmentMode 
        ? 'Payment system is running in development mode'
        : 'Payment system is not configured',
      type: config.developmentMode ? 'warning' : 'error',
      recommendations: config.developmentMode 
        ? [
            'Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment variables',
            'Get your keys from https://dashboard.stripe.com/apikeys',
            'Use test keys (pk_test_) for development'
          ]
        : [
            'Contact support to resolve payment configuration',
            'Payment functionality is temporarily unavailable'
          ]
    };
  }

  if (hasPlaceholderKey) {
    return {
      isConfigured: false,
      message: config.developmentMode
        ? 'Running with mock payment configuration'
        : 'Payment system configuration incomplete',
      type: config.developmentMode ? 'warning' : 'error',
      recommendations: config.developmentMode
        ? [
            'Replace mock keys with real Stripe keys for testing',
            'Get test keys from https://dashboard.stripe.com/apikeys',
            'Use pk_test_ keys for development'
          ]
        : [
            'Contact support to resolve payment configuration',
            'Payment functionality is temporarily unavailable'
          ]
    };
  }

  // Generic error handling
  return {
    isConfigured: false,
    message: config.developmentMode
      ? 'Payment configuration has issues'
      : 'Payment system temporarily unavailable',
    type: 'error',
    recommendations: config.developmentMode
      ? [
          'Check your Stripe configuration',
          'Verify environment variables are set correctly',
          'See browser console for detailed error information'
        ]
      : [
          'Please try again later',
          'Contact support if the issue persists'
        ]
  };
}

/**
 * Log Stripe configuration status for debugging
 */
export function logStripeClientConfig(): void {
  if (typeof window === 'undefined') return; // Only log in browser
  
  const config = getStripeClientConfig();
  
  console.group('🔒 Stripe Client Configuration');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Configured:', config.isConfigured);
  console.log('Test Mode:', config.isTestMode);
  console.log('Development Mode:', config.developmentMode);
  
  if (config.publishableKey) {
    console.log('Publishable Key:', config.publishableKey.substring(0, 12) + '...');
  }
  
  if (config.configurationErrors.length > 0) {
    console.group('❌ Configuration Errors:');
    config.configurationErrors.forEach(error => console.warn('⚠️', error));
    console.groupEnd();
  }
  
  console.groupEnd();
}

export default getStripeClientConfig;