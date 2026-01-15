2) Color System — v2 (Clean + Implementable)
Core Principle

DirectoryBolt should feel like a premium printed artifact: mostly “paper + ink” neutrals, with Volt used surgically for action and signal, not decoration. Keep Volt on <10% of any viewport. (This keeps the original intent while removing the internal inconsistency where Volt was both forbidden and required for headings.) 

DirectoryBolt Visual Redesign P…

 

DirectoryBolt Visual Redesign P…

Palette Tokens (Light Mode)

Volt (Accent / Action)

volt-50 #faffeb (tints only, backgrounds, subtle fills)

volt-100 #f5ffcc

volt-200 #eaff99

volt-300 #daff66

volt-400 #c4ff1a (hover fill / highlight)

volt-500 #a8e600 (primary CTA fill, active UI states)

volt-600 #7fb300 (text accent when you must use accent text)

volt-700 #5c8000 (small-text accent fallback if contrast demands it)

Neutrals (Editorial Gray)

neutral-50 #fafafa

neutral-100 #f5f5f5

neutral-200 #e5e5e5

neutral-300 #d4d4d4

neutral-400 #a3a3a3

neutral-500 #737373

neutral-600 #525252

neutral-700 #404040

neutral-800 #262626

neutral-900 #171717

Surfaces

bg-primary #ffffff (paper)

bg-secondary #fafafa (section breaks)

bg-surface #ffffff (cards)

shadow-color rgba(0,0,0,0.08) (keep light and “print-like”)

Borders

border-default #e5e5e5

border-subtle #f5f5f5

border-strong #d4d4d4

Text

text-primary #171717

text-secondary #525252

text-tertiary #737373

text-muted #a3a3a3

Semantic

success-500 #22c55e

warn-500 #f59e0b

error-500 #ef4444

Dark Mode Tokens (Simple + Consistent)

bg-primary-dark #0a0a0a

bg-secondary-dark #171717

bg-surface-dark #262626

text-primary-dark #fafafa

text-secondary-dark #d4d4d4

border-default-dark #404040

Usage Rules (This is the “no confusion” part)

Use Volt for:

Primary CTA fills (buttons)

Focus rings / active states (links, inputs, toggles)

Progress + status emphasis (selected step, “in progress” highlight)

Key metrics (max 1–2 per section)

Do NOT use Volt for:

Headings (headings stay neutral for premium/editorial feel)

Body text blocks / paragraphs

Decorative borders / section dividers

Large background washes (except volt-50 as a tiny tint)

Text Accent Rule (fixes the earlier contradiction)

text-accent = links, metric callouts, micro-emphasis only

Default: volt-600 for text accents

If contrast fails: push to volt-700 or use neutral text + volt underline/icon.

Accessibility Rules (don’t hard-claim contrast; enforce it)

The original spec quoted a specific contrast value for volt-500 on white 

DirectoryBolt Visual Redesign P…

 — instead, implement this safer rule:

All text/background pairs must pass WCAG AA (4.5:1 for normal text, 3:1 for large).

Never use volt-500 for normal body text on white by default.

Use volt-500 for fills and focus rings; for text, prefer volt-600/volt-700 or neutral + volt underline.

Optional Variant Palettes (keep from v1, with clearer intent)

Corporate Blue (white-label / enterprise skin): keep neutrals, swap accent to #0066cc (primary) + #003d7a (deep).

Editorial Monochrome (print/PDF mode): neutrals only; accent becomes neutral-700 (no volt).

3) Typography System — v2 (Artifact-first, still dev-friendly)

Your original Inter + JetBrains Mono base is solid 

DirectoryBolt Visual Redesign P…

. v2 keeps that, but adds a controlled “artifact” accent so the brand feels owned (not just “nice SaaS”).

Font Stack

Primary (UI + body)

Headings: Inter Display (preferred) or Inter

Body: Inter

Data/metrics: JetBrains Mono (or SF Mono fallback)

Artifact Accent (sparingly used)

Accent Serif: Source Serif 4 or Fraunces
Use for certificate/seal moments, pull quotes, “report chapter titles,” and guarantee headings (not for general UI).

Fallback

system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

Type Scale (keep yours; tighten usage rules)

Use your existing scale (it’s good) 

DirectoryBolt Visual Redesign P…

, but add these constraints:

Heading Color Rule

H1–H6 default to text-primary (neutral).

Never set headings in Volt. (This aligns with the “no volt headings” rule above and fixes the earlier conflict.) 

DirectoryBolt Visual Redesign P…

Data Styling Rule

Numbers can be monospace and Volt-highlighted only when they’re the hero metric (e.g., one per card/section).

If multiple numbers appear together (tables, lists), keep them neutral + monospace, and use Volt for the selected row/active state instead.

Letter-spacing Rules (keep; add one “artifact” mode)

You already have heading spacing rules 

DirectoryBolt Visual Redesign P…

. Add:

Artifact Mode (serif accent headings): letter-spacing 0em (serifs hate tracking), slightly increased line-height (1.15–1.25).

“Brand Voice” Headline Styling — v2 (cleaner + less gimmick)

Your examples are good 

DirectoryBolt Visual Redesign P…

. The main change: remove Volt from headline text; reserve Volt for CTA + underline + metric.

Editorial Statement (Hero)

“Own your business intelligence.”

“Keep it forever.”

Style: H1 neutral, tight tracking, strong weight; Volt used only on CTA.

Artifact Chapter Title (Report feel)

“Directory Intelligence Brief”

Style: serif accent, smallcaps or title case, subtle border rule beneath.

Data Proof Line (Metric)

“$4,300 value → $299 one-time”

Style: numbers in monospace; optionally highlight only the arrow/marker or one number in Volt (not both).

8) Trust, Authority, and Proof Design — v2 (Real, non-scammy proof ladder)

Your current trust section is directionally right 

DirectoryBolt Visual Redesign P…

; v2 makes it operational: what to show when you don’t have tons of logos/case studies yet, and how to present proof like a serious product.

Proof Hierarchy (a “proof ladder” you can ship immediately)

Primary Proof: Sample Output

Show 2–3 real report spreads (redacted) and 1 portal status screen (blur sensitive info).

Add a caption: what the user is looking at + why it matters.

Method Proof: What You Measure

A compact “Methodology” block: inputs → analysis → outputs.

Avoid vague claims; be specific about deliverables (even if the internals are proprietary).

Process Proof: Timeline + Status

“Results in 48 hours” is more believable when paired with a progress UI and “what happens next” steps. 

DirectoryBolt Visual Redesign P…

Customer Proof: Case Studies (when available)

Use “before / after / saved / permanence angle” like your earlier structure suggests. 

DirectoryBolt Visual Redesign P…

No headshots unless real. No anonymous “John S.” unless legally necessary and clearly stated.

Guarantee Presentation (certificate, not a badge)

Keep your certificate/seal idea 

DirectoryBolt Visual Redesign P…

, but enforce this layout:

Guarantee Module

Left: certificate icon (subtle, monochrome)

Right:

Title: “30-Day Money-Back Guarantee”

2-line terms summary (plain language)

Link: “Read full terms” (neutral + underline; no Volt headline)

Ratings / Reviews (only if legit)

Your guidance is good 

DirectoryBolt Visual Redesign P…

. Add the rule:

Only display star ratings if you can cite the platform + count (e.g., “4.8/5 (112 reviews) — G2”). Otherwise, don’t.

“Trust Stack” Placement + Content (keep, but make it feel like a document)

You already specify placement and items 

DirectoryBolt Visual Redesign P…

. v2 styling rules:

No badge visuals. No glossy gradients.

Present it like a 4-item excerpt from a report:

Small icon (monochrome)

Bold line (neutral)

One clarifying line (muted)

Evidence-in-Context (the anti-scam move)

Instead of a generic “Results” strip, embed proof inside relevant sections:

Pricing → add a “What you receive” mini proof snippet (thumbnail of report page)

Free Analysis → show a “preview of the first page” (redacted)

Directory Network section → show an example “submission status card” and what statuses mean

Compliance / Terms Links (present, not intrusive)

Keep your locations 

DirectoryBolt Visual Redesign P…

, plus one rule:

Any time you mention guarantee, include a subtle “terms apply” link within the same module (tiny but visible).

1) Tailwind tokens (drop-in)
Step-by-step (what this does)

Adds Volt + Neutral palettes and semantic colors to Tailwind.

Creates explicit “bg/text/border” tokens so devs don’t freestyle.

Supports dark mode via dark: classes (Tailwind darkMode: "class").

Adds font stacks for Inter, JetBrains Mono, and a Serif Accent.

tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Volt (accent/action) ---
        volt: {
          50:  "#faffeb",
          100: "#f5ffcc",
          200: "#eaff99",
          300: "#daff66",
          400: "#c4ff1a",
          500: "#a8e600",
          600: "#7fb300", // preferred for accent text when needed
          700: "#5c8000", // fallback for small text contrast
        },

        // --- Neutrals (editorial gray) ---
        neutral: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },

        // --- Semantic ---
        success: { 500: "#22c55e" },
        warn:    { 500: "#f59e0b" },
        error:   { 500: "#ef4444" },

        // --- “Role tokens” (use these in UI, not raw hex) ---
        // Light mode roles
        role: {
          "bg-primary":   "#ffffff",
          "bg-secondary": "#fafafa",
          "bg-surface":   "#ffffff",

          "text-primary":   "#171717",
          "text-secondary": "#525252",
          "text-tertiary":  "#737373",
          "text-muted":     "#a3a3a3",

          "border-default": "#e5e5e5",
          "border-subtle":  "#f5f5f5",
          "border-strong":  "#d4d4d4",
        },

        // Dark mode roles (use via dark: prefix)
        roleDark: {
          "bg-primary":   "#0a0a0a",
          "bg-secondary": "#171717",
          "bg-surface":   "#262626",

          "text-primary":   "#fafafa",
          "text-secondary": "#d4d4d4",

          "border-default": "#404040",
        },
      },

      fontFamily: {
        // Use next/font to load these; see snippet below
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        serifAccent: ["var(--font-serif-accent)", "ui-serif", "Georgia", "serif"],
      },

      boxShadow: {
        // “Print-like” soft shadow
        artifact: "0 10px 30px rgba(0,0,0,0.08)",
        artifactSm: "0 6px 18px rgba(0,0,0,0.08)",
      },

      borderRadius: {
        // Slightly structured, not bubbly
        artifact: "14px",
        artifactSm: "10px",
      },

      ringColor: {
        // Focus ring uses Volt
        volt: "#a8e600",
      },
    },
  },
  plugins: [],
};

app/globals.css (optional but recommended)

This gives you consistent defaults (and keeps “Volt is action, not decoration” enforceable with utility conventions).

:root {
  --artifact-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

html, body {
  background: #ffffff;
  color: #171717;
}

/* Optional: a reusable “artifact card” feel */
.artifact-card {
  border-radius: 14px;
  box-shadow: var(--artifact-shadow);
  border: 1px solid #e5e5e5;
  background: #ffffff;
}

/* Dark mode base if you want global flips (Tailwind handles via dark: too) */
.dark html, .dark body {
  background: #0a0a0a;
  color: #fafafa;
}

Next.js font wiring (App Router example)
// app/layout.tsx
import "./globals.css";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const serifAccent = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-accent" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${serifAccent.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}