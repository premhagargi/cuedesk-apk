import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { buildSystemPrompt } from '../server/cerebrasService.js';

const apiKey = 'csk-54k8wf9fv3t4xh48x5xw2y8yv5h9wf9tpxwkhd9fw6p9fmkh';
const client = new Cerebras({ apiKey });

function compactHistory(history = []) {
  if (!history || history.length === 0) return [];
  const recent = history.slice(-4);
  return recent.map((msg) => {
    if (msg.role === 'assistant') {
      const stripped = (msg.content || '')
        .replace(/```[\s\S]*?```/g, '[code snippet omitted for context]')
        .trim();
      return {
        role: 'assistant',
        content: stripped.length > 450 ? stripped.slice(0, 450) + '... [prior answer]' : stripped
      };
    }
    return {
      role: 'user',
      content: (msg.content || '').slice(0, 250)
    };
  });
}

async function askWithHistory(history, newQuestion) {
  const systemPrompt = buildSystemPrompt('javascript', '');
  const compacted = compactHistory(history);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...compacted,
    { role: 'user', content: newQuestion }
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages,
    temperature: 0.3,
    max_tokens: 800
  });

  return response.choices[0].message.content;
}

async function testConversation(label, turn1Question, turn2Question, expectedKeyword) {
  console.log(`\n======================================================`);
  console.log(`TEST: ${label}`);
  console.log(`======================================================`);

  console.log(`[Turn 1 User]: "${turn1Question}"`);
  const turn1Answer = await askWithHistory([], turn1Question);
  console.log(`[Turn 1 Assistant Snippet]: ${turn1Answer.slice(0, 150).replace(/\n/g, ' ')}...`);

  const history = [
    { role: 'user', content: turn1Question },
    { role: 'assistant', content: turn1Answer }
  ];

  console.log(`\n[Turn 2 User Follow-up with Pronoun]: "${turn2Question}"`);
  const turn2Answer = await askWithHistory(history, turn2Question);
  console.log(`[Turn 2 Assistant Full Answer]:\n${turn2Answer.split('---FOLLOWUPS---')[0].trim()}`);

  const passed = turn2Answer.toLowerCase().includes(expectedKeyword.toLowerCase());
  console.log(`\n--> Topic Preserved? [${passed ? 'PASS' : 'FAIL'}] (Matched expected: "${expectedKeyword}")`);
  return passed;
}

async function run() {
  const results = [];

  // Scenario 1: Exact issue from screenshot 1
  results.push(await testConversation(
    'Scenario 1: React Context API -> "When do we use it?"',
    'What is context API in React?',
    'When do we use it?',
    'context'
  ));

  // Scenario 2: Exact issue from screenshot 2
  results.push(await testConversation(
    'Scenario 2: JavaScript Promises -> "How does it work?"',
    'What are promises in JavaScript?',
    'How does it work?',
    'promise'
  ));

  // Scenario 3: Debounce -> "Can you write the code for that?"
  results.push(await testConversation(
    'Scenario 3: Debounce -> "Can you write the code for that?"',
    'Can you explain debounce in JavaScript?',
    'Can you write the code for that?',
    'debounce'
  ));

  const allPassed = results.every(r => r === true);
  console.log(`\n======================================================`);
  console.log(`OVERALL CONTEXT PRESERVATION RESULT: ${allPassed ? '100% SPOT ON (ALL TESTS PASSED)' : 'SOME FAILED'}`);
  console.log(`======================================================`);
}

run().catch(console.error);
