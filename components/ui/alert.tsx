import React from 'react'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive'
  children: React.ReactNode
}

export function Alert({ children, className = '', variant = 'default', ...props }: AlertProps) {
  const baseClasses = 'relative w-full rounded-lg border p-4'
  const variantClasses = {
    default: 'bg-background text-foreground',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
  }

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`} 
      {...props}
    >
      {children}
    </div>
  )
}

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export function AlertDescription({ children, className = '', ...props }: AlertDescriptionProps) {
  return (
    <div className={`text-sm [&_p]:leading-relaxed ${className}`} {...props}>
      {children}
    </div>
  )
}