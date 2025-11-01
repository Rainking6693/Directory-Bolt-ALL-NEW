# Stripe 401 Error Fix Guide

## ✅ Fixes Applied

All Stripe initialization points have been updated to use the validated `getStripeClient()` function instead of direct `new Stripe()` calls.

### Files Fixed:

1. **`pages/api/stripe/create-checkout-session.ts`**
   - ✅ Now uses `getStripeClient()` with proper error handling
   - ✅ Removed non-null assertions
   - ✅ Added validation

2. **`pages/api/webhooks/stripe-secure.ts`**
   - ✅ Now uses `getStripeClient()` 
   - ✅ Removed non-null assertions
   - ✅ Added proper error handling

3. **`pages/api/webhooks/stripe.js`**
   - ✅ Now uses `getStripeClient()` function
   - ✅ All `stripe.` calls now use validated client
   - ✅ Fixed initialization points

### Root Causes of 401 Errors:

1. **Direct Stripe initialization** - Using `new Stripe(process.env.STRIPE_SECRET_KEY!)` without validation
2. **Non-null assertions** - The `!` operator doesn't actually validate the key exists
3. **No format validation** - Keys weren't checked to start with `sk_`
4. **Environment variable loading** - Netlify might not load env vars properly without validation

## 🔧 Testing

### Run Audit:
```bash
npm run audit:stripe
```

This will:
- ✅ Check all environment variables
- ✅ Validate key formats
- ✅ Test API connections
- ✅ Identify code issues

### Run Connection Test:
```bash
npm run test:stripe
```

This will:
- ✅ Test Stripe API connectivity
- ✅ Verify authentication
- ✅ Test checkout session creation
- ✅ Identify 401 errors

## 📋 Environment Variables Checklist

### Required (Netlify):
- [ ] `STRIPE_SECRET_KEY` - Must start with `sk_`
- [ ] `STRIPE_PUBLISHABLE_KEY` - Must start with `pk_`
- [ ] `STRIPE_WEBHOOK_SECRET` - Must start with `whsec_`

### Optional:
- [ ] `STRIPE_STARTER_PRICE_ID`
- [ ] `STRIPE_GROWTH_PRICE_ID`
- [ ] `STRIPE_PROFESSIONAL_PRICE_ID`
- [ ] `STRIPE_ENTERPRISE_PRICE_ID`

## 🔍 Troubleshooting 401 Errors

### 1. Verify Environment Variables in Netlify:
- Go to Netlify Dashboard > Site Settings > Environment Variables
- Ensure `STRIPE_SECRET_KEY` is set
- Check for extra spaces or newlines
- Verify you're using test vs live keys correctly

### 2. Check Key Format:
- Secret key must start with `sk_test_` or `sk_live_`
- Publishable key must start with `pk_test_` or `pk_live_`
- Webhook secret must start with `whsec_`

### 3. Key Mode Mismatch:
- Secret and publishable keys must both be test OR both be live
- Can't mix test secret with live publishable

### 4. Key Revoked:
- Check Stripe Dashboard > Developers > API Keys
- Regenerate key if needed
- Update in Netlify immediately

### 5. Netlify Build Issues:
- Redeploy after adding environment variables
- Check build logs for env var loading
- Verify variables are available at runtime

## 🚀 Next Steps

1. Set environment variables in Netlify
2. Run `npm run audit:stripe` to verify
3. Run `npm run test:stripe` to test connection
4. Deploy and monitor for 401 errors
5. Check Netlify function logs for authentication errors

## 📝 Code Changes Summary

### Before:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
})
```

### After:
```typescript
import { getStripeClient } from '../../../lib/utils/stripe-client'

const getStripe = () => {
  try {
    return getStripeClient() // Validated with format checking
  } catch (error) {
    throw new Error(`Stripe initialization failed: ${error.message}`)
  }
}

const stripe = getStripe()
```

The `getStripeClient()` function in `lib/utils/stripe-client.ts`:
- ✅ Validates key exists
- ✅ Validates key format (`sk_` prefix)
- ✅ Provides better error messages
- ✅ Handles initialization errors gracefully

