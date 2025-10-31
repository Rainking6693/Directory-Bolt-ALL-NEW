import dynamic from 'next/dynamic'
import { LoadingSpinner } from '../ui/LoadingStates'

const EnhancedAnalysisResults = dynamic(() => import('./EnhancedAnalysisResults'), {
  ssr: false,
  loading: () => (
    <div className="py-16">
      <div className="flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  )
})

export default EnhancedAnalysisResults
