# Stripe Integration Tests

Comprehensive test suite for verifying all Stripe functionality including webhooks, payments, and security.

## 📋 Test Suites

### 1. Stripe Integration Tests (`stripe-integration.test.js`)
**Purpose**: Core Stripe API functionality and webhook endpoints

**Tests (25 total)**:
- ✅ Stripe client initialization and API connection
- ✅ Price validation for all 4 tiers (Starter, Growth, Professional, Enterprise)
- ✅ Checkout session creation for all plans
- ✅ Webhook endpoint availability (6 endpoints)
- ✅ Webhook signature verification (valid and invalid)
- ✅ Webhook event handling (5 event types)
- ✅ Customer creation
- ✅ Payment intent creation

### 2. Stripe Webhook Security Tests (`stripe-webhook-security.test.js`)
**Purpose**: Security measures, authentication, and signature verification

**Tests**:
- 🔐 Signature validation (missing, invalid, wrong secret, expired)
- 🔒 Authentication middleware (public endpoint access)
- ⏱️ Rate limiting and performance
- 🔄 Idempotency (duplicate event handling)

### 3. Stripe End-to-End Tests (`stripe-end-to-end.test.js`)
**Purpose**: Complete payment flows and customer management

**Tests**:
- 🛒 Complete checkout flow (all 4 tiers)
- 💳 Payment intent lifecycle (create, retrieve, update, cancel)
- 👤 Customer management (create, retrieve, update, list, delete)
- 💰 Price and product validation
- 📨 Webhook event types (11 event types)
- ⚠️ Error handling (invalid IDs, API errors)

## 🚀 Running Tests

### Prerequisites
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure `.env.local` is configured with:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_STARTER_PRICE_ID=price_...
   STRIPE_GROWTH_PRICE_ID=price_...
   STRIPE_PROFESSIONAL_PRICE_ID=price_...
   STRIPE_ENTERPRISE_PRICE_ID=price_...
   ```

### Run Individual Test Suites

```bash
# Core integration tests
node tests/stripe-integration.test.js

# Security tests
node tests/stripe-webhook-security.test.js

# End-to-end tests
node tests/stripe-end-to-end.test.js
```

### Run All Tests

```bash
# Run comprehensive test suite
node tests/run-all-stripe-tests.js

# Or use npm script
npm run test:stripe
```

## 📊 Test Coverage

### API Operations
- ✅ Checkout session creation
- ✅ Payment intent management
- ✅ Customer CRUD operations
- ✅ Price and product retrieval
- ✅ Event listing

### Webhook Endpoints
- ✅ `/api/webhooks/stripe`
- ✅ `/api/webhooks/stripe-secure`
- ✅ `/api/webhooks/stripe-subscription`
- ✅ `/api/webhooks/stripe-one-time-payments`
- ✅ `/api/stripe/webhook`
- ✅ `/api/payments/webhook`

### Security Features
- ✅ Signature verification (Stripe webhook signatures)
- ✅ Replay attack prevention (timestamp validation)
- ✅ Authentication middleware (public endpoint access)
- ✅ Invalid signature rejection
- ✅ Missing signature handling
- ✅ Expired timestamp rejection

### Event Types Tested
- ✅ `checkout.session.completed`
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `customer.created`
- ✅ `customer.updated`
- ✅ `customer.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

## 🔧 Troubleshooting

### Tests Failing with 401 Errors
**Issue**: Webhook endpoints returning 401 Unauthorized

**Solution**: Ensure webhook endpoints are in the public endpoints list in `lib/middleware/auth-middleware.ts`

### Tests Timing Out
**Issue**: Webhook tests timing out after 8 seconds

**Solution**: Ensure `bodyParser: false` is configured in webhook API routes:
```javascript
export const config = {
  api: {
    bodyParser: false,
  },
}
```

### Signature Verification Failing
**Issue**: Valid signatures being rejected

**Solution**: 
1. Verify `STRIPE_WEBHOOK_SECRET` is correctly set in `.env.local`
2. Ensure webhook secret starts with `whsec_`
3. Check that raw body is being used for verification (not parsed JSON)

### Server Not Running
**Issue**: Tests fail with connection errors

**Solution**: Start the dev server first:
```bash
npm run dev
```

## 📈 Expected Results

### Success Criteria
- ✅ 100% pass rate on all test suites
- ✅ All webhook endpoints return appropriate error codes (400/500) for invalid requests
- ✅ All webhook endpoints accept valid Stripe signatures
- ✅ All pricing tiers configured correctly
- ✅ All event types handled properly

### Performance Benchmarks
- ⏱️ Webhook response time: < 5 seconds
- ⏱️ API operations: < 2 seconds
- ⏱️ Concurrent requests: All succeed

## 🎯 CI/CD Integration

### GitHub Actions Example
```yaml
name: Stripe Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dev &
      - run: sleep 10
      - run: npm run test:stripe
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
```

## 📝 Adding New Tests

### Test Structure
```javascript
async function testNewFeature() {
  console.log('\n🧪 Testing New Feature...\n')

  try {
    // Arrange
    const testData = { ... }

    // Act
    const result = await performAction(testData)

    // Assert
    const isValid = result.status === 'expected'
    logTest('Feature Name', isValid, {
      actual: result.status,
      expected: 'expected'
    })
  } catch (error) {
    logTest('Feature Name', false, error.message)
  }
}
```

### Adding to Test Runner
Edit `run-all-stripe-tests.js` and add to the `tests` array:
```javascript
{
  name: 'New Test Suite',
  file: 'new-test.test.js',
  description: 'Description of what this tests'
}
```

## 🐛 Reporting Issues

If tests fail unexpectedly:

1. Check the detailed error output
2. Verify environment variables are set correctly
3. Ensure dev server is running
4. Check Stripe dashboard for API errors
5. Review webhook logs in Stripe dashboard

## 📚 Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## ✅ Maintenance

Run these tests:
- ✅ Before every deployment
- ✅ After modifying Stripe integration code
- ✅ After updating Stripe API version
- ✅ After changing webhook endpoints
- ✅ Weekly as part of regression testing

