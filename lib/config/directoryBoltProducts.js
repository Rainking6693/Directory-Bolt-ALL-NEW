// 🎯 DIRECTORYBOLT PRODUCT CONFIGURATION - ONE-TIME PAYMENTS ONLY
// Product definitions for DirectoryBolt checkout system
// UPDATED: Now supports ONLY one-time packages and add-ons - NO SUBSCRIPTIONS

/**
 * DirectoryBolt Core Packages (ONE-TIME PAYMENTS ONLY)
 * These are one-time purchases for PERMANENT tier access and directory submissions
 * Prices: Starter $149, Growth $299, Professional $499, Enterprise $799 - ALL ONE-TIME
 */
const CORE_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 14900, // $149.00 ONE-TIME - AI-enhanced value pricing
    directory_count: 25,
    payment_type: 'one_time',
    tier_access: 'starter', // Permanent tier access after purchase
    description: 'AI-powered directory analysis for small businesses - ONE-TIME PURCHASE',
    ai_features: [
      'Basic AI business analysis ($800 value)',
      'AI-optimized directory matching',
      'Automated competitive positioning',
      'AI-generated business insights'
    ],
    features: [
      '25 AI-optimized directory submissions',
      'Basic AI competitive analysis',
      'AI-powered business profile optimization',
      'Email support',
      '30-day completion guarantee',
      'AI insights dashboard',
      'PERMANENT STARTER TIER ACCESS - No recurring fees'
    ],
    value_proposition: {
      consultant_equivalent: '$2,000+',
      research_value: '$600+',
      total_value: '$2,600+',
      savings_percentage: '94%'
    },
    stripe_price_id: process.env.STRIPE_STARTER_ONE_TIME_PRICE_ID || 'price_starter_one_time_dev_mock',
    popular: false
  },
  
  growth: {
    id: 'growth', 
    name: 'Growth',
    price: 29900, // $299.00 ONE-TIME - Premium AI value
    directory_count: 75,
    payment_type: 'one_time',
    tier_access: 'growth', // Permanent tier access after purchase
    description: 'Comprehensive AI business intelligence platform - ONE-TIME PURCHASE',
    ai_features: [
      'Advanced AI competitive analysis ($1,200 value)',
      'AI-powered market research ($800 value)', 
      'Intelligent directory prioritization',
      'AI business strategy recommendations',
      'Automated revenue projections ($400 value)'
    ],
    features: [
      '75 AI-optimized directory submissions',
      'Comprehensive AI competitive analysis',
      'AI market research & insights',
      'Priority processing & support',
      'AI-powered revenue projections',
      'Advanced analytics dashboard',
      'AI business strategy recommendations',
      'PERMANENT GROWTH TIER ACCESS - No recurring fees'
    ],
    value_proposition: {
      consultant_equivalent: '$2,500+',
      research_value: '$1,200+',
      total_value: '$3,800+',
      savings_percentage: '92%'
    },
    stripe_price_id: process.env.STRIPE_GROWTH_ONE_TIME_PRICE_ID || 'price_growth_one_time_dev_mock',
    popular: true,
    badge: 'MOST POPULAR'
  },
  
  professional: {
    id: 'professional',
    name: 'Professional', 
    price: 49900, // $499.00 ONE-TIME - Enterprise AI value
    directory_count: 150,
    payment_type: 'one_time',
    tier_access: 'professional', // Permanent tier access after purchase
    description: 'Enterprise AI business intelligence with custom research - ONE-TIME PURCHASE',
    ai_features: [
      'Custom AI market research ($1,500 value)',
      'White-label AI reports ($800 value)',
      'AI competitor intelligence tracking',
      'Custom AI business modeling',
      'AI-powered growth strategy development'
    ],
    features: [
      '150 AI-optimized directory submissions',
      'Custom AI market research reports',
      'White-label AI business intelligence',
      'Phone & priority support',
      'AI competitor intelligence tracking',
      'Custom AI business modeling',
      'API access for integrations',
      'Quarterly AI strategy sessions',
      'PERMANENT PROFESSIONAL TIER ACCESS - No recurring fees'
    ],
    value_proposition: {
      consultant_equivalent: '$3,000+',
      research_value: '$1,500+',
      total_value: '$4,500+',
      savings_percentage: '89%'
    },
    stripe_price_id: process.env.STRIPE_PROFESSIONAL_ONE_TIME_PRICE_ID || 'price_professional_one_time_dev_mock',
    popular: false
  },
  
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 79900, // $799.00 ONE-TIME - Full AI intelligence suite
    directory_count: 500,
    payment_type: 'one_time',
    tier_access: 'enterprise', // Permanent tier access after purchase
    description: 'Full AI-powered business intelligence suite - ONE-TIME PURCHASE',
    ai_features: [
      'Full AI intelligence suite ($2,000 value)',
      'Dedicated AI analyst ($1,500 value)',
      'Custom AI business modeling ($1,000 value)',
      'AI-powered market expansion planning',
      'Real-time AI competitive monitoring'
    ],
    features: [
      '500+ AI-optimized directory submissions',
      'Dedicated AI business analyst',
      'Full AI intelligence suite',
      'Dedicated account management',
      'Custom AI business modeling',
      'Quarterly AI strategy sessions',
      'White-label AI reports',
      'API access & custom integrations',
      'Real-time AI market monitoring',
      'PERMANENT ENTERPRISE TIER ACCESS - No recurring fees'
    ],
    value_proposition: {
      consultant_equivalent: '$4,000+',
      research_value: '$2,000+',
      total_value: '$6,000+',
      savings_percentage: '87%'
    },
    stripe_price_id: process.env.STRIPE_ENTERPRISE_ONE_TIME_PRICE_ID || 'price_enterprise_one_time_dev_mock',
    popular: false,
    badge: 'PREMIUM'
  }
};

/**
 * DEPRECATED: DirectoryBolt Subscription Services
 * NOTE: This application now uses ONE-TIME PAYMENTS only.
 * Subscription model has been completely removed.
 * All tiers provide permanent access after one-time purchase.
 */
const DEPRECATED_SUBSCRIPTION_SERVICES = {
  // REMOVED - No longer using subscription model
  // All features are now included in one-time tier purchases
  // Auto-updates and resubmissions are included in Growth+ tiers
};

/**
 * DirectoryBolt Add-Ons (One-time upsells)
 * These can be added to any core package purchase
 */
const ADD_ONS = {
  fast_track: {
    id: 'fast_track',
    name: 'Fast-track Submission',
    price: 2500, // $25.00 in cents
    description: 'Complete your submissions in 1-2 business days',
    features: [
      'Priority processing queue',
      '1-2 business day completion',
      'Daily progress updates',
      'Dedicated submission specialist'
    ],
    stripe_price_id: process.env.STRIPE_FAST_TRACK_PRICE_ID || 'price_fast_track_dev_mock',
    compatible_packages: ['starter', 'growth', 'pro']
  },
  
  premium_directories: {
    id: 'premium_directories',
    name: 'Premium Directories Only',
    price: 1500, // $15.00 in cents  
    description: 'Submit only to high-authority, premium directories',
    features: [
      'Curated premium directory list',
      'Higher domain authority sites',
      'Better SEO impact',
      'Quality over quantity approach'
    ],
    stripe_price_id: process.env.STRIPE_PREMIUM_DIRECTORIES_PRICE_ID || 'price_premium_directories_dev_mock',
    compatible_packages: ['starter', 'growth', 'pro']
  },
  
  manual_qa: {
    id: 'manual_qa',
    name: 'Manual QA Review',
    price: 1000, // $10.00 in cents
    description: 'Human quality assurance review of all submissions',
    features: [
      'Manual review by QA specialist',
      'Error detection and correction',
      'Submission optimization suggestions',
      'Quality guarantee'
    ],
    stripe_price_id: process.env.STRIPE_MANUAL_QA_PRICE_ID || 'price_manual_qa_dev_mock',
    compatible_packages: ['starter', 'growth', 'pro']
  },
  
  csv_export: {
    id: 'csv_export',
    name: 'CSV Export',
    price: 900, // $9.00 in cents
    description: 'Download detailed CSV report of all submissions',
    features: [
      'Comprehensive CSV export',
      'All submission details',
      'Status tracking information',
      'Import into other tools'
    ],
    stripe_price_id: process.env.STRIPE_CSV_EXPORT_PRICE_ID || 'price_csv_export_dev_mock',
    compatible_packages: ['starter', 'growth', 'pro']
  }
};

/**
 * Calculate total price for a ONE-TIME package with add-ons
 * Subscriptions are no longer supported - all payments are one-time
 */
function calculateTotalPrice(packageId, addOnIds = []) {
  let total = 0;
  
  // Add core package price (one-time only)
  if (CORE_PACKAGES[packageId]) {
    total += CORE_PACKAGES[packageId].price;
  }
  
  // Add add-on prices (one-time only)
  addOnIds.forEach(addOnId => {
    if (ADD_ONS[addOnId]) {
      total += ADD_ONS[addOnId].price;
    }
  });
  
  return total;
}

/**
 * Validate package and add-on compatibility
 */
function validatePackageConfiguration(packageId, addOnIds = []) {
  const errors = [];
  
  // Validate core package exists
  if (!CORE_PACKAGES[packageId]) {
    errors.push(`Invalid package ID: ${packageId}`);
    return { valid: false, errors };
  }
  
  // Validate add-ons
  addOnIds.forEach(addOnId => {
    const addOn = ADD_ONS[addOnId];
    if (!addOn) {
      errors.push(`Invalid add-on ID: ${addOnId}`);
    } else if (!addOn.compatible_packages.includes(packageId)) {
      errors.push(`Add-on "${addOnId}" is not compatible with package "${packageId}"`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * Get all line items for ONE-TIME PAYMENT Stripe checkout
 * Updated to use price_data instead of subscription price IDs
 */
function getOneTimeCheckoutLineItems(packageId, addOnIds = []) {
  const lineItems = [];
  
  // Add core package for one-time payment
  if (CORE_PACKAGES[packageId]) {
    const package_data = CORE_PACKAGES[packageId];
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: package_data.price,
        product_data: {
          name: package_data.name + ' - ONE-TIME PURCHASE',
          description: package_data.description,
          metadata: {
            package_id: packageId,
            payment_type: 'one_time',
            tier_access: package_data.tier_access,
            directory_count: package_data.directory_count.toString()
          }
        }
      },
      quantity: 1
    });
  }
  
  // Add add-ons for one-time payment
  addOnIds.forEach(addOnId => {
    if (ADD_ONS[addOnId]) {
      const addon = ADD_ONS[addOnId];
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: addon.price,
          product_data: {
            name: addon.name,
            description: addon.description,
            metadata: {
              addon_id: addOnId,
              payment_type: 'one_time'
            }
          }
        },
        quantity: 1
      });
    }
  });
  
  return lineItems;
}

/**
 * Get order summary for display
 */
function getOrderSummary(packageId, addOnIds = []) {
  const summary = {
    package: CORE_PACKAGES[packageId] || null,
    addOns: addOnIds.map(id => ADD_ONS[id]).filter(Boolean),
    totalPrice: calculateTotalPrice(packageId, addOnIds),
    totalDirectories: CORE_PACKAGES[packageId]?.directory_count || 0
  };
  
  return summary;
}

/**
 * Check if environment variables are properly configured
 */
function validateStripeConfiguration() {
  const required = {
    secret_key: process.env.STRIPE_SECRET_KEY,
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET
  };
  
  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missing.length > 0) {
    return {
      configured: false,
      missing: missing,
      message: `Missing required environment variables: ${missing.join(', ')}`
    };
  }
  
  // Check if we have one-time payment price IDs for core packages
  const oneTimePackagePriceIds = {
    starter_one_time: process.env.STRIPE_STARTER_ONE_TIME_PRICE_ID,
    growth_one_time: process.env.STRIPE_GROWTH_ONE_TIME_PRICE_ID,
    professional_one_time: process.env.STRIPE_PROFESSIONAL_ONE_TIME_PRICE_ID,
    enterprise_one_time: process.env.STRIPE_ENTERPRISE_ONE_TIME_PRICE_ID
  };
  
  const missingPriceIds = Object.entries(oneTimePackagePriceIds)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  return {
    configured: true,
    payment_model: 'one_time_only',
    development_mode: missingPriceIds.length > 0,
    missing_price_ids: missingPriceIds,
    note: 'DirectoryBolt now uses ONE-TIME PAYMENTS only - no subscriptions'
  };
}

/**
 * AI-Enhanced Business Intelligence Value Calculator
 * Calculates the total value delivered vs consultant/research costs
 */
function calculateBusinessValue(packageId) {
  const package_data = CORE_PACKAGES[packageId]
  if (!package_data || !package_data.value_proposition) return null
  
  return {
    consultant_savings: package_data.value_proposition.consultant_equivalent,
    research_savings: package_data.value_proposition.research_value || '$0',
    total_value: package_data.value_proposition.total_value,
    customer_investment: `$${(package_data.price / 100).toFixed(0)}`,
    savings_percentage: package_data.value_proposition.savings_percentage,
    roi_multiple: Math.round(parseInt(package_data.value_proposition.total_value.replace(/[$,+]/g, '')) / (package_data.price / 100))
  }
}

/**
 * Generate customer migration pricing for existing customers
 */
function getGrandfatherPricing(currentPlan, newPlan) {
  const discounts = {
    'starter_to_growth': 0.80, // 20% discount
    'growth_to_professional': 0.85, // 15% discount  
    'pro_to_professional': 0.75, // 25% discount (legacy naming)
    'any_to_enterprise': 0.90 // 10% discount
  }
  
  const migrationKey = `${currentPlan}_to_${newPlan}`
  const discount = discounts[migrationKey] || discounts['any_to_enterprise']
  const newPackage = CORE_PACKAGES[newPlan]
  
  if (!newPackage) return null
  
  return {
    original_price: newPackage.price,
    grandfathered_price: Math.round(newPackage.price * discount),
    discount_percentage: Math.round((1 - discount) * 100),
    migration_key: migrationKey,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  }
}

module.exports = {
  CORE_PACKAGES,
  DEPRECATED_SUBSCRIPTION_SERVICES, // Kept for migration reference only
  ADD_ONS,
  calculateTotalPrice, // Updated to remove subscription support
  validatePackageConfiguration,
  getOneTimeCheckoutLineItems, // NEW: Updated for one-time payments
  getCheckoutLineItems: getOneTimeCheckoutLineItems, // Alias for backward compatibility
  getOrderSummary,
  validateStripeConfiguration,
  // New AI-enhanced functions
  calculateBusinessValue,
  getGrandfatherPricing,
  // New one-time payment functions
  getPackageTierAccess: (packageId) => CORE_PACKAGES[packageId]?.tier_access,
  isOneTimePaymentModel: () => true, // Always true now
  getPaymentType: () => 'one_time' // Always one-time
};