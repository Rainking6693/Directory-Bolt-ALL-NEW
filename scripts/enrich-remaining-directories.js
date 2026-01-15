/**
 * Directory Enrichment Script - REMAINING DIRECTORIES
 *
 * This script fetches directories where last_verified_at IS NULL
 * (meaning they haven't been processed yet), visits each submission_url
 * to verify it works, and enriches the data.
 * Dead/broken URLs are deleted, live ones are updated with enriched data.
 */

const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

// Supabase configuration
const SUPABASE_URL = 'https://kolgqfjgncdwddziqloz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjczODc2MSwiZXhwIjoyMDcyMzE0NzYxfQ.xPoR2Q_yey7AQcorPG3iBLKTadzzSEMmK3eM9ZW46Qc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Statistics tracking
const stats = {
  total: 0,
  deleted: 0,
  enriched: 0,
  skipped: 0,
  errors: []
};

// Common form field patterns to detect
const FIELD_PATTERNS = {
  required: {
    name: ['name', 'business_name', 'company_name', 'title', 'site_name', 'website_name'],
    url: ['url', 'website', 'site_url', 'homepage', 'link', 'website_url'],
    email: ['email', 'contact_email', 'e-mail', 'mail'],
    description: ['description', 'desc', 'about', 'summary', 'bio', 'content'],
    category: ['category', 'categories', 'type', 'industry', 'niche'],
  },
  optional: {
    phone: ['phone', 'telephone', 'mobile', 'tel'],
    address: ['address', 'location', 'street'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'postal', 'postcode', 'zipcode'],
    country: ['country', 'nation'],
    logo: ['logo', 'image', 'icon', 'avatar', 'thumbnail'],
    tags: ['tags', 'keywords', 'tag'],
    social: ['facebook', 'twitter', 'linkedin', 'instagram', 'social'],
  }
};

// Captcha detection patterns
const CAPTCHA_PATTERNS = [
  'recaptcha',
  'g-recaptcha',
  'h-captcha',
  'hcaptcha',
  'captcha',
  'turnstile',
  'cf-turnstile',
  'arkoselabs',
  'funcaptcha',
];

// Payment detection patterns
const PAYMENT_PATTERNS = [
  'payment',
  'pay now',
  'checkout',
  'add to cart',
  'buy now',
  'purchase',
  'subscribe',
  'premium',
  'pricing',
  '$',
  'credit card',
  'stripe',
  'paypal',
];

// Niche/category detection patterns
const NICHE_PATTERNS = {
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural', 'gpt', 'llm'],
  saas: ['saas', 'software as a service', 'cloud software', 'web app', 'online tool'],
  startup: ['startup', 'startups', 'founder', 'venture', 'entrepreneur'],
  tech: ['tech', 'technology', 'software', 'digital', 'app', 'developer'],
  business: ['business', 'company', 'corporate', 'enterprise', 'b2b'],
  marketing: ['marketing', 'seo', 'advertising', 'promotion', 'growth'],
  ecommerce: ['ecommerce', 'e-commerce', 'shop', 'store', 'retail', 'product'],
  design: ['design', 'creative', 'ui', 'ux', 'graphic'],
  productivity: ['productivity', 'workflow', 'automation', 'efficiency'],
  tools: ['tools', 'utilities', 'resources', 'platform'],
  web: ['web', 'website', 'internet', 'online'],
  mobile: ['mobile', 'ios', 'android', 'app store'],
  finance: ['finance', 'fintech', 'banking', 'payment', 'crypto'],
  healthcare: ['healthcare', 'health', 'medical', 'wellness'],
  education: ['education', 'learning', 'course', 'training'],
};

/**
 * Analyze a page for form fields, captcha, payment requirements
 */
async function analyzePage(page) {
  const analysis = {
    required_fields: [],
    optional_fields: [],
    submission_method: 'web_form',
    captcha_type: null,
    requires_payment: false,
    cost_amount: 0,
    backlink_type: 'unknown',
    niche_tags: [],
    has_form: false,
  };

  try {
    // Get page content for analysis
    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const pageLower = pageContent.toLowerCase();
    const textLower = pageText.toLowerCase();

    // Check for forms
    const forms = await page.$$('form');
    analysis.has_form = forms.length > 0;

    // Analyze form fields
    const inputs = await page.$$eval('input, textarea, select', (elements) => {
      return elements.map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        required: el.required || el.hasAttribute('required'),
        label: el.labels?.[0]?.innerText || '',
      }));
    });

    // Categorize detected fields
    const detectedRequired = new Set();
    const detectedOptional = new Set();

    for (const input of inputs) {
      const fieldIdentifiers = [
        input.name.toLowerCase(),
        input.id.toLowerCase(),
        input.placeholder.toLowerCase(),
        input.label.toLowerCase(),
      ].join(' ');

      // Check required patterns
      for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS.required)) {
        if (patterns.some(p => fieldIdentifiers.includes(p))) {
          if (input.required) {
            detectedRequired.add(fieldName);
          } else {
            detectedOptional.add(fieldName);
          }
        }
      }

      // Check optional patterns
      for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS.optional)) {
        if (patterns.some(p => fieldIdentifiers.includes(p))) {
          detectedOptional.add(fieldName);
        }
      }
    }

    analysis.required_fields = Array.from(detectedRequired);
    analysis.optional_fields = Array.from(detectedOptional);

    // Detect captcha
    for (const pattern of CAPTCHA_PATTERNS) {
      if (pageLower.includes(pattern)) {
        if (pageLower.includes('recaptcha') || pageLower.includes('g-recaptcha')) {
          // Check for v2 vs v3
          if (pageLower.includes('recaptcha/api.js?render=') || pageLower.includes('recaptcha-v3') || pageLower.includes('grecaptcha.execute')) {
            analysis.captcha_type = 'recaptcha_v3';
          } else {
            analysis.captcha_type = 'recaptcha_v2';
          }
        } else if (pageLower.includes('hcaptcha') || pageLower.includes('h-captcha')) {
          analysis.captcha_type = 'hcaptcha';
        } else if (pageLower.includes('turnstile') || pageLower.includes('cf-turnstile')) {
          analysis.captcha_type = 'cloudflare';
        } else if (pageLower.includes('funcaptcha') || pageLower.includes('arkoselabs')) {
          analysis.captcha_type = 'funcaptcha';
        } else {
          analysis.captcha_type = 'unknown';
        }
        break;
      }
    }

    // Detect payment requirement
    let paymentIndicators = 0;
    for (const pattern of PAYMENT_PATTERNS) {
      if (textLower.includes(pattern)) {
        paymentIndicators++;
      }
    }
    analysis.requires_payment = paymentIndicators >= 2;

    // Try to extract pricing if payment detected
    if (analysis.requires_payment) {
      const priceMatch = pageText.match(/\$(\d+(?:\.\d{2})?)/);
      if (priceMatch) {
        analysis.cost_amount = parseFloat(priceMatch[1]);
      }
    }

    // Detect backlink type by checking meta tags and link attributes
    const hasNofollow = pageLower.includes('rel="nofollow"') ||
                        pageLower.includes("rel='nofollow'") ||
                        pageLower.includes('nofollow');
    const hasDofollow = pageLower.includes('dofollow') ||
                        (pageLower.includes('follow') && !hasNofollow);

    if (hasDofollow && !hasNofollow) {
      analysis.backlink_type = 'dofollow';
    } else if (hasNofollow) {
      analysis.backlink_type = 'nofollow';
    }

    // Detect submission method
    if (pageLower.includes('mailto:')) {
      analysis.submission_method = 'email';
    } else if (pageLower.includes('api') && (pageLower.includes('endpoint') || pageLower.includes('integration'))) {
      analysis.submission_method = 'api';
    }

    // Extract niche tags from page content
    const detectedNiches = new Set();
    for (const [niche, patterns] of Object.entries(NICHE_PATTERNS)) {
      for (const pattern of patterns) {
        if (textLower.includes(pattern)) {
          detectedNiches.add(niche);
          break;
        }
      }
    }
    analysis.niche_tags = Array.from(detectedNiches).slice(0, 5); // Limit to 5 tags

  } catch (error) {
    console.error('Error analyzing page:', error.message);
  }

  return analysis;
}

/**
 * Check if a URL is accessible and analyze the page
 */
async function checkAndAnalyzeUrl(browser, url, directoryName) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log(`  Checking: ${url}`);

    // Navigate to URL with timeout
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Check response status
    const status = response?.status() || 0;

    if (status >= 400 || status === 0) {
      console.log(`  Status ${status} - marking as dead`);
      await context.close();
      return { alive: false, status };
    }

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Check for common error indicators
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const errorIndicators = [
      '404', 'not found', 'page not found', 'does not exist',
      'no longer available', 'has been removed', 'domain for sale',
      'website expired', 'account suspended', 'this site can\'t be reached',
      'coming soon', 'under construction', 'maintenance mode',
    ];

    const hasError = errorIndicators.some(indicator =>
      pageText.toLowerCase().includes(indicator)
    );

    // More stringent check - only flag as dead if multiple indicators or title matches
    const pageTitle = await page.title();
    const titleHasError = errorIndicators.some(indicator =>
      pageTitle.toLowerCase().includes(indicator)
    );

    if ((hasError && titleHasError) || (hasError && status >= 400)) {
      console.log(`  Soft 404 detected - marking as dead`);
      await context.close();
      return { alive: false, status: 404, reason: 'soft_404' };
    }

    // Analyze the page for form data
    const analysis = await analyzePage(page);

    await context.close();

    return {
      alive: true,
      status,
      analysis
    };

  } catch (error) {
    console.log(`  Error: ${error.message}`);
    await context.close();

    // Classify error type
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return { alive: false, status: 0, reason: 'dns_error' };
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      return { alive: false, status: 0, reason: 'connection_refused' };
    } else if (error.message.includes('Timeout')) {
      return { alive: false, status: 0, reason: 'timeout' };
    } else if (error.message.includes('net::ERR_CONNECTION_RESET')) {
      return { alive: false, status: 0, reason: 'connection_reset' };
    } else if (error.message.includes('net::ERR_SSL')) {
      return { alive: false, status: 0, reason: 'ssl_error' };
    }

    return { alive: false, status: 0, reason: error.message };
  }
}

/**
 * Main enrichment function
 */
async function enrichRemainingDirectories() {
  console.log('========================================');
  console.log('Directory Enrichment Script - REMAINING');
  console.log('========================================\n');

  // Fetch directories where last_verified_at IS NULL (not yet processed)
  // The first 100 were already processed, so we skip those by checking for NULL last_verified_at
  console.log('Fetching directories where last_verified_at IS NULL...');

  const { data: directories, error } = await supabase
    .from('directories')
    .select('*')
    .is('last_verified_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching directories:', error);
    return;
  }

  stats.total = directories.length;
  console.log(`Found ${stats.total} unverified directories to process\n`);

  if (stats.total === 0) {
    console.log('No directories to process. All directories have been verified.');
    return stats;
  }

  // Launch browser
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
  });

  // Process each directory
  for (let i = 0; i < directories.length; i++) {
    const directory = directories[i];
    const progress = `[${i + 1}/${directories.length}]`;

    console.log(`\n${progress} Processing: ${directory.name}`);

    // Skip if no submission URL
    if (!directory.submission_url) {
      console.log('  No submission_url - skipping');
      stats.skipped++;
      continue;
    }

    try {
      // Check and analyze URL
      const result = await checkAndAnalyzeUrl(browser, directory.submission_url, directory.name);

      if (!result.alive) {
        // Delete dead directory
        console.log(`  Deleting dead directory: ${directory.name} (reason: ${result.reason || 'status ' + result.status})`);

        const { error: deleteError } = await supabase
          .from('directories')
          .delete()
          .eq('id', directory.id);

        if (deleteError) {
          console.error(`  Error deleting: ${deleteError.message}`);
          stats.errors.push({ directory: directory.name, error: deleteError.message });
        } else {
          stats.deleted++;
        }
      } else {
        // Update with enriched data
        console.log(`  Enriching: ${directory.name}`);

        const now = new Date().toISOString();
        const updateData = {
          updated_at: now,
          last_verified_at: now,
          status: 'active',
          // Store enrichment data in appropriate columns
          required_fields: result.analysis.required_fields,
          optional_fields: result.analysis.optional_fields,
          submission_method: result.analysis.submission_method,
          captcha_type: result.analysis.captcha_type,
          requires_payment: result.analysis.requires_payment,
          cost_amount: result.analysis.cost_amount,
          backlink_type: result.analysis.backlink_type,
          niche_tags: result.analysis.niche_tags,
        };

        console.log(`    - Required fields: ${result.analysis.required_fields.join(', ') || 'none detected'}`);
        console.log(`    - Optional fields: ${result.analysis.optional_fields.join(', ') || 'none detected'}`);
        console.log(`    - Submission method: ${result.analysis.submission_method}`);
        console.log(`    - Captcha: ${result.analysis.captcha_type || 'none'}`);
        console.log(`    - Payment required: ${result.analysis.requires_payment}${result.analysis.requires_payment ? ' ($' + result.analysis.cost_amount + ')' : ''}`);
        console.log(`    - Backlink type: ${result.analysis.backlink_type}`);
        console.log(`    - Niche tags: ${result.analysis.niche_tags.join(', ') || 'none detected'}`);

        const { error: updateError } = await supabase
          .from('directories')
          .update(updateData)
          .eq('id', directory.id);

        if (updateError) {
          console.error(`  Error updating: ${updateError.message}`);
          stats.errors.push({ directory: directory.name, error: updateError.message });
        } else {
          stats.enriched++;
        }
      }

    } catch (error) {
      console.error(`  Unexpected error: ${error.message}`);
      stats.errors.push({ directory: directory.name, error: error.message });
    }

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Close browser
  await browser.close();

  // Print summary
  console.log('\n========================================');
  console.log('ENRICHMENT COMPLETE');
  console.log('========================================');
  console.log(`Total directories processed: ${stats.total}`);
  console.log(`Deleted (dead URLs): ${stats.deleted}`);
  console.log(`Enriched (live URLs): ${stats.enriched}`);
  console.log(`Skipped (no URL): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors encountered:');
    stats.errors.forEach(e => console.log(`  - ${e.directory}: ${e.error}`));
  }

  return stats;
}

// Run the script
enrichRemainingDirectories()
  .then(stats => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
