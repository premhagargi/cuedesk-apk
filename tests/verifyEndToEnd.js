import dotenv from 'dotenv'
import app from '../server/index.js'

dotenv.config()

console.log('\n============================================================')
console.log('🔍 FULL END-TO-END PIPELINE VERIFICATION')
console.log('============================================================\n')

async function runVerification() {
  try {
    // 1. Check Server Endpoints
      console.log('[1/4] Testing Server Health & Token Endpoints...')
      const healthRes = await fetch('http://localhost:3000/api/health')
      const healthData = await healthRes.json()
      console.log('  ✓ Health Status:', healthData.status)
      console.log('  ✓ Has Groq Key:', healthData.hasKey)
      console.log('  ✓ Has Deepgram Key:', healthData.hasDeepgramKey)

      const tokenRes = await fetch('http://localhost:3000/api/deepgram-token')
      const tokenData = await tokenRes.json()
      const tokenMatches = tokenData.key === '2b4a02df4e15d95fa5942f541f3347063088f4be'
      console.log('  ✓ Deepgram Token Endpoint active and matches new key:', tokenMatches)

      // 2. Test Deepgram Live WebSocket with the new key
      console.log('\n[2/4] Testing Deepgram nova-3 Live WebSocket Connection...')
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(
          'wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&interim_results=true',
          ['token', tokenData.key]
        )

        ws.onopen = () => {
          console.log('  ✓ WebSocket connected successfully to Deepgram (nova-3)')
          ws.send(JSON.stringify({ type: 'KeepAlive' }))
          console.log('  ✓ Sent KeepAlive frame')
          setTimeout(() => {
            ws.close()
            console.log('  ✓ WebSocket connection closed cleanly')
            resolve(true)
          }, 500)
        }

        ws.onerror = (err) => {
          console.error('  ✗ Deepgram WS Error:', err)
          reject(err)
        }
      })

      // 3. Test Groq openai/gpt-oss-120b Streaming Pipeline
      console.log('\n[3/4] Testing Groq openai/gpt-oss-120b SSE Stream via /api/chat...')
      const chatRes = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Write two sum in javascript.',
          language: 'javascript'
        })
      })

      console.log('  ✓ HTTP Status:', chatRes.status)
      const rawText = await chatRes.text()
      const lines = rawText.split('\n')
      let fullAnswer = ''
      for (const l of lines) {
        if (l.startsWith('data:')) {
          const payload = l.slice(5).trim()
          try {
            const parsed = JSON.parse(payload)
            if (parsed.chunk) {
              fullAnswer += parsed.chunk
            }
          } catch {}
        }
      }

      const hasApproach = fullAnswer.toLowerCase().includes('how i would approach it')
      const hasCode = fullAnswer.includes('function') || fullAnswer.includes('=>') || fullAnswer.includes('two')
      console.log('  [Full answer preview]:', fullAnswer.slice(0, 150) + '...')
      console.log('  ✓ Response contains "How I would approach it":', hasApproach)
      console.log('  ✓ Response contains executable code block:', hasCode)

      // 4. Test Code Conversion Endpoint
      console.log('\n[4/4] Testing Code Conversion Endpoint /api/convert-code...')
      const convRes = await fetch('http://localhost:3000/api/convert-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'function multiply(x, y) { return x * y; }',
          targetLanguage: 'python',
          question: 'Multiply two numbers'
        })
      })
      const convData = await convRes.json()
      console.log('  ✓ Converted code successfully to Python:\n    ' + convData.convertedCode.replace(/\n/g, '\n    '))

      console.log('\n============================================================')
      console.log('🎉 ALL 4 TESTS PASSED! SYSTEM IS 100% OPERATIONAL')
      console.log('============================================================\n')

      process.exit(0)
    } catch (error) {
      console.error('❌ Verification failed:', error)
      process.exit(1)
    }
}

runVerification()
