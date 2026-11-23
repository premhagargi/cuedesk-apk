import React, { useState, useRef } from 'react'
import { Send, Sparkles, Mic, MicOff } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (text: string) => void
  onBrainClick: () => void
  onClearMessages?: () => void
  hasMessages?: boolean
  isGenerating: boolean
  hasTranscript: boolean
  isMuted?: boolean
  isActive?: boolean
  onToggleMic?: () => void
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onBrainClick,
  onClearMessages,
  hasMessages = false,
  isGenerating,
  hasTranscript,
  isMuted = false,
  isActive = false,
  onToggleMic
}) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = text.trim()
    if (trimmed) {
      onSendMessage(trimmed)
      setText('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.blur()
      }
    } else {
      // If empty, trigger Answer action (answer current question or speech)
      onBrainClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto-expand textarea up to 120px max height
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pt-2 pb-5 sm:pb-3 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent backdrop-blur-md">
      {/* 1. Center Action Row: Circle Mic Button + Pill-Shaped Answer Button */}
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-2 px-1 relative">
        {/* Left balance spacer */}
        <div className="w-16 shrink-0" />

        {/* Center: Circle Mic Mute/Unmute Toggle + Pill-shaped Answer Action Button */}
        <div className="flex-1 flex items-center justify-center gap-2 sm:gap-2.5">
          {/* Circle Mic On/Off Toggle Button */}
          {onToggleMic && (
            <button
              type="button"
              onClick={onToggleMic}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-sm select-none shrink-0 ${
                isMuted
                  ? 'bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100 shadow-rose-100/50'
                  : isActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 shadow-emerald-100/50'
                  : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}
              title={
                isMuted
                  ? 'Mic Muted — tap to unmute and hear interviewer'
                  : isActive
                  ? 'Mic Listening — tap to mute while you answer out loud'
                  : 'Tap to start microphone'
              }
            >
              {isMuted ? (
                <MicOff className="w-4 h-4 text-rose-600" />
              ) : (
                <Mic className={`w-4 h-4 ${isActive ? 'text-emerald-600 animate-pulse' : 'text-slate-500'}`} />
              )}
            </button>
          )}

          {/* Pill-shaped Answer Action Button */}
          <button
            type="button"
            onClick={() => {
              if (!isGenerating) {
                onBrainClick()
              }
            }}
            disabled={isGenerating}
            className={`px-6 sm:px-7 py-2 rounded-full flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md active:scale-95 select-none ${
              isGenerating
                ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-wait shadow-sm'
                : hasTranscript
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_22px_rgba(245,158,11,0.45)] border border-amber-400 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 hover:border-slate-700'
            }`}
            title={isGenerating ? "AI is generating answer..." : "Generate answer for current speech or question"}
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Answering...</span>
              </>
            ) : (
              <>
                <Sparkles className={`w-3.5 h-3.5 ${hasTranscript ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>Answer</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Floating Clear Session Button */}
        <div className="w-16 shrink-0 flex justify-end">
          {hasMessages && onClearMessages && (
            <button
              type="button"
              onClick={onClearMessages}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95 shadow-xs"
              title="Clear conversation"
            >
              <span>✕ Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Problem Paste Input Box */}
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto flex items-end gap-2 bg-white border border-slate-300 rounded-2xl p-1.5 shadow-md focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
      >
        {/* Multi-line auto-expanding problem paste input box */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Paste problem from chat or type question... (Enter to send, Shift+Enter for newline)"
          className="flex-1 bg-transparent border-0 px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none tracking-tight font-sans resize-none max-h-[120px] leading-relaxed"
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={isGenerating && !text.trim()}
          className={`shrink-0 p-2 rounded-xl transition-all mb-0.5 ${
            text.trim()
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          title={text.trim() ? 'Send pasted question' : 'Answer current'}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
