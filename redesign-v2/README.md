# DirectoryBolt Visual Redesign v2

This folder contains the implementation of the "Modern Artifact" premium editorial redesign.

## Structure

```
redesign-v2/
├── components/
│   ├── ui/              # Core UI components (Button, Link, Card, Badge, StatBlock)
│   ├── proof/           # Proof components (ProofGallery, MethodologyBlock, ProgressStepper)
│   └── trust/           # Trust components (GuaranteeCertificate)
├── styles/
│   └── globals.v2.css   # Updated global styles with artifact aesthetic
├── tailwind.config.v2.js # Updated Tailwind config with v2 tokens
└── README.md            # This file
```

## Implementation Status

### Phase 1: Design System Setup ✅
- [x] Tailwind config with Volt/Neutral/Role tokens
- [x] Global styles with artifact shadows and reduced motion
- [ ] Font wiring (needs to be added to main layout file)

### Phase 2: Core UI Components ✅
- [x] Button component (primary, secondary, ghost)
- [x] Link component
- [x] Card component (artifact, subtle, elevated)
- [x] Badge component
- [x] StatBlock component

### Phase 3: Proof & Trust Components ✅
- [x] GuaranteeCertificate component
- [x] ProofGallery component
- [x] MethodologyBlock component
- [x] ProgressStepper component

### Phase 4: Homepage Sections
- [ ] Header/Navigation updates
- [ ] Hero section redesign
- [ ] ProofGallery section
- [ ] MethodologyBlock section
- [ ] ProgressStepper section
- [ ] Trust Stack section
- [ ] GuaranteeCertificate section
- [ ] Pricing Preview section
- [ ] Free Analysis CTA section

## Usage

### To integrate these components:

1. **Update Tailwind Config**: Copy `tailwind.config.v2.js` content to your main `tailwind.config.js`

2. **Update Global Styles**: Merge `styles/globals.v2.css` into your main `styles/globals.css`

3. **Add Font Wiring**: Update your `app/layout.tsx` or `pages/_app.tsx`:
```tsx
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const serifAccent = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-accent" });
```

4. **Import Components**: Import from `redesign-v2/components/` or copy to your main `components/` folder

## Key Rules

- **Volt Restraint**: Volt used <10% of viewport, only for CTAs, focus rings, active states, 1-2 hero metrics
- **Headings**: All headings (H1-H6) use neutral text, never Volt
- **Role Tokens**: Always use `bg-role-bg-primary`, `text-role-text-primary`, etc. instead of raw hex
- **Accessibility**: All text/background pairs must pass WCAG AA (4.5:1 minimum)

## Next Steps

See `IMPLEMENTATION_CHECKLIST.md` in the root directory for the complete task list.
