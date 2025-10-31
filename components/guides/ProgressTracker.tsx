interface ProgressTrackerProps {
  progress: number
}

export function ProgressTracker({ progress }: ProgressTrackerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div 
        className="h-1 bg-gradient-to-r from-volt-400 to-volt-600 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}