import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { streamAIResponse, convertCodeWithAI } from './cerebrasService.js'
import multer from 'multer'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })
const PORT = process.env.PORT || 3000
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

if (!CEREBRAS_API_KEY && !GROQ_API_KEY) {
  console.warn('⚠️ WARNING: Neither CEREBRAS_API_KEY nor GROQ_API_KEY is set in environment or .env file!')
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: CEREBRAS_API_KEY ? 'cerebras' : 'groq',
    defaultModel: 'gpt-oss-120b',
    hasCerebrasKey: Boolean(CEREBRAS_API_KEY),
    hasGroqKey: Boolean(GROQ_API_KEY),
    hasDeepgramKey: Boolean(process.env.DEEPGRAM_API_KEY)
  })
})

// Deepgram Live WebSocket token endpoint
app.get('/api/deepgram-token', (req, res) => {
  const deepgramKey = process.env.DEEPGRAM_API_KEY
  if (!deepgramKey) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY is not set on the server' })
  }
  res.json({ key: deepgramKey })
})

// SSE Streaming Question Answering endpoint (Cerebras gpt-oss-120b primary)
app.post('/api/chat', async (req, res) => {
  const { prompt, history = [], language = 'javascript', candidateContext = '' } = req.body

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  if (!CEREBRAS_API_KEY && !GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server AI API key (CEREBRAS_API_KEY or GROQ_API_KEY) is missing' })
  }

  // Setup SSE headers with buffering disabled for Vercel/proxies
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Content-Encoding', 'none')
  res.flushHeaders?.()

  const abortController = new AbortController()

  // Heartbeat comment every 2.5s prevents proxy/cellular socket dropouts
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n')
    }
  }, 2500)

  res.on('close', () => {
    clearInterval(heartbeat)
    if (!res.writableEnded) {
      abortController.abort()
    }
  })

  try {
    await streamAIResponse({
      prompt,
      history,
      language,
      candidateContext,
      signal: abortController.signal,
      onToken: (token) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ chunk: token })}\n\n`)
        }
      }
    })

    clearInterval(heartbeat)
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
      res.end()
    }
  } catch (error) {
    clearInterval(heartbeat)
    console.error('[API /api/chat Error]:', error.message || error)
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Error generating answer' })}\n\n`)
      res.end()
    }
  }
})

// Instant Code Translation / Conversion endpoint (JS <-> Python using Cerebras gpt-oss-120b)
app.post('/api/convert-code', async (req, res) => {
  const { code, targetLanguage, question } = req.body

  try {
    const convertedCode = await convertCodeWithAI({
      code,
      targetLanguage,
      question
    })

    res.json({ convertedCode, language: targetLanguage.toLowerCase() })
  } catch (error) {
    console.error('[API /api/convert-code Error]:', error.message || error)
    res.status(500).json({ error: error.message || 'Failed to convert code' })
  }
})

// High-Accuracy Groq Whisper Audio Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server GROQ_API_KEY is missing' })
  }

  try {
    const groq = new Groq({ apiKey })
    const file = new File([req.file.buffer], req.file.originalname || 'speech.webm', {
      type: req.file.mimetype || 'audio/webm'
    })

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'en',
      prompt: 'Technical software engineering interview question: JavaScript, Python, algorithms, data structures, LeetCode, HackerEarth, Big O notation, API, REST, SQL, NoSQL'
    })

    res.json({ text: transcription.text || '' })
  } catch (error) {
    console.error('[API /api/transcribe Error]:', error.message || error)
    res.status(500).json({ error: error.message || 'Failed to transcribe audio' })
  }
})

// Serve static assets in production with aggressive cache-busting for index.html
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
  }
}))

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(path.join(distPath, 'index.html'))
})

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CueDesk Web Server running at http://localhost:${PORT}`)
    console.log(`📱 LAN Mobile Access: http://<your-local-ip>:${PORT}`)
    console.log(`🧠 AI Engine: Cerebras gpt-oss-120b (Ultra-Fast Wafer-Scale Engine)\n`)
  })
}

export default app
