export type Language = 'javascript' | 'python'
export type AppMode = 'auto' | 'manual'
export type PipelineStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'answering' | 'error'
export type AudioStatus = PipelineStatus

export interface LatencyMetrics {
  ttftMs?: number // Time to First Token (ms)
  totalMs?: number // Total generation duration (ms)
}

export interface ParsedAnswer {
  approach: string
  code: string
  codeFunctionOnly?: string
  outro?: string
  language: Language
  complexityTime: string
  complexitySpace: string
  followups: string[]
  raw: string
}

export interface Message {
  id: string
  question: string
  answerRaw: string
  parsed: ParsedAnswer
  language: Language
  timestamp: number
  isStreaming: boolean
  error?: string
  metrics?: LatencyMetrics
}

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}
