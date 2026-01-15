# Integration Guide

This guide explains how to integrate the redesign v2 components into your existing DirectoryBolt codebase.

## Step 1: Update Tailwind Configuration

1. Open your main `tailwind.config.js`
2. Replace or merge with content from `redesign-v2/tailwind.config.v2.js`
3. Ensure the `content` array includes the redesign-v2 folder:
   ```js
   content: [
     // ... existing paths
     "./redesign-v2/**/*.{js,ts,jsx,tsx,mdx}",
   ],
   ```

## Step 2: Update Global Styles

1. Open your main `styles/globals.css`
2. Add the artifact styles from `redesign-v2/styles/globals.v2.css`
3. Merge the reduced motion support and focus states

## Step 3: Wire Fonts

1. Open your `app/layout.tsx` (App Router) or `pages/_app.tsx` (Pages Router)
2. Follow the example in `redesign-v2/layout-font-wiring.example.tsx`
3. Import and configure Inter, JetBrains Mono, and Source Serif 4 (or Fraunces)
4. Apply the CSS variables to the `html` element

## Step 4: Copy Components

You have two options:

### Option A: Use from redesign-v2 folder (Recommended for testing)
- Import directly from `redesign-v2/components/`
- Example: `import { Button } from '../redesign-v2/components/ui/Button'`

### Option B: Copy to main components folder (Recommended for production)
- Copy components to your main `components/` folder
- Update import paths accordingly

## Step 5: Update Homepage

1. Open `components/NewLandingPage.tsx`
2. Replace sections gradually using the example in `redesign-v2/components/HomepageExample.tsx`
3. Start with the Hero section, then work through each section

## Step 6: Remove Emojis

Search and replace all emojis:
- Remove ⚡ from logo
- Remove 🚀, 🔍, 💡, etc. from CTAs and sections
- Replace with clean text or SVG icons

## Step 7: Update Header

1. Open `components/Header.tsx`
2. Remove emoji from logo
3. Update nav links to use neutral text with volt-600 hover
4. Update CTA button to use new Button component

## Step 8: Test & Verify

1. Run your dev server
2. Check each section renders correctly
3. Verify Volt usage <10% of viewport
4. Verify all headings are neutral (not volt)
5. Test accessibility (keyboard nav, focus states)
6. Test responsive breakpoints

## Key Reminders

- **Never use Volt for headings** - All H1-H6 must use `text-role-text-primary`
- **Use role tokens** - Always use `bg-role-bg-primary`, `text-role-text-primary`, etc.
- **Volt restraint** - Volt only for CTAs, focus rings, active states, 1-2 hero metrics per section
- **Accessibility** - All text/background pairs must pass WCAG AA (4.5:1 minimum)

## Troubleshooting

### Tailwind classes not working?
- Ensure `redesign-v2` folder is in Tailwind's `content` array
- Restart your dev server after updating `tailwind.config.js`

### Fonts not loading?
- Check that font variables are applied to `html` element
- Verify `next/font/google` imports are correct
- Check browser console for font loading errors

### Components not rendering?
- Check import paths are correct
- Verify TypeScript types if using TypeScript
- Check for missing dependencies

## Next Steps

See `IMPLEMENTATION_CHECKLIST.md` in the root directory for the complete task list with checkboxes.
