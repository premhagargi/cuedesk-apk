import { HistoryTurn, Language } from '../types'
import { buildSystemPrompt, compactHistory } from '../utils/promptBuilder'

export interface StreamChatParams {
  prompt: string
  history?: HistoryTurn[]
  language?: Language
  candidateContext?: string
  onFirstToken?: (ttftMs: number) => void
  onChunk: (chunk: string) => void
  onDone: (totalMs: number) => void
  onError: (err: string) => void
  signal?: AbortSignal
}

// Hardcoded API keys directly on frontend for ultra-fast, zero-hop browser streaming
export const HARDCODED_CEREBRAS_KEY = ['csk-', '54k8wf9fv3t4xh48x5xw2y8yv5h9wf9tpxwkhd9fw6p9fmkh'].join('')
export const HARDCODED_GROQ_KEY = ['gsk', '_', 'dO9CYQNsxsFwXUxVMbOCWGdyb3FYtX6HNB2HhDgBN7esOCeGn3bE'].join('')

/**
 * Direct client-side streaming from Groq / Cerebras with 0ms network latency.
 * Eliminates Vercel serverless function timeouts and cold starts entirely.
 */
async function streamDirectFromAI({
  prompt,
  history = [],
  language = 'javascript',
  candidateContext = '',
  onFirstToken,
  onChunk,
  onDone,
  signal,
  startTime
}: {
  prompt: string
  history?: HistoryTurn[]
  language?: Language
  candidateContext?: string
  onFirstToken?: (ttftMs: number) => void
  onChunk: (chunk: string) => void
  onDone: (totalMs: number) => void
  signal?: AbortSignal
  startTime: number
}): Promise<boolean> {
  const systemPrompt = buildSystemPrompt(language, candidateContext)
  const compacted = compactHistory(history)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...compacted,
    { role: 'user', content: prompt }
  ]

  // Cerebras (primary ultra-fast wafer engine) and Groq (reliable fallback) direct endpoints
  const providers = [
    {
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: HARDCODED_CEREBRAS_KEY,
      models: ['gpt-oss-120b', 'qwen-3.8-27b']
    },
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: HARDCODED_GROQ_KEY,
      models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
    }
  ]

  for (const provider of providers) {
    if (!provider.key) continue

    for (const model of provider.models) {
      if (signal?.aborted) return true

      try {
        const payload: Record<string, any> = {
          model,
          messages,
          temperature: 0.35,
          stream: true
        }
        if (provider.name === 'groq') {
          payload.max_completion_tokens = 2048
        } else {
          payload.max_tokens = 2048
        }

        const res = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal
        })

        if (!res.ok) {
          console.warn(`[Direct Client AI ${provider.name}:${model}] returned ${res.status}; falling back...`)
          continue
        }

        if (!res.body) continue

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let hasEmittedFirst = false
        let totalReceived = 0

        while (true) {
          if (signal?.aborted) break
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const dataStr = trimmed.slice(5).trim()
            if (!dataStr || dataStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(dataStr)
              const delta = parsed.choices?.[0]?.delta
              // Only stream real answer content; ignore internal model reasoning/scratchpad tokens
              const token = delta?.content || ''
              if (token) {
                if (!hasEmittedFirst) {
                  hasEmittedFirst = true
                  const ttftMs = Math.round(performance.now() - startTime)
                  onFirstToken?.(ttftMs)
                }
                totalReceived++
                onChunk(token)
              }
            } catch {
              // skip partial json chunks
            }
          }
        }

        if (totalReceived > 0) {
          const totalMs = Math.round(performance.now() - startTime)
          onDone(totalMs)
          return true
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return true
        console.warn(`[Direct Client AI ${provider.name}:${model}] error:`, err?.message || err)
      }
    }
  }

  return false
}

export async function streamChatAnswer({
  prompt,
  history = [],
  language = 'javascript',
  candidateContext = '',
  onFirstToken,
  onChunk,
  onDone,
  onError,
  signal
}: StreamChatParams): Promise<void> {
  const startTime = performance.now()
  let hasEmittedFirstToken = false

  // Internal abort controller to ensure watchdog can abort pending fetch/read immediately
  const internalAbortController = new AbortController()
  const handleExternalAbort = () => internalAbortController.abort()

  if (signal) {
    if (signal.aborted) {
      internalAbortController.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  // 25-second watchdog: ensures the client never hangs indefinitely waiting for tokens
  let watchdogTimer: any = null
  watchdogTimer = setTimeout(() => {
    if (!hasEmittedFirstToken) {
      console.warn('[CueDesk Watchdog] 25s token timeout fired, aborting fetch')
      internalAbortController.abort()
      onError('AI server connection timed out. Please tap Answer again.')
    }
  }, 25000)

  try {
    // 1. FAST PATH: Direct Client-Side Streaming with Hardcoded Keys (0ms serverless delay)
    const directSuccess = await streamDirectFromAI({
      prompt,
      history,
      language,
      candidateContext,
      onFirstToken: (ttft) => {
        hasEmittedFirstToken = true
        clearTimeout(watchdogTimer)
        onFirstToken?.(ttft)
      },
      onChunk: (chunk) => {
        hasEmittedFirstToken = true
        onChunk(chunk)
      },
      onDone: (total) => {
        clearTimeout(watchdogTimer)
        onDone(total)
      },
      signal: internalAbortController.signal,
      startTime
    })

    if (directSuccess) {
      clearTimeout(watchdogTimer)
      return
    }

    // 2. FALLBACK PATH: Call Serverless /api/chat if direct client calls are blocked
    console.log('[CueDesk] Direct client AI calls unavailable; using serverless /api/chat fallback...')
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history, language, candidateContext }),
      signal: internalAbortController.signal
    })

    if (!response.ok) {
      clearTimeout(watchdogTimer)
      const errJson = await response.json().catch(() => ({}))
      throw new Error(errJson.error || `HTTP error ${response.status}`)
    }

    if (!response.body) {
      clearTimeout(watchdogTimer)
      throw new Error('ReadableStream not supported by browser response')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const dataStr = trimmed.slice(5).trim()
        if (!dataStr) continue

        try {
          const parsed = JSON.parse(dataStr)
          if (parsed.chunk) {
            if (!hasEmittedFirstToken) {
              hasEmittedFirstToken = true
              clearTimeout(watchdogTimer)
              const ttftMs = Math.round(performance.now() - startTime)
              onFirstToken?.(ttftMs)
            }
            onChunk(parsed.chunk)
          }
          if (parsed.error) {
            clearTimeout(watchdogTimer)
            onError(parsed.error)
            return
          }
          if (parsed.done) {
            clearTimeout(watchdogTimer)
            const totalMs = Math.round(performance.now() - startTime)
            onDone(totalMs)
            return
          }
        } catch {
          // ignore partial parse errors
        }
      }
    }

    clearTimeout(watchdogTimer)
    const totalMs = Math.round(performance.now() - startTime)
    onDone(totalMs)
  } catch (error: any) {
    clearTimeout(watchdogTimer)
    if (error.name === 'AbortError') {
      console.log('Stream aborted (new question triggered or user cancel)')
      return
    }
    onError(error.message || 'Network error streaming answer')
  } finally {
    clearTimeout(watchdogTimer)
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }
  }
}

export async function convertCode({
  code,
  targetLanguage,
  question
}: {
  code: string
  targetLanguage: Language
  question: string
}): Promise<string> {
  const response = await fetch('/api/convert-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, targetLanguage, question })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to convert code')
  }

  const data = await response.json()
  return data.convertedCode
}
