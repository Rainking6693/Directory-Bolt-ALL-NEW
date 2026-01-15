import React from 'react';

interface Step {
  id: string;
  label: string;
  completed?: boolean;
  active?: boolean;
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
              step.completed 
                ? 'bg-volt-500 border-volt-500 text-role-text-primary' 
                : step.active
                ? 'bg-volt-50 border-volt-500 text-volt-600'
                : 'bg-role-bg-surface border-role-border-default text-role-text-tertiary'
            }`}>
              {step.completed ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </div>
            <span className={`text-xs mt-2 text-center max-w-[80px] ${
              step.active ? 'text-role-text-primary font-medium' : 'text-role-text-tertiary'
            }`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 transition-colors ${
              step.completed ? 'bg-volt-500' : 'bg-role-border-default'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
