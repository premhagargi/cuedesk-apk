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
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pt-2 pb-5 sm:pb-3 bg-transparent pointer-events-none">
      {/* 1. Center Action Row: Pill-Shaped Answer Button on Left + Circle Mic Button on Right */}
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-2.5 px-1 relative">
        {/* Left: Floating Clear Session Button */}
        <div className="w-16 shrink-0 flex justify-start">
          {hasMessages && onClearMessages && (
            <button
              type="button"
              onClick={onClearMessages}
              className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95 shadow-sm"
              title="Clear conversation"
            >
              <span>✕ Clear</span>
            </button>
          )}
        </div>

        {/* Center: Bigger Pill-shaped Answer Action Button on LEFT + Bigger Circle Mic Button on RIGHT */}
        <div className="flex-1 flex items-center justify-center gap-3">
          {/* Bigger Pill-shaped Answer Action Button */}
          <button
            type="button"
            onClick={() => {
              if (!isGenerating) {
                onBrainClick()
              }
            }}
            disabled={isGenerating}
            className={`pointer-events-auto h-12 px-7 sm:px-8 rounded-full flex items-center gap-2.5 text-sm sm:text-base font-bold tracking-wide transition-all shadow-md active:scale-95 select-none ${
              isGenerating
                ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-wait shadow-sm'
                : hasTranscript
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_24px_rgba(245,158,11,0.5)] border border-amber-400 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 shadow-slate-900/25'
            }`}
            title={isGenerating ? "AI is generating answer..." : "Generate answer for current speech or question"}
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-amber-600" />
                <span>Answering...</span>
              </>
            ) : (
              <>
                <Sparkles className={`w-4 h-4 ${hasTranscript ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>Answer</span>
              </>
            )}
          </button>

          {/* Bigger Circle Mic On/Off Toggle Button (ON RIGHT SIDE) */}
          {onToggleMic && (
            <button
              type="button"
              onClick={onToggleMic}
              className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-md select-none shrink-0 ${
                isMuted
                  ? 'bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100 shadow-rose-200/60 ring-2 ring-rose-200/50'
                  : isActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 shadow-emerald-200/60 ring-2 ring-emerald-200/50'
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
                <MicOff className="w-5 h-5 text-rose-600" />
              ) : (
                <Mic className={`w-5 h-5 ${isActive ? 'text-emerald-600 animate-pulse' : 'text-slate-500'}`} />
              )}
            </button>
          )}
        </div>

        {/* Right balance spacer */}
        <div className="w-16 shrink-0" />
      </div>

      {/* 2. Problem Paste Input Box */}
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto max-w-3xl mx-auto flex items-end gap-2 bg-white/95 border border-slate-300 rounded-2xl p-1.5 shadow-md focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
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
