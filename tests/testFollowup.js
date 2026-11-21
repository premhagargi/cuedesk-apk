import dotenv from 'dotenv'
import { streamGroqResponse } from '../server/groqService.js'
import { parseAnswer } from '../server/answerParser.js'

dotenv.config()

const apiKey = process.env.GROQ_API_KEY

async function testFollowup() {
  console.log('Testing exact scenario: Turn 1 Reverse Linked List -> Turn 2 "Can you write it in Python?"')

  // Turn 1
  let turn1Answer = ''
  await streamGroqResponse({
    apiKey,
    prompt: 'How to reverse linked list?',
    language: 'javascript',
    onToken: t => turn1Answer += t
  })

  console.log('✓ Turn 1 answered successfully')

  // Turn 2: Follow-up
  const history = [
    { role: 'user', content: 'How to reverse linked list?' },
    { role: 'assistant', content: turn1Answer }
  ]

  let turn2Answer = ''
  await streamGroqResponse({
    apiKey,
    prompt: 'Can you write it in Python?',
    history,
    language: 'python',
    onToken: t => turn2Answer += t
  })

  console.log('\n--- Turn 2 Response ---')
  console.log(turn2Answer.slice(0, 300) + '...')

  const parsed = parseAnswer(turn2Answer, 'python')
  const isPython = parsed.code.includes('def ') || parsed.code.includes('ListNode')
  const asksWhichProblem = turn2Answer.toLowerCase().includes('which problem') || turn2Answer.toLowerCase().includes('let me know')

  console.log('✓ Generated Python code:', isPython)
  console.log('✓ Did NOT ask "Which problem":', !asksWhichProblem)

  if (isPython && !asksWhichProblem) {
    console.log('✅ Follow-up verification PASSED!')
    process.exit(0)
  } else {
    console.log('❌ Follow-up verification FAILED!')
    process.exit(1)
  }
}

testFollowup()
