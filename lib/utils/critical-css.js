// Critical CSS for above-the-fold content optimization
export function generateCriticalCSS() {
  return `
    /* Critical above-the-fold styles for DirectoryBolt */
    
    /* Reset and base styles */
    *,*::before,*::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}
    html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;tab-size:4;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"}
    body{margin:0;line-height:inherit}
    
    /* Color variables */
    :root {
      --secondary-900: #1a2236;
      --secondary-800: #27324a;
      --secondary-700: #3a4861;
      --secondary-600: #4f5f7b;
      --secondary-300: #d1d9e6;
      --volt-400: #ccff0a;
      --volt-500: #b3ff00;
      --volt-600: #89cc00;
    }
    
    /* Header styles */
    .header-nav {
      position: relative;
      z-index: 20;
      background: rgba(26, 34, 54, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(204, 255, 10, 0.2);
    }
    
    .header-container {
      max-width: 80rem;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 4rem;
    }
    
    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #ccff0a 0%, #b3ff00 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }
    
    /* Hero section critical styles */
    .hero-section {
      background: linear-gradient(135deg, #1a2236 0%, #27324a 50%, #000000 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    
    .hero-container {
      max-width: 96rem;
      margin: 0 auto;
      padding: 0 1rem;
      width: 100%;
    }
    
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 3rem;
      align-items: center;
    }
    
    @media (min-width: 1024px) {
      .hero-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    
    .hero-content {
      text-align: center;
    }
    
    @media (min-width: 1024px) {
      .hero-content {
        text-align: left;
      }
    }
    
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, rgba(204, 255, 10, 0.2) 0%, rgba(179, 255, 0, 0.1) 100%);
      border: 1px solid rgba(204, 255, 10, 0.3);
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 700;
      color: #d1d9e6;
      margin-bottom: 1.5rem;
      backdrop-filter: blur(12px);
    }
    
    .hero-title {
      font-size: clamp(2rem, 5vw, 4rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, #ccff0a 0%, #b3ff00 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }
    
    .hero-subtitle {
      font-size: clamp(1.125rem, 2.5vw, 1.5rem);
      margin-bottom: 2rem;
      color: #d1d9e6;
      line-height: 1.6;
    }
    
    .hero-highlight {
      color: #ccff0a;
      font-weight: 700;
    }
    
    /* Value proposition box */
    .value-box {
      background: rgba(39, 50, 74, 0.5);
      border: 1px solid rgba(204, 255, 10, 0.2);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
      backdrop-filter: blur(12px);
    }
    
    .value-title {
      color: #ccff0a;
      font-weight: 700;
      margin-bottom: 1rem;
      text-align: center;
    }
    
    .value-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    @media (min-width: 640px) {
      .value-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    
    .value-item {
      text-align: center;
      padding: 1rem;
      background: rgba(58, 72, 97, 0.5);
      border-radius: 0.5rem;
    }
    
    .value-price {
      color: #ccff0a;
      font-weight: 700;
      font-size: 1.125rem;
      margin-bottom: 0.5rem;
    }
    
    .value-description {
      color: #d1d9e6;
      font-size: 0.875rem;
    }
    
    .value-total {
      text-align: center;
      margin-top: 1rem;
      color: #22c55e;
      font-weight: 700;
      font-size: 1.25rem;
    }
    
    /* CTA buttons */
    .cta-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      justify-content: center;
      align-items: center;
    }
    
    @media (min-width: 640px) {
      .cta-container {
        flex-direction: row;
      }
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #ccff0a 0%, #b3ff00 100%);
      color: #1a2236;
      font-weight: 700;
      padding: 1rem 2rem;
      border-radius: 0.75rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
      transition: all 0.3s ease;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: none;
      cursor: pointer;
      min-height: 3.5rem;
      min-width: 12rem;
    }
    
    .btn-primary:hover {
      transform: scale(1.05);
      box-shadow: 0 25px 50px -12px rgba(204, 255, 10, 0.5);
    }
    
    .btn-secondary {
      border: 2px solid #ccff0a;
      color: #ccff0a;
      font-weight: 700;
      padding: 1rem 2rem;
      border-radius: 0.75rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
      transition: all 0.3s ease;
      background: transparent;
      cursor: pointer;
      min-height: 3.5rem;
      min-width: 12rem;
    }
    
    .btn-secondary:hover {
      background: #ccff0a;
      color: #1a2236;
      transform: scale(1.05);
    }
    
    /* Hero image */
    .hero-image {
      position: relative;
      width: 100%;
      height: auto;
      border-radius: 0.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    /* Loading states */
    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 2px solid #ccff0a;
      border-top: 2px solid transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Utility classes */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mt-4 { margin-top: 1rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    
    /* Responsive utilities */
    @media (min-width: 640px) {
      .sm\\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .sm\\:text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    }
    
    @media (min-width: 1024px) {
      .lg\\:px-8 { padding-left: 2rem; padding-right: 2rem; }
      .lg\\:text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
      .lg\\:text-5xl { font-size: 3rem; line-height: 1; }
    }
    
    /* Animation classes */
    .animate-glow {
      animation: glow 2s ease-in-out infinite alternate;
    }
    
    @keyframes glow {
      from { text-shadow: 0 0 20px rgba(204, 255, 10, 0.5); }
      to { text-shadow: 0 0 30px rgba(204, 255, 10, 0.8); }
    }
    
    .animate-slide-up {
      animation: slideUp 0.6s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-zoom-in {
      animation: zoomIn 0.4s ease-out;
    }
    
    @keyframes zoomIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    /* Background effects */
    .bg-gradient-primary {
      background: linear-gradient(135deg, #1a2236 0%, #27324a 50%, #000000 100%);
    }
    
    .bg-gradient-volt {
      background: linear-gradient(135deg, #ccff0a 0%, #b3ff00 100%);
    }
    
    /* Backdrop blur support */
    .backdrop-blur {
      backdrop-filter: blur(12px);
    }
    
    @supports not (backdrop-filter: blur(12px)) {
      .backdrop-blur {
        background: rgba(26, 34, 54, 0.9);
      }
    }
  `
}

// Function to inline critical CSS
export function inlineCriticalCSS() {
  if (typeof document === 'undefined') return
  
  const criticalCSS = generateCriticalCSS()
  const style = document.createElement('style')
  style.textContent = criticalCSS
  style.setAttribute('data-critical', 'true')
  document.head.appendChild(style)
}

// Function to load non-critical CSS asynchronously
export function loadNonCriticalCSS() {
  if (typeof document === 'undefined') return
  
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/_next/static/css/main.css'
  link.media = 'print'
  link.onload = function() {
    this.media = 'all'
  }
  document.head.appendChild(link)
}