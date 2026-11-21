import React from 'react'
import { Play, Square, Sparkles, Cpu, User } from 'lucide-react'
import { AppMode, PipelineStatus } from '../types'

interface TopBarProps {
  isActive: boolean
  pipelineStatus?: PipelineStatus
  mode: AppMode
  onToggleMode: (newMode: AppMode) => void
  onStart: () => void
  onEnd: () => void
  onOpenResume: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  isActive,
  pipelineStatus = 'idle',
  mode,
  onToggleMode,
  onStart,
  onEnd,
  onOpenResume
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-11 sm:h-12 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-4 flex items-center justify-between select-none shadow-xs">
      {/* Brand & Live status indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
          <span className="font-bold text-sm sm:text-base tracking-tighter text-slate-900">
            Cue<span className="text-indigo-600">Desk</span>
          </span>
        </div>

        {pipelineStatus === 'thinking' ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-[10px] font-semibold text-amber-800 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            THINKING
          </span>
        ) : pipelineStatus === 'answering' ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            ANSWERING
          </span>
        ) : isActive ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-[10px] font-semibold text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            HEARING
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-500">
            IDLE
          </span>
        )}
      </div>

      {/* Middle/Right Controls in a single horizontal row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Auto / Manual Mode Pill Toggle */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => onToggleMode('auto')}
            className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
              mode === 'auto'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden xs:inline">Auto</span>
          </button>
          <button
            onClick={() => onToggleMode('manual')}
            className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
              mode === 'manual'
                ? 'bg-white text-amber-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span className="hidden xs:inline">Manual</span>
          </button>
        </div>

        {/* Candidate Resume Grounding Drawer Trigger */}
        <button
          onClick={onOpenResume}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
          title="Candidate Resume & Background Grounding"
        >
          <User className="w-3.5 h-3.5 text-indigo-600" />
        </button>

        {/* Start / End Session Buttons */}
        {!isActive ? (
          <button
            onClick={onStart}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            title="Start session & connect microphone"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start</span>
          </button>
        ) : (
          <button
            onClick={onEnd}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            title="End session"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>End</span>
          </button>
        )}
      </div>
    </header>
  )
}
