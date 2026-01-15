# Component Code Examples

## Button Component

```tsx
// components/ui/Button.tsx

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseClasses = "font-semibold px-6 py-3 rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors min-h-[44px]";
  
  const variantClasses = {
    primary: "bg-volt-500 text-role-text-primary hover:bg-volt-400",
    secondary: "bg-transparent border-2 border-role-border-default text-role-text-primary hover:border-volt-500 hover:text-volt-600",
    ghost: "bg-transparent text-role-text-secondary hover:text-volt-600 hover:underline px-4 py-2",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

**Usage:**
```tsx
<Button variant="primary">Start Free Analysis</Button>
<Button variant="secondary">See Sample Report</Button>
<Button variant="ghost">Learn More</Button>
```

## Link Component

```tsx
// components/ui/Link.tsx

import NextLink from 'next/link';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function Link({ href, children, className = '', ...props }: LinkProps) {
  return (
    <NextLink
      href={href}
      className={`text-role-text-primary hover:text-volt-600 hover:underline focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors ${className}`}
      {...props}
    >
      {children}
    </NextLink>
  );
}
```

**Usage:**
```tsx
<Link href="/pricing">View Pricing</Link>
```

## Card Component (Artifact Variant)

```tsx
// components/ui/Card.tsx

interface CardProps {
  children: React.ReactNode;
  variant?: 'artifact' | 'subtle' | 'elevated';
  className?: string;
}

export function Card({ children, variant = 'artifact', className = '' }: CardProps) {
  const variantClasses = {
    artifact: "bg-role-bg-surface border border-role-border-default rounded-artifact shadow-artifact",
    subtle: "bg-role-bg-secondary border border-role-border-subtle rounded-lg",
    elevated: "bg-role-bg-surface border border-role-border-default rounded-lg shadow-lg",
  };

  return (
    <div className={`p-6 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
```

**Usage:**
```tsx
<Card variant="artifact">
  <h3 className="text-role-text-primary font-semibold mb-2">Card Title</h3>
  <p className="text-role-text-secondary">Card content</p>
</Card>
```

## Badge Component

```tsx
// components/ui/Badge.tsx

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'volt' | 'success' | 'warn' | 'error';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const variantClasses = {
    neutral: "bg-neutral-100 text-neutral-700",
    volt: "bg-volt-500 text-role-text-primary",
    success: "bg-success-50 text-success-700",
    warn: "bg-warn-50 text-warn-700",
    error: "bg-error-50 text-error-700",
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
```

**Usage:**
```tsx
<Badge variant="volt">Most Popular</Badge>
<Badge variant="neutral">New</Badge>
```

## StatBlock Component

```tsx
// components/ui/StatBlock.tsx

interface StatBlockProps {
  value: string | number;
  label: string;
  context?: string;
  isHero?: boolean; // Only one hero metric per section
}

export function StatBlock({ value, label, context, isHero = false }: StatBlockProps) {
  return (
    <div className="text-center">
      <div className={`font-mono ${isHero ? 'text-4xl font-bold text-volt-600' : 'text-2xl font-semibold text-role-text-primary'}`}>
        {value}
      </div>
      <div className="text-role-text-secondary text-sm uppercase tracking-wide mt-1">
        {label}
      </div>
      {context && (
        <div className="text-role-text-tertiary text-xs mt-1">
          {context}
        </div>
      )}
    </div>
  );
}
```

**Usage:**
```tsx
{/* Hero metric - only one per section */}
<StatBlock value="$4,300" label="Value" isHero />

{/* Regular metrics - neutral */}
<StatBlock value="500+" label="Directories" />
<StatBlock value="85%" label="Approval Rate" context="Average" />
```

## GuaranteeCertificate Component

```tsx
// components/trust/GuaranteeCertificate.tsx

export function GuaranteeCertificate() {
  return (
    <div className="flex gap-4 p-6 border border-role-border-default rounded-artifact bg-role-bg-secondary">
      <div className="flex-shrink-0">
        {/* Certificate icon - use Heroicons or custom SVG */}
        <svg className="w-12 h-12 text-role-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-serifAccent text-xl font-semibold text-role-text-primary mb-2">
          30-Day Money-Back Guarantee
        </h3>
        <p className="text-role-text-secondary text-sm mb-2">
          If you're not satisfied with your business intelligence report, we'll refund your purchase within 30 days.
        </p>
        <a 
          href="/terms" 
          className="text-role-text-tertiary text-sm underline hover:text-volt-600 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2"
        >
          Read full terms
        </a>
      </div>
    </div>
  );
}
```

## ProofGallery Component

```tsx
// components/proof/ProofGallery.tsx

interface Sample {
  id: string;
  title: string;
  caption: string;
  image: string; // Placeholder/redacted image
}

interface ProofGalleryProps {
  samples: Sample[];
}

export function ProofGallery({ samples }: ProofGalleryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {samples.map((sample) => (
        <div key={sample.id} className="bg-role-bg-surface border border-role-border-default rounded-artifact shadow-artifact overflow-hidden">
          <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden">
            {/* Redacted report preview image */}
            <img 
              src={sample.image} 
              alt={sample.caption} 
              className="w-full h-full object-cover opacity-60" 
            />
            <div className="absolute inset-0 flex items-center justify-center bg-role-bg-primary/50">
              <span className="text-role-text-muted text-xs font-mono">[REDACTED SAMPLE]</span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-role-text-primary text-sm font-semibold mb-1">{sample.title}</p>
            <p className="text-role-text-tertiary text-xs">{sample.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Usage:**
```tsx
const samples = [
  {
    id: '1',
    title: 'Market Analysis Report',
    caption: 'Comprehensive competitor intelligence and market positioning',
    image: '/samples/report-1-placeholder.jpg',
  },
  {
    id: '2',
    title: 'Directory Opportunities',
    caption: '500+ high-authority directory recommendations with approval probabilities',
    image: '/samples/report-2-placeholder.jpg',
  },
  {
    id: '3',
    title: 'Portal Dashboard',
    caption: 'Real-time submission tracking and status updates',
    image: '/samples/portal-placeholder.jpg',
  },
];

<ProofGallery samples={samples} />
```

## MethodologyBlock Component

```tsx
// components/proof/MethodologyBlock.tsx

export function MethodologyBlock() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <h4 className="text-role-text-primary font-semibold mb-3">Inputs</h4>
        <ul className="text-role-text-secondary text-sm space-y-2">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Website URL and business information</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Industry category and target market</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Current directory presence (if any)</span>
          </li>
        </ul>
      </div>
      <div>
        <h4 className="text-role-text-primary font-semibold mb-3">Analysis</h4>
        <ul className="text-role-text-secondary text-sm space-y-2">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>AI-powered market research and competitor intelligence</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Directory opportunity mapping across 500+ platforms</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>SEO score and visibility analysis</span>
          </li>
        </ul>
      </div>
      <div>
        <h4 className="text-role-text-primary font-semibold mb-3">Outputs</h4>
        <ul className="text-role-text-secondary text-sm space-y-2">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Comprehensive intelligence report (PDF)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Directory submission plan with priorities</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Growth strategy recommendations</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

## ProgressStepper Component

```tsx
// components/proof/ProgressStepper.tsx

interface Step {
  id: string;
  label: string;
  completed?: boolean;
  active?: boolean;
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
              step.completed 
                ? 'bg-volt-500 border-volt-500 text-role-text-primary' 
                : step.active
                ? 'bg-volt-50 border-volt-500 text-volt-600'
                : 'bg-role-bg-surface border-role-border-default text-role-text-tertiary'
            }`}>
              {step.completed ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </div>
            <span className={`text-xs mt-2 text-center ${
              step.active ? 'text-role-text-primary font-medium' : 'text-role-text-tertiary'
            }`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 transition-colors ${
              step.completed ? 'bg-volt-500' : 'bg-role-border-default'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Usage:**
```tsx
const steps = [
  { id: '1', label: 'Submit', completed: true },
  { id: '2', label: 'Analyze', completed: true },
  { id: '3', label: 'Build Brief', active: true },
  { id: '4', label: 'Execute' },
  { id: '5', label: 'Delivered' },
];

<ProgressStepper steps={steps} />
```
