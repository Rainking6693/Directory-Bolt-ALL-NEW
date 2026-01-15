import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', disabled, ...props }: ButtonProps) {
  const baseClasses = "font-semibold px-6 py-3 rounded-md focus:outline-none focus:ring-3 focus:ring-volt-500 focus:ring-offset-2 transition-colors min-h-[44px] disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: disabled
      ? "bg-neutral-300 text-neutral-500"
      : "bg-volt-500 text-role-text-primary hover:bg-volt-400",
    secondary: disabled
      ? "bg-transparent border-2 border-neutral-300 text-neutral-500"
      : "bg-transparent border-2 border-role-border-default text-role-text-primary hover:border-volt-500 hover:text-volt-600",
    ghost: disabled
      ? "bg-transparent text-neutral-400"
      : "bg-transparent text-role-text-secondary hover:text-volt-600 hover:underline px-4 py-2",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
