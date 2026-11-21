import dotenv from 'dotenv'
import { streamGroqResponse } from '../server/groqService.js'
import { parseAnswer } from '../server/answerParser.js'

dotenv.config()

const apiKey = process.env.GROQ_API_KEY

if (!apiKey) {
  console.error('❌ GROQ_API_KEY is not defined in environment.')
  process.exit(1)
}

console.log('========================================================================')
console.log('🚀 TOP-TIER INDIAN TECH & HACKEREARTH BENCHMARK SUITE (GOOGLE, ATLASSIAN, INTUIT, META, FRACTAL)')
console.log('========================================================================\n')

async function runTestSuite() {
  const tests = [
    {
      company: 'Google',
      topic: 'Linked List Reversal',
      prompt: 'Reverse a singly linked list in-place in JavaScript.',
      language: 'javascript',
      validators: [
        { name: 'Approach intro', fn: (p) => p.approach.toLowerCase().includes('how i would approach it') },
        { name: 'ListNode definition present', fn: (p) => p.code.includes('class ListNode') || p.code.includes('function ListNode') },
        { name: 'Explicit test input declaration', fn: (p) => p.code.includes('new ListNode') },
        { name: 'Caller line present', fn: (p) => p.code.includes('reverseList(') || p.code.includes('reverse(') },
        { name: 'No trivial .reverse() shortcut', fn: (p) => !p.code.includes('.reverse()') },
        { name: 'Spoken complexity with "Why"', fn: (p) => Boolean(p.complexityTime && p.complexitySpace) }
      ]
    },
    {
      company: 'Atlassian',
      topic: 'LRU Cache Design',
      prompt: 'Design an LRU Cache with O(1) get and put operations in JavaScript.',
      language: 'javascript',
      validators: [
        { name: 'Approach intro', fn: (p) => p.approach.toLowerCase().includes('how i would approach it') },
        { name: 'Class structure with get & put', fn: (p) => p.code.includes('get(') && p.code.includes('put(') },
        { name: 'Sample test invocations declared', fn: (p) => p.code.includes('.put(') && p.code.includes('.get(') },
        { name: 'Spoken complexity with "Why"', fn: (p) => Boolean(p.complexityTime || p.raw.toLowerCase().includes('o(1)')) }
      ]
    },
    {
      company: 'Intuit',
      topic: 'Subarray Sum Equals K',
      prompt: 'Find the total number of continuous subarrays whose sum equals k in Python.',
      language: 'python',
      validators: [
        { name: 'Approach intro', fn: (p) => p.approach.toLowerCase().includes('how i would approach it') },
        { name: 'Prefix sum hash map logic', fn: (p) => p.code.includes('dict') || p.code.includes('{') || p.code.includes('prefix') || p.code.includes('count') },
        { name: 'Test input array declared', fn: (p) => p.code.includes('[') && p.code.includes(']') },
        { name: 'Caller line present', fn: (p) => p.code.includes('(') && p.code.includes(')') },
        { name: 'Spoken complexity with "Why"', fn: (p) => Boolean(p.complexityTime && p.complexitySpace) }
      ]
    },
    {
      company: 'Meta',
      topic: 'Valid Palindrome II (at most 1 deletion)',
      prompt: 'Check if a string can be a palindrome after deleting at most one character in JavaScript.',
      language: 'javascript',
      validators: [
        { name: 'Approach intro', fn: (p) => p.approach.toLowerCase().includes('how i would approach it') },
        { name: 'Two pointers from first principles (no [::-1] or .reverse())', fn: (p) => !p.code.includes('.reverse()') && !p.code.includes('[::-1]') },
        { name: 'Test input strings declared', fn: (p) => p.code.includes('console.log(') || p.code.includes('"') },
        { name: 'Spoken complexity with "Why"', fn: (p) => Boolean(p.complexityTime) }
      ]
    },
    {
      company: 'Fractal Analytics',
      topic: 'Trapping Rain Water',
      prompt: 'Solve Trapping Rain Water problem in Python with optimal O(1) space.',
      language: 'python',
      validators: [
        { name: 'Approach intro', fn: (p) => p.approach.toLowerCase().includes('how i would approach it') },
        { name: 'Two pointers implementation', fn: (p) => p.code.includes('left') && p.code.includes('right') },
        { name: 'Test input elevation map declared', fn: (p) => p.code.includes('[') && p.code.includes(']') },
        { name: 'O(1) space explained', fn: (p) => p.raw.toLowerCase().includes('o(1)') || p.complexitySpace.includes('O(1)') }
      ]
    }
  ]

  let overallPassed = 0
  let overallFailed = 0

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]
    console.log(`\n------------------------------------------------------------------------`)
    console.log(`📌 Test ${i + 1}/${tests.length} [${test.company}]: ${test.topic}`)
    console.log(`------------------------------------------------------------------------`)

    let fullRaw = ''
    const tStart = Date.now()
    let firstToken = 0

    try {
      await streamGroqResponse({
        apiKey,
        prompt: test.prompt,
        language: test.language,
        onToken: (chunk) => {
          if (!firstToken) firstToken = Date.now() - tStart
          fullRaw += chunk
        }
      })

      const duration = Date.now() - tStart
      console.log(`⏱️ Latency to first token: ${firstToken}ms | Total generation: ${duration}ms`)

      const parsed = parseAnswer(fullRaw, test.language)

      let testSuccess = true
      for (const val of test.validators) {
        const ok = val.fn(parsed)
        console.log(`   ${ok ? '✓' : '✗'} ${val.name}: ${ok ? 'PASS' : 'FAIL'}`)
        if (!ok) testSuccess = false
      }

      if (testSuccess) {
        console.log(`✅ [${test.company}] PASSED all checks!`)
        overallPassed++
      } else {
        console.log(`⚠️ [${test.company}] Some checks failed.`)
        overallFailed++
      }
    } catch (err) {
      console.error(`❌ [${test.company}] Error:`, err.message || err)
      overallFailed++
    }
  }

  console.log('\n========================================================================')
  console.log(`🏆 BENCHMARK RESULTS: ${overallPassed}/${tests.length} Companies Passed (${overallFailed} Failed)`)
  console.log('========================================================================\n')

  if (overallFailed > 0) {
    process.exit(1)
  }
}

runTestSuite()
