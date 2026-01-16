import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

export function Input({ className = '', error, ...props }: InputProps) {
    const baseClasses = "w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors";

    const stateClasses = error
        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
        : "border-role-border-default focus:border-volt-500 focus:ring-volt-500/20";

    return (
        <input
            className={`${baseClasses} ${stateClasses} ${className}`}
            {...props}
        />
    );
}
