import React from 'react';

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
