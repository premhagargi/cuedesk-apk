import React, { useState } from 'react'
import { Check, Copy, ChevronDown, Code2, Sparkles, Clock, HardDrive, RotateCcw, HelpCircle, Eye, EyeOff, Play } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Language, Message } from '../types'

interface AnswerCardProps {
  message: Message
  onConvertLanguage: (messageId: string, targetLanguage: Language) => Promise<void>
  onRegenerate?: (question: string, messageId: string) => void
  onAskFollowup?: (question: string) => void
}

export const AnswerCard: React.FC<AnswerCardProps> = ({
  message,
  onConvertLanguage,
  onRegenerate,
  onAskFollowup
}) => {
  const [copied, setCopied] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false)
  const [codeViewMode, setCodeViewMode] = useState<'runnable' | 'function'>('runnable')
  const [isConverting, setIsConverting] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const { question, parsed, isStreaming, error, timestamp, metrics } = message
  const { approach, code, codeFunctionOnly, outro, language, complexityTime, complexitySpace, followups } = parsed

  // Active code depending on toggle mode (Runnable script with runner/caller vs Function only)
  const activeCode = (codeViewMode === 'function' && codeFunctionOnly) ? codeFunctionOnly : code

  const handleCopy = async () => {
    if (!activeCode) return
    try {
      await navigator.clipboard.writeText(activeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const handleLanguageChange = async (newLang: Language) => {
    if (newLang === language || isConverting) return
    setLangDropdownOpen(false)
    setIsConverting(true)
    try {
      await onConvertLanguage(message.id, newLang)
    } finally {
      setIsConverting(false)
    }
  }

  // Format timestamp for Chiku AI style "AI Answer - HH:MM"
  const formattedTime = new Date(timestamp || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Render code with comment lines highlighted in vivid golden yellow
  const renderCodeWithComments = (rawCode: string) => {
    if (!rawCode) return null

    const lines = rawCode.split('\n')
    return lines.map((line, idx) => {
      // 1. Pure comment line (//, #, /*, *, JSDoc, etc.)
      const pureCommentMatch = line.match(/^(\s*)((\/\/|#|\/\*|\*).*)$/)
      if (pureCommentMatch) {
        return (
          <span key={idx} className="block text-yellow-600 dark:text-yellow-400 font-medium">
            {line || '\u00A0'}
          </span>
        )
      }

      // 2. Trailing inline comment (code followed by // or #)
      // Negative lookahead (?!\/) prevents false positives on URLs like https://
      const inlineCommentMatch = line.match(/^(.*?)(\s+(?:\/\/|#)(?!\/).*)$/)
      if (inlineCommentMatch) {
        const codePart = inlineCommentMatch[1]
        const commentPart = inlineCommentMatch[2]
        return (
          <span key={idx} className="block">
            <span>{codePart}</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">{commentPart}</span>
          </span>
        )
      }

      return (
        <span key={idx} className="block">
          {line || '\u00A0'}
        </span>
      )
    })
  }

  // Shared markdown components with signature warm-amber bold highlighting on clean white
  const markdownComponents = {
    p: ({ children }: any) => <p className="mb-3.5 last:mb-0 leading-relaxed text-slate-800">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 space-y-2 my-3 text-slate-800">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-2 my-3 text-slate-800">{children}</ol>,
    li: ({ children }: any) => <li className="pl-1 leading-relaxed">{children}</li>,
    strong: ({ children }: any) => <strong className="text-amber-700 font-semibold">{children}</strong>,
    code: ({ children }: any) => (
      <code className="bg-slate-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">
        {children}
      </code>
    ),
    pre: ({ children }: any) => (
      <pre className="my-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-mono leading-relaxed text-slate-900 overflow-x-auto whitespace-pre-wrap break-words">
        {children}
      </pre>
    ),
    h1: ({ children }: any) => (
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mt-3.5 mb-1.5">
        {children}
      </h3>
    ),
    h2: ({ children }: any) => (
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mt-3.5 mb-1.5">
        {children}
      </h3>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mt-3.5 mb-1.5">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-xs font-semibold text-slate-700 mt-2 mb-1">
        {children}
      </h4>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-3 border-amber-500 pl-3.5 my-2.5 text-slate-700 italic bg-amber-50/50 py-1.5 rounded-r-lg">
        {children}
      </blockquote>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-3 rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs text-left">{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th className="px-3 py-2 bg-slate-100 font-semibold text-slate-800">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2 border-t border-slate-100 text-slate-700">{children}</td>
  }

  return (
    <article
      id={`msg-card-inner-${message.id}`}
      className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4 shadow-sm hover:shadow-md relative transition-all"
    >
      {/* 1. Question Header with Warm Amber Accent (Chiku AI style) */}
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex-1 flex items-start gap-2.5">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <h2 className="text-[15.5px] sm:text-[17px] font-bold text-amber-600 leading-snug tracking-tight">
            {question}
          </h2>
        </div>
        {onRegenerate && (
          <button
            onClick={() => onRegenerate(question, message.id)}
            disabled={isStreaming}
            className="shrink-0 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            title="Re-answer this question"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        )}
      </div>

      {/* Collapsible Answer Body */}
      {!isCollapsed ? (
        <>
          {/* 2. ✨ ANSWER Badge */}
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-600 mb-3 select-none">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>ANSWER</span>
          </div>

          {/* Error state if any */}
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* 3. Spoken Approach / Direct Conversational Answer */}
          {approach && (
            <div className="mb-3 text-[14.5px] sm:text-[15px] text-slate-800 leading-relaxed font-sans font-normal">
              <ReactMarkdown components={markdownComponents}>
                {approach}
              </ReactMarkdown>
            </div>
          )}

          {/* 4. Code Block - Rendered ONLY when code was generated */}
          {code && (
            <div className="my-4 rounded-xl border border-slate-200 bg-[#f8fafc] overflow-hidden shadow-xs">
              {/* Code Header with View Mode, Language Pill & Copy Button */}
              <div className="h-9 bg-slate-100/90 px-3 sm:px-4 flex items-center justify-between border-b border-slate-200 select-none">
                {/* Left: Language File Badge */}
                <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
                  <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'python' ? 'solution.py' : 'solution.ts'}</span>
                  {codeViewMode === 'function' && (
                    <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-medium">function only</span>
                  )}
                </div>

                {/* Right: Code View Mode Dropdown + Language Dropdown + Copy Button */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* View Mode Dropdown: ⚡ Runnable Script (Default) vs 📦 Function Only */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setViewDropdownOpen(!viewDropdownOpen)
                        setLangDropdownOpen(false)
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 shadow-xs transition-colors"
                      title="Toggle between complete runnable code with runner and function only"
                    >
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        {codeViewMode === 'runnable' ? (
                          <>
                            <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                            <span>Runnable</span>
                          </>
                        ) : (
                          <>
                            <Code2 className="w-3 h-3 text-indigo-600" />
                            <span>Function Only</span>
                          </>
                        )}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>

                    {viewDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30">
                        <button
                          onClick={() => {
                            setCodeViewMode('runnable')
                            setViewDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between ${
                            codeViewMode === 'runnable'
                              ? 'text-emerald-700 bg-emerald-50 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                            <span>Runnable (Default)</span>
                          </span>
                          {codeViewMode === 'runnable' && <Check className="w-3 h-3 text-emerald-600" />}
                        </button>
                        <button
                          onClick={() => {
                            setCodeViewMode('function')
                            setViewDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between ${
                            codeViewMode === 'function'
                              ? 'text-indigo-600 bg-indigo-50 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Code2 className="w-3 h-3 text-indigo-600" />
                            <span>Function Only</span>
                          </span>
                          {codeViewMode === 'function' && <Check className="w-3 h-3 text-indigo-600" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Language Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setLangDropdownOpen(!langDropdownOpen)
                        setViewDropdownOpen(false)
                      }}
                      disabled={isConverting || isStreaming}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 shadow-xs transition-colors"
                      title="Switch code language (JS / Python)"
                    >
                      <span>{language === 'python' ? 'Python' : 'TypeScript'}</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>

                    {langDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30">
                        <button
                          onClick={() => handleLanguageChange('javascript')}
                          className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between ${
                            language === 'javascript'
                              ? 'text-indigo-600 bg-indigo-50 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>TypeScript</span>
                          {language === 'javascript' && <Check className="w-3 h-3 text-indigo-600" />}
                        </button>
                        <button
                          onClick={() => handleLanguageChange('python')}
                          className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between ${
                            language === 'python'
                              ? 'text-indigo-600 bg-indigo-50 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>Python</span>
                          {language === 'python' && <Check className="w-3 h-3 text-indigo-600" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 shadow-xs transition-colors"
                    title={codeViewMode === 'function' ? 'Copy function only to clipboard' : 'Copy runnable script to clipboard'}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code Body */}
              <div className="px-3 py-3 sm:px-4 sm:py-3.5 text-[13px] sm:text-[13.5px] font-mono leading-relaxed text-slate-900 overflow-x-hidden selection:bg-indigo-100">
                {isConverting ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-indigo-600 text-xs font-sans">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Converting code to {language === 'python' ? 'TypeScript' : 'Python'}...</span>
                  </div>
                ) : (
                  <pre className="font-mono whitespace-pre-wrap break-words overflow-hidden w-full m-0">
                    <code>{renderCodeWithComments(activeCode)}</code>
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* 5. Spoken Outro / Post-Code Practical Explanations */}
          {outro && (
            <div className="mt-3 text-[14.5px] sm:text-[15px] text-slate-800 leading-relaxed font-sans font-normal">
              <ReactMarkdown components={markdownComponents}>
                {outro}
              </ReactMarkdown>
            </div>
          )}

          {/* 6. Spoken Complexity Breakdown (ONLY for Algorithmic/DSA Questions) */}
          {(complexityTime || complexitySpace) && (
            <div className="grid grid-cols-1 gap-2.5 pt-2 mb-2">
              {complexityTime && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/90 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-[13px] text-slate-800 leading-normal flex-1">
                    <span className="font-bold text-amber-900 mr-1.5">Time:</span>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <span className="inline leading-relaxed">{children}</span>,
                        strong: ({ children }) => <strong className="text-amber-800 font-bold">{children}</strong>,
                        code: ({ children }) => <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                      }}
                    >
                      {complexityTime}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {complexitySpace && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/90 flex items-start gap-2.5">
                  <HardDrive className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-[13px] text-slate-800 leading-normal flex-1">
                    <span className="font-bold text-emerald-900 mr-1.5">Space:</span>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <span className="inline leading-relaxed">{children}</span>,
                        strong: ({ children }) => <strong className="text-emerald-800 font-bold">{children}</strong>,
                        code: ({ children }) => <code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                      }}
                    >
                      {complexitySpace}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Quick Actions (Explain Code / Naive / Optimal / Show Code) & Follow-ups */}
          {(Boolean(code || complexityTime || (followups && followups.length > 0) || question)) && (
            <div className="mt-4 pt-3.5 border-t border-slate-200">
              <span className="text-[11.5px] text-slate-500 font-medium block mb-2 select-none">
                Quick Actions & Follow-ups
              </span>
              <div className="flex flex-wrap gap-2">
                {/* For theoretical questions WITHOUT code: Provide instant 'Give Code </>' pill */}
                {!code && (
                  <button
                    onClick={() =>
                      onAskFollowup?.(`Can you write the code for: "${question}"`)
                    }
                    disabled={isStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-700 transition-all active:scale-95 disabled:opacity-50 select-none shadow-xs"
                    title="Generate coding approach & complete code implementation"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Give Code {'</>'}</span>
                  </button>
                )}

                {/* For coding/algorithm questions: Provide Explain, Naive, and Optimal instant action pills */}
                {code && (
                  <>
                    <button
                      onClick={() =>
                        onAskFollowup?.(`Explain how this code works step by step in simple spoken English for: "${question}"`)
                      }
                      disabled={isStreaming}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200/80 border border-amber-300 text-xs font-semibold text-amber-900 transition-all active:scale-95 disabled:opacity-50 select-none shadow-xs"
                      title="Explain code step-by-step in simple English"
                    >
                      <span>🗣️ Explain code step-by-step</span>
                    </button>

                    <button
                      onClick={() =>
                        onAskFollowup?.(`Show the naive / brute force approach and code for: "${question}"`)
                      }
                      disabled={isStreaming}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-all active:scale-95 disabled:opacity-50 select-none shadow-xs"
                      title="Show brute-force / naive approach"
                    >
                      <span>💡 Naive approach</span>
                    </button>

                    <button
                      onClick={() =>
                        onAskFollowup?.(`Show the most optimal approach and code for: "${question}"`)
                      }
                      disabled={isStreaming}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-all active:scale-95 disabled:opacity-50 select-none shadow-xs"
                      title="Show optimal approach"
                    >
                      <span>⚡ Optimal approach</span>
                    </button>
                  </>
                )}

                {/* LLM generated dynamic follow-ups */}
                {followups &&
                  followups.map((trapQ, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAskFollowup?.(trapQ)}
                      disabled={isStreaming}
                      className="text-left px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-xs text-slate-700 hover:text-slate-900 transition-all active:scale-95 disabled:opacity-50 select-none shadow-xs"
                    >
                      {trapQ}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-2 text-xs text-slate-500 italic select-none">
          Answer hidden for stealth. Tap the eye icon to reveal.
        </div>
      )}

      {/* 8. Bottom Metadata (AI Answer - HH:MM & Latency Stats) + Stealth Eye Toggle */}
      <div className="mt-3.5 pt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-mono select-none">
        <div className="flex items-center gap-2">
          <span>AI Answer · {formattedTime}</span>
          {metrics && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span>·</span>
              <span className="text-amber-600 font-semibold">⚡ {metrics.ttftMs}ms</span>
              <span>·</span>
              <span>{((metrics.totalMs || 0) / 1000).toFixed(1)}s</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title={isCollapsed ? 'Reveal answer' : 'Hide answer (stealth)'}
        >
          {isCollapsed ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Streaming indicator dot */}
      {isStreaming && (
        <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 font-sans">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Generating answer...</span>
        </div>
      )}
    </article>
  )
}
