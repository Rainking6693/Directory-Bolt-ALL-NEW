# Customer Journey & Automation Flow

This document charts the complete user flow from initial signup/purchase through the automated directory submission process.

## 1. Initial Engagement (Free Tier)
**Goal:** Capture user interest and demonstrate value.
1. **User Land:** Customer arrives at `directorybolt.com`.
2. **Analysis:** Enters their website URL into the "Free Website Analysis" tool.
3. **Processing:** Deepmind/AI scans the site for basic content, industry, and SEO status.
4. **Result:** User sees a high-level "Directory Report" showing:
   - Current Visibility Score
   - Missed Directory Opportunities (blurred list)
   - SEO Health Check
5. **Upsell:** "Unlock Full Report & Auto-Submit" buttons prompt user to upgrade to paid tiers.

## 2. Purchase & Checkout
**Goal:** Secure payment and select service tier.
1. **Selection:** User chooses a plan (Starter, Growth, Professional, Enterprise) on `/pricing` or via Results page upsell.
2. **Checkout:** Redirected to `/checkout?plan=[tier]`.
3. **Payment:** One-time payment processed via **Stripe**.
4. **Validation:** Stripe webhook confirms payment success.

## 3. Onboarding (New!)
**Goal:** Collect mission-critical data for directory listings.
1. **Redirect:** Post-payment, user is auto-redirected to `/onboarding`.
2. **Data Collection:** User fills out the "Business Profile" form:
   - **Identity:** Business Name, Website, Category.
   - **Contact:** Phone, Email.
   - **Location:** Full Address (Street, City, State, ZIP) - *Crucial for local citations.*
   - **Content:** Business Description, Keywords.
3. **Submission:** User clicks "Start Submissions".

## 4. Backend Automation (Trigger.dev)
**Goal:** Execute parallel submissions without manual intervention.
1. **API Trigger:** `pages/api/onboarding.ts` receives form data.
2. **Directory Selection:** System fetches high-DA directories from Supabase, limited by plan quota (e.g., Top 250 for Growth plan).
3. **Batching:** Directories are split into 4 parallel batches.
4. **Execution:** `directorySubmissionTask` (Trigger.dev) is fired 4x simultaneously.
   - **Worker 1:** Handles Directories 1-62
   - **Worker 2:** Handles Directories 63-125
   - **Worker 3:** Handles Directories 126-187
   - **Worker 4:** Handles Directories 188-250
5. **AI Agent:** For each directory in the batch:
   - Navigates to submission URL.
   - Auto-fills form fields using onboarded data.
   - Solves Captchas (if configured).
   - Submits listing.
   - Captures screenshot/confirmation.

## 5. Result & Reporting
**Goal:** Prove value to the customer.
1. **Dashboard:** User is redirected to `/dashboard` after onboarding.
2. **Live Updates:** Dashboard shows "Submissions in Progress" via Supabase real-time updates (future implementation).
3. **Completion:** As tasks finish, "Success" status and screenshots appear in the dashboard.
4. **Email:** User receives a summary report: "250 Directories Submitted Successfully".
