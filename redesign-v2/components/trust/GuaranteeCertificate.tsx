import React from 'react';
import { Link } from '../ui/Link';

export function GuaranteeCertificate() {
  return (
    <div className="flex gap-4 p-6 border border-role-border-default rounded-artifact bg-role-bg-secondary">
      <div className="flex-shrink-0">
        {/* Certificate icon - monochrome SVG */}
        <svg 
          className="w-12 h-12 text-role-text-secondary" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" 
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-serifAccent text-xl font-semibold text-role-text-primary mb-2">
          30-Day Money-Back Guarantee
        </h3>
        <p className="text-role-text-secondary text-sm mb-2">
          If you're not satisfied with your business intelligence report, we'll refund your purchase within 30 days.
        </p>
        <Link 
          href="/terms" 
          className="text-role-text-tertiary text-sm underline hover:text-volt-600"
        >
          Read full terms
        </Link>
      </div>
    </div>
  );
}
