import React from 'react';

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
