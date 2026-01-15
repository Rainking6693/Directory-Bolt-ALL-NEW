import React from 'react';
import NextLink from 'next/link';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}

export function Link({ href, children, className = '', external = false, ...props }: LinkProps) {
  const linkClasses = "text-role-text-primary hover:text-volt-600 hover:underline focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors";
  
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClasses} ${className}`}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink
      href={href}
      className={`${linkClasses} ${className}`}
      {...props}
    >
      {children}
    </NextLink>
  );
}
