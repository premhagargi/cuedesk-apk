import React from 'react'
import { Brain, ArrowUp } from 'lucide-react'

interface BrainButtonProps {
  visible: boolean
  hasTranscript: boolean
  isGenerating: boolean
  onClick: () => void
}

export const BrainButton: React.FC<BrainButtonProps> = ({
  visible,
  hasTranscript,
  isGenerating,
  onClick
}) => {
  if (!visible) return null

  return (
    <div className="fixed bottom-5 right-3 sm:right-6 z-50">
      <button
        onClick={onClick}
        className={`group relative flex items-center gap-2 px-3.5 py-3 rounded-2xl font-semibold shadow-xl transition-all duration-200 active:scale-95 cursor-pointer ${
          hasTranscript
            ? 'bg-amber-500 text-slate-950 font-bold shadow-amber-500/25 ring-2 ring-amber-400 animate-pulse'
            : isGenerating
            ? 'bg-slate-200 text-amber-800 border border-amber-300'
            : 'bg-white border border-slate-300 text-slate-800 hover:border-amber-500 hover:text-amber-700'
        }`}
        title="One-click Trigger / Re-answer current question"
      >
        <Brain className={`w-5 h-5 ${isGenerating ? 'animate-pulse text-amber-400' : hasTranscript ? 'animate-bounce' : ''}`} />
        <span className="text-xs uppercase tracking-wider font-bold">
          {isGenerating ? 'Regenerate' : 'Answer'}
        </span>
        {!isGenerating && (
          <ArrowUp className="w-3.5 h-3.5 stroke-[3] -ml-0.5" />
        )}
      </button>
    </div>
  )
}
