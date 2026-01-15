# Final Integration Steps

## Quick Integration Guide

To complete the redesign integration, follow these steps:

### Step 1: Backup Current Files
```bash
# Create backups of current components
cp components/Header.tsx components/Header.old.tsx
cp components/NewLandingPage.tsx components/NewLandingPage.old.tsx
cp components/layout/Footer.tsx components/layout/Footer.old.tsx
cp pages/analyze.tsx pages/analyze.old.tsx
cp pages/pricing.tsx pages/pricing.old.tsx
```

### Step 2: Replace with v2 Versions
```bash
# Replace with new versions
cp components/Header.v2.tsx components/Header.tsx
cp components/NewLandingPage.v2.tsx components/NewLandingPage.tsx
cp components/layout/Footer.v2.tsx components/layout/Footer.tsx
cp components/sections/PricingPreviewSection.v2.tsx components/sections/PricingPreviewSection.tsx
cp components/sections/TestimonialsSection.v2.tsx components/sections/TestimonialsSection.tsx
cp pages/analyze.v2.tsx pages/analyze.tsx
cp pages/pricing.v2.tsx pages/pricing.tsx
```

### Step 3: Update Component Imports

Update any components that import the old sections to use the new ones. The new components are in `redesign-v2/components/` and can be imported like:

```tsx
import { Button } from '../redesign-v2/components/ui/Button'
import { Card } from '../redesign-v2/components/ui/Card'
// etc.
```

Or copy them to the main `components/` folder for easier imports.

### Step 4: Test Everything

1. Start dev server: `npm run dev`
2. Test homepage: http://localhost:3000
3. Test analyze page: http://localhost:3000/analyze
4. Test pricing page: http://localhost:3000/pricing
5. Verify:
   - No emojis appear
   - Headings are neutral (not volt)
   - Volt only on CTAs and focus rings
   - All components render correctly
   - Responsive on mobile/tablet/desktop

### Step 5: Fix Any Remaining Issues

- Update any remaining old color classes (secondary-*, volt-* for headings)
- Ensure all components use role tokens
- Test accessibility (keyboard navigation, focus states)
- Verify contrast ratios

## Component Import Reference

### UI Components
```tsx
import { Button } from '../redesign-v2/components/ui/Button'
import { Link } from '../redesign-v2/components/ui/Link'
import { Card } from '../redesign-v2/components/ui/Card'
import { Badge } from '../redesign-v2/components/ui/Badge'
import { StatBlock } from '../redesign-v2/components/ui/StatBlock'
```

### Proof Components
```tsx
import { ProofGallery } from '../redesign-v2/components/proof/ProofGallery'
import { MethodologyBlock } from '../redesign-v2/components/proof/MethodologyBlock'
import { ProgressStepper } from '../redesign-v2/components/proof/ProgressStepper'
```

### Trust Components
```tsx
import { GuaranteeCertificate } from '../redesign-v2/components/trust/GuaranteeCertificate'
```

## Key Design Rules Reminder

1. **Volt Restraint**: <10% of viewport, only for CTAs, focus rings, active states, 1-2 hero metrics
2. **Headings**: Always neutral (`text-role-text-primary`), NEVER Volt
3. **Role Tokens**: Always use `bg-role-bg-primary`, `text-role-text-primary`, etc.
4. **No Emojis**: Remove all emojis from UI
5. **Accessibility**: All text/background pairs must pass WCAG AA (4.5:1 minimum)

## Troubleshooting

### Components not rendering?
- Check import paths are correct
- Verify Tailwind config includes `redesign-v2` in content paths
- Restart dev server after config changes

### Styles not applying?
- Check Tailwind classes are correct
- Verify role tokens are defined in tailwind.config.js
- Check browser console for CSS errors

### Fonts not loading?
- Verify fonts are imported in `_app.tsx`
- Check CSS variables are set on `html` element
- Verify font files are loading (check Network tab)
