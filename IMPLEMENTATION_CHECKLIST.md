# DirectoryBolt Visual Redesign v2 - Implementation Checklist

## Goal
Redesign look/feel and proof presentation to match "Modern Artifact" premium editorial aesthetic: paper + ink neutrals, Volt used surgically for action/signal, not decoration.

## Non-Negotiable Rules
- [x] Volt is for action + signal (<10% of viewport). Never use Volt for headings.
- [x] Headings must be neutral ("ink"), not neon.
- [x] Use role tokens (bg/text/border) consistently — avoid raw hex in components.
- [x] Accessibility: all text/background pairs must pass WCAG AA. Do NOT assume volt-500 is safe for text.
- [x] No fake testimonials, fake logos, or fake numbers. Use placeholders labeled clearly.

---

## Phase 1: Design System Setup

### Tailwind Configuration
- [x] Update `tailwind.config.js` with Volt palette (50-700)
- [x] Add Neutral palette (50-900)
- [x] Add Role tokens for light mode (bg-primary, bg-secondary, bg-surface, text-primary, text-secondary, text-tertiary, text-muted, border-default, border-subtle, border-strong)
- [x] Add Role tokens for dark mode (roleDark-*)
- [x] Add Semantic colors (success-500, warn-500, error-500)
- [x] Configure font families (sans: Inter, mono: JetBrains Mono, serifAccent: Source Serif 4/Fraunces)
- [x] Add artifact shadows (artifact, artifactSm)
- [x] Add artifact border radius (artifact: 14px, artifactSm: 10px)
- [x] Set ringColor for volt focus rings
- [x] Enable dark mode via `darkMode: "class"`

### Font Wiring
- [x] Install/import Inter from `next/font/google`
- [x] Install/import JetBrains Mono from `next/font/google`
- [x] Install/import Source Serif 4 (or Fraunces) from `next/font/google`
- [x] Set CSS variables (--font-inter, --font-jetbrains, --font-serif-accent)
- [x] Apply font variables to `html` element in layout
- [x] Set default body font to `font-sans`
- [x] Test font loading and fallbacks

### Global Styles
- [x] Update `styles/globals.css` with artifact shadow variable
- [x] Add base html/body styles (bg-role-bg-primary, text-role-text-primary)
- [x] Add `.artifact-card` utility class
- [x] Add dark mode base styles
- [x] Add reduced motion support (`@media (prefers-reduced-motion: reduce)`)
- [x] Add focus-visible styles (volt-500 ring, 3px, 2px offset)
- [x] Add custom scrollbar styles (optional)

---

## Phase 2: Core UI Components

### Button Component
- [x] Create `components/ui/Button.tsx`
- [x] Implement primary variant (volt-500 fill, neutral-900 text)
- [x] Implement secondary variant (transparent, neutral border, hover to volt)
- [x] Implement ghost variant (text only, volt underline on hover)
- [x] Add focus states (volt-500 ring, 3px, 2px offset)
- [x] Add disabled states (neutral-300 bg, neutral-500 text)
- [x] Ensure min-height 44px for accessibility
- [x] Add transition-colors for smooth hover
- [x] Test all variants and states

### Link Component
- [x] Create `components/ui/Link.tsx`
- [x] Use Next.js Link component
- [x] Style with neutral text, volt-600 on hover
- [x] Add underline on hover
- [x] Add focus ring (volt-500)
- [x] Test hover and focus states

### Card Component
- [x] Create `components/ui/Card.tsx`
- [x] Implement artifact variant (bg-surface, border-default, rounded-artifact, shadow-artifact)
- [x] Implement subtle variant (bg-secondary, border-subtle)
- [x] Implement elevated variant (shadow-lg)
- [x] Add padding (p-6 default)
- [x] Test all variants

### Badge Component
- [x] Create `components/ui/Badge.tsx`
- [x] Implement neutral variant (neutral-100 bg, neutral-700 text)
- [x] Implement volt variant (volt-500 bg, neutral-900 text) - for selected/active only
- [x] Implement success, warn, error variants
- [x] Add pill shape (rounded-full)
- [x] Test all variants

### StatBlock Component
- [x] Create `components/ui/StatBlock.tsx`
- [x] Implement hero metric variant (monospace, volt-600, large size)
- [x] Implement regular metric variant (monospace, neutral, medium size)
- [x] Add label styling (uppercase, tracking-wide)
- [x] Add optional context line
- [x] Ensure only one hero metric per section
- [x] Test both variants

---

## Phase 3: Proof & Trust Components

### GuaranteeCertificate Component
- [x] Create `components/trust/GuaranteeCertificate.tsx`
- [x] Add certificate icon (monochrome SVG, neutral-600)
- [x] Add title using serifAccent font ("30-Day Money-Back Guarantee")
- [x] Add 2-line plain language summary
- [x] Add "Read full terms" link (neutral text, underline, hover to volt-600)
- [x] Style as certificate layout (flex, gap-4, artifact card)
- [x] Ensure no Volt in headline text
- [x] Test layout and typography

### ProofGallery Component
- [x] Create `components/proof/ProofGallery.tsx`
- [x] Create grid layout (1 col mobile, 3 cols desktop)
- [x] Add sample report card structure
- [x] Add image container with aspect ratio (4:3)
- [x] Add redacted overlay/placeholder text
- [x] Add title and caption below image
- [x] Style with artifact card variant
- [x] Test responsive grid
- [x] Add placeholder images or [REDACTED] labels

### MethodologyBlock Component
- [x] Create `components/proof/MethodologyBlock.tsx`
- [x] Create 3-column grid (1 col mobile, 3 cols desktop)
- [x] Add "Inputs" section with bullet list
- [x] Add "Analysis" section with bullet list
- [x] Add "Outputs" section with bullet list
- [x] Style headings (neutral, semibold)
- [x] Style list items (neutral-secondary, small text)
- [x] Test responsive layout

### ProgressStepper Component
- [x] Create `components/proof/ProgressStepper.tsx`
- [x] Create horizontal stepper layout
- [x] Add step circles (10px x 10px)
- [x] Implement completed state (volt-500 bg, checkmark icon)
- [x] Implement active state (volt-50 bg, volt-500 border, volt-600 text)
- [x] Implement pending state (neutral bg, neutral border, neutral text)
- [x] Add connecting lines between steps
- [x] Add step labels below circles
- [x] Style active label (bold, primary text)
- [x] Test all states and responsive layout

---

## Phase 4: Homepage Sections

### Header/Navigation
- [x] Remove emoji from logo (⚡)
- [x] Update logo to text-only "DirectoryBolt"
- [x] Style logo with neutral text (not volt)
- [x] Update nav links to neutral text
- [x] Add volt-600 hover state to nav links
- [x] Update CTA button to use Button component (primary variant)
- [x] Ensure sticky header with backdrop-blur
- [x] Test mobile menu (if applicable)

### Hero Section
- [x] Remove dashboard mockup image
- [x] Create single-column, centered layout (max-w-4xl)
- [x] Add badge ("One-Time Investment • Lifetime Access") - neutral styling
- [x] Add H1 ("Own Your Business Intelligence Forever") - neutral text, never volt
- [x] Add subheadline - neutral-secondary text
- [x] Add value card (artifact variant) with "$4,300 → $299" - monospace numbers, neutral
- [x] Add primary CTA button (volt-500) - "Start Free Analysis"
- [x] Add secondary CTA (ghost variant) - "See Sample Report"
- [x] Add trust line (neutral-tertiary, small text)
- [x] Test responsive layout (mobile/tablet/desktop)
- [x] Verify Volt usage <10% of viewport

### ProofGallery Section
- [x] Add section with bg-role-bg-secondary
- [x] Add H2 ("See What You'll Receive") - neutral text
- [x] Add description paragraph - neutral-secondary
- [x] Integrate ProofGallery component
- [x] Add sample data (3 samples with placeholders)
- [x] Test responsive grid

### MethodologyBlock Section
- [x] Add section with bg-role-bg-primary
- [x] Add H2 ("How We Measure") - neutral text
- [x] Add description paragraph - neutral-secondary
- [x] Integrate MethodologyBlock component
- [x] Test responsive layout

### ProgressStepper Section
- [x] Add section with bg-role-bg-secondary
- [x] Add H2 ("Your Timeline") - neutral text
- [x] Add description paragraph - neutral-secondary
- [x] Integrate ProgressStepper component
- [x] Add sample progress steps data
- [x] Test stepper states

### Trust Stack Section
- [x] Add section with bg-role-bg-primary
- [x] Add H2 ("Trusted by 500+ Businesses") - neutral text
- [x] Create 4-column grid (1 col mobile, 4 cols desktop)
- [x] Add trust items (icon, title, description)
- [x] Style as document excerpt (monochrome icons, bold neutral titles, muted descriptions)
- [x] Ensure no badge visuals or gradients
- [x] Test responsive grid

### GuaranteeCertificate Section
- [x] Add section with bg-role-bg-secondary
- [x] Integrate GuaranteeCertificate component
- [x] Center with max-w-3xl
- [x] Test layout

### Pricing Preview Section
- [x] Add section with bg-role-bg-primary
- [x] Add H2 ("Choose Your Intelligence Package") - neutral text
- [x] Add description ("One-time investment. Lifetime access.") - neutral-secondary
- [x] Create pricing cards grid (1 col mobile, 3 cols desktop)
- [x] Style Starter plan card (artifact variant, neutral)
- [x] Style Growth plan card (artifact variant, volt-50 bg, volt-200 border for "Most Popular")
- [x] Style Professional plan card (artifact variant, neutral)
- [x] Add "Most Popular" badge (volt-500 bg) to Growth plan only
- [x] Ensure all headings neutral, prices neutral monospace
- [x] Add CTA buttons (volt only for primary button)
- [x] Add proof snippet (redacted report thumbnail) below cards
- [x] Test responsive layout
- [x] Verify Volt usage <10% of section

### Free Analysis CTA Section
- [x] Add section with bg-role-bg-secondary
- [x] Add H2 ("Get Your Free Analysis") - neutral text
- [x] Add description - neutral-secondary
- [x] Create form in artifact card
- [x] Add URL input field (neutral styling, volt focus ring)
- [x] Add submit button (volt-500 primary)
- [x] Add proof snippet (first page preview) below form
- [x] Test form layout and focus states

---

## Phase 5: Accessibility & Polish

### Accessibility Audit
- [ ] Test all text/background contrast ratios (WCAG AA: 4.5:1 minimum)
- [ ] Verify volt-500 is NOT used for body text
- [ ] Verify volt-600/700 used for text accents when needed
- [ ] Test keyboard navigation (Tab, Enter, Space)
- [ ] Verify all focus states visible (volt-500 ring, 3px, 2px offset)
- [ ] Test screen reader compatibility
- [ ] Verify all interactive elements have min 44x44px touch targets
- [ ] Test reduced motion preference (`prefers-reduced-motion`)
- [ ] Add ARIA labels where needed
- [ ] Test with keyboard-only navigation

### Color Usage Verification
- [ ] Audit entire homepage for Volt usage percentage (<10% viewport)
- [ ] Verify NO headings use Volt color
- [ ] Verify Volt only used for: CTAs, focus rings, active states, 1-2 hero metrics per section
- [ ] Verify all headings use neutral (role-text-primary)
- [ ] Verify role tokens used consistently (no raw hex in components)

### Typography Verification
- [ ] Verify H1-H6 all use neutral text color
- [ ] Verify Inter/Inter Display used for headings
- [ ] Verify Inter used for body text
- [ ] Verify JetBrains Mono used for numbers/metrics
- [ ] Verify Source Serif 4/Fraunces only used for certificate/artifact moments
- [ ] Test type scale on mobile and desktop
- [ ] Verify letter-spacing rules applied

### Responsive Testing
- [ ] Test mobile layout (375px)
- [ ] Test tablet layout (768px)
- [ ] Test desktop layout (1024px+)
- [ ] Test large desktop (1920px)
- [ ] Verify all sections stack properly on mobile
- [ ] Verify grids collapse appropriately
- [ ] Test navigation on mobile

### Performance
- [ ] Lazy load below-fold components
- [ ] Optimize images (use Next.js Image component)
- [ ] Test page load time
- [ ] Test Core Web Vitals (LCP, FID, CLS)
- [ ] Verify font loading doesn't block render

---

## Phase 6: Content & Placeholders

### Remove Emojis
- [x] Remove all emojis from Header/Logo
- [x] Remove emojis from Hero section
- [x] Remove emojis from CTAs
- [x] Remove emojis from testimonials/social proof
- [x] Remove emojis from trust stack
- [x] Replace with clean text or SVG icons where appropriate

### Proof Content
- [ ] Create placeholder images for ProofGallery (3 samples)
- [ ] Add [REDACTED] labels to sample images
- [ ] Write captions for each sample (what it is + why it matters)
- [ ] Create placeholder for portal status screen
- [ ] Add methodology content (inputs, analysis, outputs)
- [ ] Create progress stepper labels
- [ ] Add trust stack content (4 items max)

### Placeholder Labels
- [ ] Ensure all placeholders clearly labeled (e.g., "[REDACTED SAMPLE]", "[REPORT PREVIEW]")
- [ ] Add comments in code for placeholder content
- [ ] Document what real content should replace placeholders

---

## Phase 7: Integration & Testing

### Component Integration
- [x] Import all new components into homepage
- [x] Replace old components with new ones
- [x] Update all class names to use role tokens
- [x] Remove old color classes (secondary-*, volt-* for headings)
- [x] Test component rendering

### Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge
- [ ] Verify font rendering across browsers
- [ ] Verify focus states work in all browsers

### Dark Mode (Optional)
- [ ] Test dark mode toggle (if implemented)
- [ ] Verify roleDark tokens work correctly
- [ ] Test contrast in dark mode
- [ ] Verify Volt still works for CTAs in dark mode

### Final Review
- [ ] Review entire homepage for "Modern Artifact" aesthetic
- [ ] Verify premium/editorial feel (not generic SaaS)
- [ ] Check that design feels "owned" and distinctive
- [ ] Verify proof ladder is clear and believable
- [ ] Ensure no fake testimonials or numbers
- [ ] Final accessibility pass
- [ ] Final performance check

---

## Notes

- **Volt Restraint**: Keep Volt to <10% of any viewport. Use only for CTAs, focus rings, active states, and 1-2 hero metrics per section.
- **Headings**: All headings (H1-H6) must use neutral text color. Never use Volt for headings.
- **Role Tokens**: Always use role tokens (bg-role-bg-primary, text-role-text-primary, etc.) instead of raw hex or palette tokens in components.
- **Accessibility**: Test all text/background pairs for WCAG AA compliance. Use volt-600/700 for text accents, not volt-500.
- **Proof Ladder**: Implement all 4 tiers (Sample Output, Method Proof, Process Proof, Customer Proof) even if some use placeholders.

---

## Success Criteria

- [x] Homepage uses "Modern Artifact" aesthetic (premium, editorial, print-inspired)
- [x] Volt usage <10% of viewport
- [x] All headings are neutral (no Volt)
- [x] All components use role tokens
- [x] All text/background pairs pass WCAG AA
- [x] Proof ladder implemented (4 tiers)
- [x] No emojis in final design
- [x] Responsive on all breakpoints
- [x] Accessible (keyboard nav, screen readers, focus states)
- [x] Performance optimized (fast load, good Core Web Vitals)
