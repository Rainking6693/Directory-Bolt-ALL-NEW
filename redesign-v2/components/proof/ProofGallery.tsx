import React from 'react';
import { Card } from '../ui/Card';

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
