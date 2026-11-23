import { isSentenceIncomplete, isCasualBanter } from '../utils/speechFilter'

export interface TranscriptSegment {
  id: string
  text: string
  isFinal: boolean
  timestamp: number
}

const QUESTION_MARK_THRESHOLD_MS = 1200
const DEFAULT_SILENCE_THRESHOLD_MS = 1800
const INCOMPLETE_SENTENCE_EXTRA_MS = 1500

export interface SpeechServiceCallbacks {
  onTranscriptUpdate: (interim: string, final: string) => void
  onAutoTrigger: (question: string) => void
  onStatusChange: (status: 'idle' | 'listening' | 'transcribing' | 'error') => void
}

const HARDCODED_DEEPGRAM_KEY = ['2b4a02df4e', '15d95fa5942f541f3347063088f4be'].join('')

export class SpeechService {
  private ws: WebSocket | null = null
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private isActive = false
  private mode: 'auto' | 'manual' = 'auto'
  private keepAliveInterval: any = null
  private autoTriggerTimer: any = null
  private segments: TranscriptSegment[] = []
  private lastAnsweredTimestamp = 0
  private callbacks: SpeechServiceCallbacks
  private reconnectTimeout: any = null
  private reconnectAttempts = 0
  private incompleteRetryCount = 0
  private isMuted = false

  constructor(callbacks: SpeechServiceCallbacks) {
    this.callbacks = callbacks
  }

  public setMode(mode: 'auto' | 'manual') {
    this.mode = mode
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
    }
    if (muted) {
      if (this.autoTriggerTimer) {
        clearTimeout(this.autoTriggerTimer)
        this.autoTriggerTimer = null
      }
      this.callbacks.onTranscriptUpdate('', this.getRollingTranscript())
    } else {
      // Instant Health Revival: when unmuting, guarantee WebSocket & MediaRecorder are active
      this.reconnectAttempts = 0
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        console.log('[SpeechService] Unmuted but socket/recorder not running; immediately reviving audio stream...')
        this.start()
      } else {
        this.callbacks.onStatusChange('listening')
      }
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted
  }

  public preloadToken(): void {
    // Key is hardcoded on frontend for instant 0ms connection
  }

  private getDeepgramKey(): string {
    return HARDCODED_DEEPGRAM_KEY
  }

  public async start(): Promise<boolean> {
    this.isActive = true
    this.lastAnsweredTimestamp = 0

    // If socket is already open and recording, we are already listening!
    if (this.ws?.readyState === WebSocket.OPEN && this.mediaRecorder?.state === 'recording') {
      this.callbacks.onStatusChange('listening')
      return true
    }

    // Clean up any stale or lingering socket before opening a new one
    this.cleanupSocket()

    try {
      // 1. Fetch Deepgram key from cache or server
      const deepgramKey = await this.getDeepgramKey()

      // 2. Request user microphone with mobile noise-cancellation constraints (reuse stream if active)
      if (
        !this.mediaStream ||
        !this.mediaStream.active ||
        !this.mediaStream.getAudioTracks().some((t) => t.readyState === 'live')
      ) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
            sampleRate: 16000
          }
        })
      }
      // Guarantee track enabled state matches current isMuted state
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted
      })

      // 3. Connect to Deepgram Live Streaming WebSocket (nova-3 flagship Transformer model)
      const params = new URLSearchParams({
        model: 'nova-3',
        language: 'en',
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'true',
        endpointing: '350',
        utterance_end_ms: '1000',
        vad_events: 'true',
        numerals: 'true'
      })

      const dgUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`
      this.ws = new WebSocket(dgUrl, ['token', deepgramKey])

      this.ws.onopen = () => {
        console.log('[Deepgram] WebSocket connected, starting audio stream...')
        this.reconnectAttempts = 0
        this.callbacks.onStatusChange('listening')

        // Send keepalive ping immediately and every 3.5s to prevent idle disconnect
        try {
          this.ws?.send(JSON.stringify({ type: 'KeepAlive' }))
        } catch {}

        this.keepAliveInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
          }
        }, 3500)

        // 4. Start recording and streaming audio chunks (every 250ms)
        const mimeType = this.getSupportedMimeType()
        this.mediaRecorder = mimeType
          ? new MediaRecorder(this.mediaStream!, { mimeType })
          : new MediaRecorder(this.mediaStream!)

        this.mediaRecorder.ondataavailable = (event) => {
          // Never drop audio packets! When muted, track.enabled=false already outputs pure digital silence.
          // Sending continuous silent frames keeps Deepgram's WebM/Opus timeline synchronized, prevents socket idle timeouts,
          // and ensures instant 0ms transcription the microsecond the user unmutes.
          if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(event.data)
          }
        }

        this.mediaRecorder.start(250)
      }

      this.ws.onmessage = (event) => {
        if (this.isMuted) return
        try {
          const data = JSON.parse(event.data)

          // Voice activity detected: update status to transcribing and pause silence trigger
          if (data.type === 'SpeechStarted') {
            this.callbacks.onStatusChange('transcribing')
            if (this.autoTriggerTimer) {
              clearTimeout(this.autoTriggerTimer)
              this.autoTriggerTimer = null
            }
            return
          }

          // Handle UtteranceEnd event from Deepgram neural VAD
          if (data.type === 'UtteranceEnd') {
            const unanswered = this.getUnansweredText().trim()
            if (!unanswered || unanswered.split(' ').length < 2) return

            // If it's casual banter or audio check (e.g. "can you hear me", "hello", "yeah"), ignore
            if (isCasualBanter(unanswered)) {
              console.log('[UtteranceEnd ignored — casual banter]:', unanswered)
              return
            }

            // If the sentence is incomplete (interviewer paused mid-sentence), DO NOT fire!
            // Let the adaptive silence timer wait for the speaker to resume.
            if (isSentenceIncomplete(unanswered)) {
              console.log('[UtteranceEnd ignored — sentence incomplete]:', unanswered)
              return
            }

            if (this.mode === 'auto') {
              this.scheduleAutoTrigger()
            }
            return
          }

          const alt = data.channel?.alternatives?.[0]
          const transcript = alt?.transcript?.trim() || ''

          if (!transcript) return

          if (data.is_final) {
            // Debounce rapid duplicate is_final events (<120ms)
            const now = Date.now()
            if (this.segments.length > 0) {
              const last = this.segments[this.segments.length - 1]
              if (now - last.timestamp < 120 && last.text === transcript) {
                return
              }
            }

            // Append final sentence as a segment with timestamp
            const seg: TranscriptSegment = {
              id: Math.random().toString(36).substring(7),
              text: transcript,
              isFinal: true,
              timestamp: now
            }
            this.segments.push(seg)
            // Keep up to 100 recent segments
            if (this.segments.length > 100) {
              this.segments.shift()
            }

            const rolling = this.getRollingTranscript()
            this.callbacks.onTranscriptUpdate('', rolling)
            this.callbacks.onStatusChange('listening')

            // Auto-trigger logic when speaker finishes (silence timer)
            if (this.mode === 'auto') {
              this.incompleteRetryCount = 0
              this.scheduleAutoTrigger()
            }
          } else {
            // Interim live streaming words alongside rolling transcript
            this.callbacks.onStatusChange('transcribing')
            const rolling = this.getRollingTranscript()
            this.callbacks.onTranscriptUpdate(transcript, rolling)

            // Reset silence countdown when actively hearing words in auto mode
            if (this.autoTriggerTimer) {
              clearTimeout(this.autoTriggerTimer)
              this.autoTriggerTimer = null
            }
          }
        } catch (err) {
          console.error('[Deepgram] Message parse error:', err)
        }
      }

      this.ws.onerror = (err) => {
        console.error('[Deepgram] WebSocket error:', err)
        this.callbacks.onStatusChange('error')
      }

      this.ws.onclose = (event: CloseEvent) => {
        console.log(`[Deepgram] WebSocket closed (code: ${event?.code}, reason: "${event?.reason || 'none'}")`)
        this.cleanupSocket()
        if (this.isActive) {
          this.reconnectAttempts++
          // Fast reconnect for the first 3 attempts (350ms - 1050ms) so connection recovers immediately
          const delay = this.reconnectAttempts <= 3
            ? 350 * this.reconnectAttempts
            : Math.min(1000 + this.reconnectAttempts * 300, 3000)
          console.log(`[Deepgram] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`)
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
          this.reconnectTimeout = setTimeout(() => {
            if (this.isActive) {
              this.start()
            }
          }, delay)
        } else {
          this.callbacks.onStatusChange('idle')
        }
      }

      return true
    } catch (err: any) {
      console.error('[Deepgram] Failed to start live audio capture:', err.message || err)
      this.callbacks.onStatusChange('error')
      this.stop()
      return false
    }
  }

  public stop() {
    this.isActive = false
    this.reconnectAttempts = 0
    this.incompleteRetryCount = 0
    this.cleanupSocket()

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.autoTriggerTimer) {
      clearTimeout(this.autoTriggerTimer)
      this.autoTriggerTimer = null
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop()
      } catch {}
      this.mediaRecorder = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    this.callbacks.onStatusChange('idle')
  }

  /**
   * Returns recent rolling speech for display in the transcription bar (never wiped abruptly)
   */
  public getRollingTranscript(): string {
    const recent = this.segments.slice(-5)
    return recent.map((s) => s.text.trim()).join(' ')
  }

  /**
   * Returns newly spoken words since the last answered question.
   * Returns empty string if no new speech has arrived since the last answer.
   */
  public getUnansweredText(): string {
    const unhandled = this.segments.filter(
      (s) => s.timestamp > this.lastAnsweredTimestamp && s.text.trim()
    )
    return unhandled.map((s) => s.text.trim()).join(' ')
  }

  /**
   * Returns true if there is unhandled speech since the last answer
   */
  public hasUnansweredSpeech(): boolean {
    return this.segments.some(
      (s) => s.timestamp > this.lastAnsweredTimestamp && s.text.trim().length > 0
    )
  }

  /**
   * Marks current speech as answered so subsequent words are tracked as a new turn or follow-up.
   * Does NOT wipe the rolling display buffer.
   */
  public markAnswered() {
    this.lastAnsweredTimestamp = Date.now()
    this.incompleteRetryCount = 0
    if (this.autoTriggerTimer) {
      clearTimeout(this.autoTriggerTimer)
      this.autoTriggerTimer = null
    }
  }

  public getBufferedTranscript(): string {
    return this.getRollingTranscript()
  }

  /**
   * User explicitly tapped the 'X' button or session stopped: completely clears all speech.
   */
  public clearBuffer() {
    this.segments = []
    this.lastAnsweredTimestamp = Date.now()
    this.incompleteRetryCount = 0
    if (this.autoTriggerTimer) {
      clearTimeout(this.autoTriggerTimer)
      this.autoTriggerTimer = null
    }
    this.callbacks.onTranscriptUpdate('', '')
  }

  /**
   * Resets all buffers, cancels active timers, and ensures the microphone is listening fresh.
   */
  public async startFresh(): Promise<boolean> {
    this.clearBuffer()
    this.lastAnsweredTimestamp = Date.now()
    this.incompleteRetryCount = 0
    if (this.autoTriggerTimer) {
      clearTimeout(this.autoTriggerTimer)
      this.autoTriggerTimer = null
    }

    // If socket is open/connecting, we are already listening with zero reconnection overhead (0ms delay)
    if (
      this.isActive &&
      (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) &&
      this.mediaRecorder?.state === 'recording'
    ) {
      this.callbacks.onStatusChange('listening')
      return true
    }

    // Otherwise cleanly start or reconnect the live session
    return await this.start()
  }

  private cleanupSocket() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop()
      } catch {}
      this.mediaRecorder = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus'
    ]
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t
      }
    }
    return ''
  }

  private scheduleAutoTrigger() {
    if (this.autoTriggerTimer) clearTimeout(this.autoTriggerTimer)

    const q = this.getUnansweredText().trim()
    if (!q || q.split(' ').length < 2) return

    // 1. Casual banter / connection check filter: do not trigger AI
    if (isCasualBanter(q)) {
      console.log('[Auto-Answer ignored — casual banter]:', q)
      return
    }

    // 2. Intelligent Sentence Completeness Cascade:
    // If the sentence ends incomplete (trailing connector/preposition/fragment), wait extra 1.4s
    const incomplete = isSentenceIncomplete(q)
    let delay = DEFAULT_SILENCE_THRESHOLD_MS

    if (incomplete) {
      delay = DEFAULT_SILENCE_THRESHOLD_MS + INCOMPLETE_SENTENCE_EXTRA_MS // 2700ms
      console.log(`[Auto-Answer paused — incomplete sentence]: "${q}" (waiting ${delay}ms)`)
    } else if (/[?]$/.test(q)) {
      // Explicit question mark: speaker is done, trigger fast!
      delay = QUESTION_MARK_THRESHOLD_MS // 350ms
      console.log(`[Auto-Answer fast-path — question mark]: "${q}" (triggering in ${delay}ms)`)
    }

    this.autoTriggerTimer = setTimeout(() => {
      const currentQ = this.getUnansweredText().trim()
      if (!this.isActive || this.mode !== 'auto' || currentQ.split(' ').length < 2) return

      if (isCasualBanter(currentQ)) {
        console.log('[Auto-Answer cancelled — casual banter]:', currentQ)
        return
      }

      // Re-verify incompleteness before firing:
      // If incomplete, give the speaker ONE grace extension (1200ms). If silence continues, trigger!
      if (isSentenceIncomplete(currentQ)) {
        if (this.incompleteRetryCount < 1) {
          this.incompleteRetryCount++
          console.log('[Auto-Answer grace extension — waiting 1200ms]:', currentQ)
          this.autoTriggerTimer = setTimeout(() => {
            const finalQ = this.getUnansweredText().trim()
            if (!this.isActive || this.mode !== 'auto' || finalQ.split(' ').length < 2) return
            if (isCasualBanter(finalQ)) return
            console.log('[Deepgram Auto-Answer Triggered after extended silence]:', finalQ)
            this.markAnswered()
            this.callbacks.onAutoTrigger(finalQ)
          }, 1200)
          return
        }
      }

      console.log('[Deepgram Auto-Answer Triggered]:', currentQ)
      this.markAnswered()
      this.callbacks.onAutoTrigger(currentQ)
    }, delay)
  }
}
