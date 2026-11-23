import React, { useState, useEffect, useRef } from 'react'
import { TopBar } from './components/TopBar'
import { AudioIndicator } from './components/AudioIndicator'
import { AnswerCard } from './components/AnswerCard'
import { ChatInput } from './components/ChatInput'
import { ResumeSidebar } from './components/ResumeSidebar'
import { SpeechService } from './services/speechService'
import { streamChatAnswer, convertCode } from './services/apiService'
import { parseAnswer } from './utils/answerParser'
import { AppMode, HistoryTurn, Language, Message, PipelineStatus } from './types'
import { Sparkles, ArrowDown } from 'lucide-react'

export const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle')
  const [mode, setMode] = useState<AppMode>('auto')
  const [defaultLanguage] = useState<Language>('javascript')
  const [messages, setMessages] = useState<Message[]>([])
  const messagesRef = useRef<Message[]>([])

  // Resume Grounding Sidebar State
  const [isResumeOpen, setIsResumeOpen] = useState(false)
  const [candidateContext, setCandidateContext] = useState(() => {
    try {
      return localStorage.getItem('cuedesk_resume_context') || ''
    } catch {
      return ''
    }
  })

  // Keep messagesRef permanently synchronized with latest messages state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const [interimTranscript, setInterimTranscript] = useState('')
  const [bufferedTranscript, setBufferedTranscript] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const isGeneratingRef = useRef(false)

  const updateGenerating = (val: boolean) => {
    isGeneratingRef.current = val
    setIsGenerating(val)
  }

  // Safety watchdog: ensure isGenerating never stays stuck in answering mode
  useEffect(() => {
    if (!isGenerating) return
    const stuckWatchdog = setTimeout(() => {
      if (isGeneratingRef.current) {
        console.warn('[CueDesk Safety Watchdog] isGenerating stuck for >25s, releasing button lock')
        updateGenerating(false)
        setPipelineStatus(isActive ? 'listening' : 'idle')
      }
    }, 25000)
    return () => clearTimeout(stuckWatchdog)
  }, [isGenerating, isActive])

  const speechServiceRef = useRef<SpeechService | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const isNearBottomRef = useRef(true)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const activeAbortRef = useRef<AbortController | null>(null)
  const triggerAnswerRef = useRef<(questionText?: string, targetMessageId?: string) => Promise<void>>((() => {}) as any)

  // Track scroll position across mobile browsers & WebViews reliably
  const checkIfNearBottom = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0
    const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight)
    const near = distanceToBottom < 220
    isNearBottomRef.current = near
    setShowScrollBottomBtn(!near && messages.length > 0)
  }

  useEffect(() => {
    window.addEventListener('scroll', checkIfNearBottom, { passive: true })
    return () => window.removeEventListener('scroll', checkIfNearBottom)
  }, [messages.length])

  // Scroll directly to the START of the target answer card using browser-native scrollIntoView
  // Retries via requestAnimationFrame to guarantee React DOM mount on all mobile devices
  const scrollToCardTop = (cardId: string, smooth = true, attempts = 6) => {
    const el = document.getElementById(`msg-card-${cardId}`)
    if (el) {
      el.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start'
      })
    } else if (attempts > 0) {
      requestAnimationFrame(() => scrollToCardTop(cardId, smooth, attempts - 1))
    }
  }

  const scrollToLatestCard = (smooth = true) => {
    const latest = messagesRef.current[messagesRef.current.length - 1]
    if (latest) {
      scrollToCardTop(latest.id, smooth)
    }
  }

  // Auto-scroll to newly added message card as soon as it mounts in the DOM
  const latestMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (!latestMessageId) return
    scrollToCardTop(latestMessageId, true)
  }, [latestMessageId])

  // Screen Wake Lock API: Keep phone display awake during active interview
  useEffect(() => {
    let wakeLock: any = null

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && isActive) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
          console.log('[WakeLock] Screen wake lock acquired.')
        }
      } catch (err: any) {
        console.warn('[WakeLock] Could not acquire screen wake lock:', err?.message || err)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        requestWakeLock()
      }
    }

    if (isActive) {
      requestWakeLock()
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLock) {
        wakeLock.release().catch(() => {})
      }
    }
  }, [isActive])

  // Initialize Speech Recognition Service
  useEffect(() => {
    const service = new SpeechService({
      onTranscriptUpdate: (interim, final) => {
        setInterimTranscript(interim)
        setBufferedTranscript(final)
      },
      onAutoTrigger: (question) => {
        // If an answer is currently generating, NEVER interrupt it on auto speech!
        if (isGeneratingRef.current) {
          console.log('[Auto-Trigger Ignored]: AI is actively generating an answer; skipping auto-trigger to protect session.')
          return
        }
        triggerAnswerRef.current(question)
      },
      onStatusChange: (status) => {
        if (status === 'error') {
          console.warn('Speech service encountered an error')
          setPipelineStatus('error')
        } else if (status === 'transcribing') {
          setPipelineStatus('transcribing')
        } else if (status === 'listening') {
          setPipelineStatus((prev) => (prev === 'thinking' || prev === 'answering' ? prev : 'listening'))
        } else if (status === 'idle') {
          setPipelineStatus('idle')
        }
      }
    })

    speechServiceRef.current = service
    service.preloadToken()

    return () => {
      service.stop()
    }
  }, [])

  // Sync mode changes to speech service
  useEffect(() => {
    speechServiceRef.current?.setMode(mode)
  }, [mode])

  // Handle Session Start & Auto-connect Mic
  const handleStartSession = async () => {
    setIsActive(true)
    setIsMuted(false)
    setPipelineStatus('listening')
    const started = await speechServiceRef.current?.start()
    if (!started) {
      console.warn('Microphone permission denied or speech recognition not available')
      setPipelineStatus('error')
    }
  }

  // Handle Session End
  const handleEndSession = () => {
    setIsActive(false)
    setIsMuted(false)
    setPipelineStatus('idle')
    speechServiceRef.current?.stop()
    speechServiceRef.current?.clearBuffer()
    setInterimTranscript('')
    setBufferedTranscript('')
    if (activeAbortRef.current) {
      activeAbortRef.current.abort()
      activeAbortRef.current = null
    }
    updateGenerating(false)
  }

  // Handle 1-Tap Circle Mic On/Off Mute Toggle
  const handleToggleMic = async () => {
    if (!isActive || pipelineStatus === 'error') {
      // If session is idle or in error, one tap activates the session and un-mutes
      setIsMuted(false)
      await handleStartSession()
      return
    }

    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    speechServiceRef.current?.setMuted(nextMuted)
    if (nextMuted) {
      setInterimTranscript('')
    }
  }

  // Trigger Answer Generation (runs on every click / speech trigger)
  const handleTriggerAnswer = async (questionText?: string, targetMessageId?: string) => {
    // Absolute Generation Lock: Once a request is sent, NEVER abort or cancel in-flight generation!
    if (isGeneratingRef.current) {
      console.log('[Generation Protected]: Active LLM answer in progress; ignoring trigger to let current answer complete.')
      return
    }

    let textToAsk = ''
    let isReAnswer = false
    let messageIdToUse = targetMessageId || ''

    if (questionText && questionText.trim()) {
      // Explicit question provided (from chat input, trap click, or card re-generate)
      textToAsk = questionText.trim()
      if (targetMessageId) {
        isReAnswer = true
      }
    } else {
      // Check for unhandled speech captured by mic since last answer
      const unhandledSpeech = speechServiceRef.current?.getUnansweredText().trim() || ''
      const interim = interimTranscript.trim()
      const pendingSpeech = (unhandledSpeech + (interim ? ' ' + interim : '')).trim()

      if (pendingSpeech) {
        // We have newly spoken speech from the interviewer!
        textToAsk = pendingSpeech
      } else {
        // In Manual Mode: no new speech has arrived.
        // Re-generate the latest turn question from history if requested
        const latestMsg = messagesRef.current[messagesRef.current.length - 1]
        if (latestMsg?.question) {
          textToAsk = latestMsg.question
          messageIdToUse = latestMsg.id
          isReAnswer = true
        }
      }
    }

    if (!textToAsk) return

    // Mark current speech as answered so future words belong to the next turn or follow-up
    speechServiceRef.current?.markAnswered()
    setInterimTranscript('')

    // Auto-detect target language if user requested Python or JavaScript explicitly
    let currentLang = defaultLanguage
    const lowerPrompt = textToAsk.toLowerCase()
    if (lowerPrompt.includes('python') || lowerPrompt.includes('in py') || lowerPrompt.includes('to py')) {
      currentLang = 'python'
    } else if (lowerPrompt.includes('javascript') || lowerPrompt.includes('in js') || lowerPrompt.includes('to js')) {
      currentLang = 'javascript'
    }

    const newMessageId = isReAnswer && messageIdToUse ? messageIdToUse : 'msg_' + Date.now()

    if (isReAnswer && messageIdToUse) {
      // Re-answering existing question in-place: update existing card to streaming state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageIdToUse
            ? {
                ...m,
                question: textToAsk,
                answerRaw: '',
                parsed: parseAnswer('', currentLang),
                language: currentLang,
                isStreaming: true,
                error: undefined,
                metrics: undefined
              }
            : m
        )
      )
    } else {
      // Brand new question: append to bottom of messages array (ChatGPT / Claude style)
      const newMessage: Message = {
        id: newMessageId,
        question: textToAsk,
        answerRaw: '',
        parsed: parseAnswer('', currentLang),
        language: currentLang,
        timestamp: Date.now(),
        isStreaming: true
      }

      setMessages((prev) => {
        const next = [...prev, newMessage]
        messagesRef.current = next
        return next
      })
    }

    updateGenerating(true)
    setPipelineStatus('thinking')
    // Align screen directly to the START of this new answer card (no scrolling past to bottom)
    scrollToCardTop(newMessageId, true)

    // Build history for context preservation from messagesRef.current (up to last 3 full turns = 6 messages)
    const historyTurns: HistoryTurn[] = []
    const priorMessages = messagesRef.current.filter((m) => m.id !== newMessageId).slice(-6)
    for (const msg of priorMessages) {
      if (msg.question && msg.answerRaw) {
        historyTurns.push({ role: 'user', content: msg.question })
        historyTurns.push({ role: 'assistant', content: msg.answerRaw })
      }
    }

    const abortController = new AbortController()
    activeAbortRef.current = abortController

    let accumulatedRaw = ''

    try {
      await streamChatAnswer({
        prompt: textToAsk,
        history: historyTurns, // Multi-turn conversation history for accurate pronoun and follow-up resolution
        language: currentLang,
        candidateContext,
        signal: abortController.signal,
        onFirstToken: (ttftMs) => {
          setPipelineStatus('answering')
          // Ensure viewport is pinned to the start of this card so line 1 is visible immediately
          scrollToCardTop(newMessageId, false)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === newMessageId
                ? {
                    ...m,
                    metrics: { ...(m.metrics || {}), ttftMs }
                  }
                : m
            )
          )
        },
        onChunk: (chunk) => {
          accumulatedRaw += chunk
          const currentParsed = parseAnswer(accumulatedRaw, currentLang)

          setMessages((prev) =>
            prev.map((m) =>
              m.id === newMessageId
                ? {
                    ...m,
                    answerRaw: accumulatedRaw,
                    parsed: currentParsed
                  }
                : m
            )
          )
        },
        onDone: (totalMs) => {
          const finalParsed = parseAnswer(accumulatedRaw, currentLang)
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === newMessageId
                ? {
                    ...m,
                    isStreaming: false,
                    answerRaw: accumulatedRaw,
                    parsed: finalParsed,
                    metrics: { ...(m.metrics || {}), totalMs }
                  }
                : m
            )
            messagesRef.current = updated
            return updated
          })
        },
        onError: (errMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === newMessageId
                ? {
                    ...m,
                    isStreaming: false,
                    error: errMsg
                  }
                : m
            )
          )
          updateGenerating(false)
          setPipelineStatus(isActive ? 'listening' : 'idle')
        }
      })
    } finally {
      // Ironclad recovery: ALWAYS clear generating & streaming states to prevent UI hangs
      updateGenerating(false)
      setPipelineStatus(isActive ? 'listening' : 'idle')
      activeAbortRef.current = null
      setMessages((prev) =>
        prev.map((m) =>
          m.id === newMessageId
            ? { ...m, isStreaming: false }
            : m
        )
      )
    }
  }
  triggerAnswerRef.current = handleTriggerAnswer

  // User tapped '✕ Clear': clears all previous questions/answers, resets buffers, and starts fresh listening
  const handleClearSessionAndStartFresh = async () => {
    // 1. Abort any in-flight LLM generation immediately
    if (activeAbortRef.current) {
      activeAbortRef.current.abort()
      activeAbortRef.current = null
    }
    updateGenerating(false)

    // 2. Clear all messages from conversation feed
    setMessages([])
    messagesRef.current = []

    // 3. Clear transcription buffers
    setInterimTranscript('')
    setBufferedTranscript('')

    // 4. Ensure mic is active and listening fresh for the very next question
    setIsActive(true)
    setPipelineStatus('listening')
    if (speechServiceRef.current) {
      await speechServiceRef.current.startFresh()
    }
  }

  // Handle On-Demand Language Conversion (JS <-> Python) on the Code Block
  const handleConvertCodeLanguage = async (messageId: string, targetLanguage: Language) => {
    const targetMsg = messages.find((m) => m.id === messageId)
    if (!targetMsg || !targetMsg.parsed.code) return

    try {
      const converted = await convertCode({
        code: targetMsg.parsed.code,
        targetLanguage,
        question: targetMsg.question
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                language: targetLanguage,
                parsed: {
                  ...m.parsed,
                  code: converted,
                  language: targetLanguage
                }
              }
            : m
        )
      )
    } catch (err: any) {
      console.error('Code conversion error:', err)
    }
  }

  const hasPendingTranscript = Boolean((bufferedTranscript + ' ' + interimTranscript).trim())

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans tracking-tight flex flex-col selection:bg-indigo-500/20">
      {/* 1. Fixed Top Bar */}
      <TopBar
        isActive={isActive}
        isMuted={isMuted}
        pipelineStatus={pipelineStatus}
        mode={mode}
        onToggleMode={(newMode) => setMode(newMode)}
        onStart={handleStartSession}
        onEnd={handleEndSession}
        onOpenResume={() => setIsResumeOpen(true)}
      />

      {/* 2. Fixed Audio Indicator Pill */}
      <AudioIndicator
        isActive={isActive}
        isMuted={isMuted}
        pipelineStatus={pipelineStatus}
        interimTranscript={interimTranscript}
        bufferedTranscript={bufferedTranscript}
        onClearBuffer={() => {
          speechServiceRef.current?.clearBuffer()
          setInterimTranscript('')
          setBufferedTranscript('')
        }}
      />

      {/* 3. Main Scrollable Conversation Area (Chronological Order: Oldest Top, Newest at Bottom) */}
      <main className="flex-1 pt-20 pb-36 px-1.5 sm:px-4 max-w-3xl w-full mx-auto">
        {messages.length === 0 ? (
          /* Empty / Idle State */
          <div className="h-[70vh] flex flex-col items-center justify-center text-center px-4 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 text-indigo-600 shadow-sm">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2">
              Ready for your Interview
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              Tap <span className="text-emerald-600 font-semibold">Start</span> to auto-connect microphone, or paste any question into the chat bar below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600">
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
                ⚡ Cerebras gpt-oss-120b
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
                👤 Resume Grounded
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
                ⏱️ Smart Silence Cascade
              </span>
            </div>
          </div>
        ) : (
          /* Chronological Message List: Newest answer is at the bottom (ChatGPT / Claude style) */
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                id={`msg-card-${msg.id}`}
                className="transition-all scroll-mt-24"
              >
                <AnswerCard
                  message={msg}
                  onConvertLanguage={handleConvertCodeLanguage}
                  onRegenerate={(q, id) => handleTriggerAnswer(q, id)}
                  onAskFollowup={(q) => handleTriggerAnswer(q)}
                />
              </div>
            ))}
            {/* Scroll Anchor */}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </main>

      {/* Floating Scroll-to-Latest Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToLatestCard(true)}
          className="fixed bottom-24 right-4 sm:right-8 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur transition-all active:scale-95"
          title="Jump to latest answer"
        >
          <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
          <span>Latest answer</span>
        </button>
      )}

      {/* 4. Bottom Chat / Question Input & Pill-shaped Answer Trigger Bar */}
      <ChatInput
        onSendMessage={(text) => handleTriggerAnswer(text)}
        onBrainClick={() => handleTriggerAnswer()}
        onClearMessages={handleClearSessionAndStartFresh}
        hasMessages={messages.length > 0}
        isGenerating={isGenerating}
        hasTranscript={hasPendingTranscript}
        isMuted={isMuted}
        isActive={isActive}
        onToggleMic={handleToggleMic}
      />

      {/* 5. Slide-Over Candidate Resume Grounding Sidebar */}
      <ResumeSidebar
        isOpen={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
        onSaveContext={(ctx) => setCandidateContext(ctx)}
      />
    </div>
  )
}
export default App
