import React, { useRef, useLayoutEffect, useState } from 'react'
import { Mic, MicOff, X, Sparkles, Zap, AlertCircle } from 'lucide-react'
import { PipelineStatus } from '../types'

interface AudioIndicatorProps {
  isActive: boolean
  isMuted?: boolean
  pipelineStatus: PipelineStatus
  interimTranscript: string
  bufferedTranscript: string
  onClearBuffer: () => void
}

export const AudioIndicator: React.FC<AudioIndicatorProps> = ({
  isActive,
  isMuted = false,
  pipelineStatus,
  interimTranscript,
  bufferedTranscript,
  onClearBuffer
}) => {
  const currentText = (bufferedTranscript + ' ' + interimTranscript).trim()
  const transcriptRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Pin newest transcription into view: auto-scroll all the way to the right so older words move out to the left
  useLayoutEffect(() => {
    const el = transcriptRef.current
    if (!el) return

    el.scrollLeft = el.scrollWidth
    setIsOverflowing(el.scrollWidth > el.clientWidth)

    // Schedule check on next frame for font/measurement reflow
    const rafId = requestAnimationFrame(() => {
      if (el) {
        el.scrollLeft = el.scrollWidth
        setIsOverflowing(el.scrollWidth > el.clientWidth)
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [currentText, pipelineStatus])

  return (
    <div className="fixed top-12 left-0 right-0 z-30 h-8 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200/90 px-3 sm:px-4 flex items-center justify-between text-xs select-none">
      <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
        {/* Animated Status / Mic Wave */}
        <div className="flex items-center gap-1 shrink-0">
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-600" />
          ) : pipelineStatus === 'thinking' ? (
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          ) : pipelineStatus === 'answering' ? (
            <Zap className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          ) : pipelineStatus === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <Mic
              className={`w-3.5 h-3.5 transition-colors ${
                isActive
                  ? currentText || pipelineStatus === 'transcribing'
                    ? 'text-emerald-600 animate-pulse'
                    : 'text-indigo-600'
                  : 'text-slate-400'
              }`}
            />
          )}

          {!isMuted && isActive && (currentText || pipelineStatus === 'transcribing') && pipelineStatus !== 'thinking' && pipelineStatus !== 'answering' && (
            <span className="flex gap-0.5 items-end h-3">
              <span className="w-0.5 h-2 bg-emerald-600 animate-[bounce_0.6s_infinite]" />
              <span className="w-0.5 h-3 bg-emerald-600 animate-[bounce_0.8s_infinite]" />
              <span className="w-0.5 h-1.5 bg-emerald-600 animate-[bounce_0.5s_infinite]" />
            </span>
          )}
        </div>

        {/* Live Transcript / Pipeline Status String (Newest words pinned to view on the right, older text scrolls off left) */}
        <div
          ref={transcriptRef}
          className="overflow-x-auto no-scrollbar whitespace-nowrap text-slate-700 font-sans tracking-tight flex-1"
          style={{
            maskImage: isOverflowing && currentText
              ? 'linear-gradient(to right, transparent 0%, black 28px, black 100%)'
              : 'none',
            WebkitMaskImage: isOverflowing && currentText
              ? 'linear-gradient(to right, transparent 0%, black 28px, black 100%)'
              : 'none'
          }}
          title={currentText || undefined}
        >
          {isMuted ? (
            <span className="text-rose-700 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Mic muted — speak freely without cluttering questions</span>
            </span>
          ) : pipelineStatus === 'thinking' ? (
            <span className="text-amber-800 font-semibold animate-pulse">
              🧠 Analyzing question & formulating approach...
            </span>
          ) : pipelineStatus === 'answering' ? (
            <span className="text-indigo-800 font-semibold">
              ⚡ Streaming solution...
            </span>
          ) : currentText ? (
            <span className="italic text-slate-800 font-medium">
              "{currentText}"
            </span>
          ) : isActive ? (
            <span className="text-slate-500">
              Listening for interview questions...
            </span>
          ) : (
            <span className="text-slate-400">
              Click Start to auto-connect microphone
            </span>
          )}
        </div>
      </div>

      {/* Clear Buffer Button if speech is buffered */}
      {currentText && pipelineStatus !== 'thinking' && pipelineStatus !== 'answering' && (
        <button
          onClick={onClearBuffer}
          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors shrink-0"
          title="Clear buffered speech"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
