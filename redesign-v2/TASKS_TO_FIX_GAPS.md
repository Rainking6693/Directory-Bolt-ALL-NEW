# TASK LIST: Fixing Feature Gaps & Scaling DirectoryBolt

This document contains concrete, actionable tasks to resolve the gaps identified in the [FEATURE_GAP_ANALYSIS.md](file:///C:/Users/Ben/Desktop/Github/Directory-Bolt-ALL-NEW/FEATURE_GAP_ANALYSIS.md).

## 🚀 Phase 1: Real AI Intelligence (Analysis & Competitors)

- [ ] **Scraping Infrastructure**
    - [ ] Implement robust URL scraper (using `cheerio` or `playwright`) to extract business data (name, address, services, team, etc.).
    - [ ] Add support for detecting social media profiles and existing directory listings during scraping.
- [ ] **AI-Powered Business Profiling**
    - [ ] Replace mock data in `/api/analyze` with real calls to Anthropic (Claude 3.5 Sonnet) or Gemini.
    - [ ] Prompt AI to generate categorized business profiles, unique selling points, and target audience segments.
- [ ] **Competitive Intelligence System**
    - [ ] Implement logic to find top 3-5 competitors using search APIs or GPT-based market research.
    - [ ] Benchmark client website against competitors in terms of directory density and SEO authority.
- [ ] **SEO Metric Integration**
    - [ ] Replace `Math.random()` SEO scores with real data from a light-weight SEO audit (checking H1s, meta tags, load speed, etc.).

## 🛠️ Phase 2: Submission Pipeline (Trigger.dev Migration)

- [ ] **Trigger.dev Setup**
    - [ ] Initialize Trigger.dev v3/v4 in the project.
    - [ ] Configure `trigger.config.ts` using the provided API keys.
- [ ] **Porting Motia Logic**
    - [ ] Migrate `BrainService` (field mapping) from Motia to a Trigger.dev task.
    - [ ] Migrate `JobProcessor` event handler to a Trigger.dev task with retry logic.
- [ ] **Playwright Automation**
    - [ ] Implement the first set of "Core" directory automations (Google My Business, Yelp, Bing).
    - [ ] Implement a generic "Form Submitter" task that uses AI-generated field mappings to fill any standard directory form.
- [ ] **Directory Database Scaling**
    - [ ] Expand the `generatePaidDirectories` list from 8 to 100+ high-authority sources.
    - [ ] Categorize directories by niche (Local, SaaS, Finance, etc.).

## 📊 Phase 3: Reporting & White-Labeling

- [ ] **Growth Strategy Engine**
    - [ ] Generate dynamic "Growth Roadmaps" based on identified gaps.
    - [ ] Include revenue projection estimates (AI-estimated) based on visibility increase.
- [ ] **Export & Reporting**
    - [ ] Implement PDF report generation for the Analysis results.
    - [ ] Implement CSV export for the directory submission status list.
- [ ] **White-Labeling (Agency Features)**
    - [ ] Add branding options (Logo, Primary Color) to the Professional/Enterprise user dashboard.
    - [ ] Ensure all generated reports use the agency's branding.

## ✅ Verification & QA
- [ ] **Functional Audit**
    - [ ] Run end-to-end analysis of a real URL and verify AI profiling accuracy.
    - [ ] Trigger a mock submission job and verify it processes correctly in Trigger.dev.
- [ ] **Visual Audit**
    - [ ] Ensure no emojis remain in the new report layouts.
    - [ ] Verify "Modern Artifact" aesthetic consistency in generated PDFs.
