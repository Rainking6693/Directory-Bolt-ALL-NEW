/**
 * Directory Enrichment Script
 *
 * This script fetches the first 100 directories from Supabase,
 * visits each submission_url to verify it works, and enriches the data.
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
          analysis.captcha_type = 'recaptcha';
        } else if (pageLower.includes('hcaptcha') || pageLower.includes('h-captcha')) {
          analysis.captcha_type = 'hcaptcha';
        } else if (pageLower.includes('turnstile') || pageLower.includes('cf-turnstile')) {
          analysis.captcha_type = 'cloudflare_turnstile';
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
                        pageLower.includes('follow');

    if (hasDofollow && !hasNofollow) {
      analysis.backlink_type = 'dofollow';
    } else if (hasNofollow) {
      analysis.backlink_type = 'nofollow';
    }

    // Detect submission method
    if (pageLower.includes('mailto:')) {
      analysis.submission_method = 'email';
    } else if (pageLower.includes('api') && pageLower.includes('endpoint')) {
      analysis.submission_method = 'api';
    }

    // Extract potential niche tags from page
    const categoryKeywords = ['tech', 'business', 'startup', 'saas', 'software',
      'marketing', 'seo', 'local', 'restaurant', 'healthcare', 'finance',
      'education', 'ecommerce', 'blog', 'news', 'directory', 'general'];

    for (const keyword of categoryKeywords) {
      if (textLower.includes(keyword)) {
        analysis.niche_tags.push(keyword);
      }
    }
    analysis.niche_tags = analysis.niche_tags.slice(0, 5); // Limit to 5 tags

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
    ];

    const hasError = errorIndicators.some(indicator =>
      pageText.toLowerCase().includes(indicator)
    );

    if (hasError && status < 400) {
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
    }

    return { alive: false, status: 0, reason: error.message };
  }
}

/**
 * Main enrichment function
 */
async function enrichDirectories() {
  console.log('========================================');
  console.log('Directory Enrichment Script');
  console.log('========================================\n');

  // Fetch first 100 directories ordered by created_at
  console.log('Fetching first 100 directories from Supabase...');

  const { data: directories, error } = await supabase
    .from('directories')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error fetching directories:', error);
    return;
  }

  stats.total = directories.length;
  console.log(`Found ${stats.total} directories to process\n`);

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
        console.log(`  Deleting dead directory: ${directory.name}`);

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

        const updateData = {
          updated_at: new Date().toISOString(),
          has_captcha: result.analysis.captcha_type !== null,
          // Store additional fields in the features JSON column
          features: {
            ...directory.features,
            required_fields: result.analysis.required_fields,
            optional_fields: result.analysis.optional_fields,
            submission_method: result.analysis.submission_method,
            captcha_type: result.analysis.captcha_type,
            requires_payment: result.analysis.requires_payment,
            cost_amount: result.analysis.cost_amount,
            backlink_type: result.analysis.backlink_type,
            niche_tags: result.analysis.niche_tags,
            last_verified_at: new Date().toISOString(),
            has_form: result.analysis.has_form,
          },
          active: true,
        };

        console.log(`    - Required fields: ${result.analysis.required_fields.join(', ') || 'none detected'}`);
        console.log(`    - Optional fields: ${result.analysis.optional_fields.join(', ') || 'none detected'}`);
        console.log(`    - Captcha: ${result.analysis.captcha_type || 'none'}`);
        console.log(`    - Payment required: ${result.analysis.requires_payment}`);
        console.log(`    - Backlink type: ${result.analysis.backlink_type}`);

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
enrichDirectories()
  .then(stats => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
