import React from 'react';

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
