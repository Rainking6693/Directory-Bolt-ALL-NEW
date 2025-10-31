// Ambient module declarations for JS/third-party modules without types

declare module '@/lib/analytics/enhanced-ga4' {
  export function trackEvent(event: string, params?: Record<string, any>): void;
  const ga: { trackEvent: typeof trackEvent };
  export default ga;
}

declare module '@/lib/utils/critical-css' {
  export function extractCritical(html: string): { css: string; ids: string[] };
  const css: { extractCritical: typeof extractCritical };
  export default css;
}

declare module '@/lib/wasm/directory-analyzer' {
  export function analyzeDirectory(data: Uint8Array): Promise<any>; // TODO: refine typing
  const analyzer: { analyzeDirectory: typeof analyzeDirectory };
  export default analyzer;
}