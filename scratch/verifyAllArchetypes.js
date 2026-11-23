import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { buildSystemPrompt } from '../server/cerebrasService.js';

const apiKey = 'csk-54k8wf9fv3t4xh48x5xw2y8yv5h9wf9tpxwkhd9fw6p9fmkh';
const client = new Cerebras({ apiKey });

async function ask(prompt, candidateContext = '', history = []) {
  const systemPrompt = buildSystemPrompt('javascript', candidateContext);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages,
    temperature: 0.3,
    max_tokens: 800
  });

  return response.choices[0].message.content;
}

function checkFormatting(text, maxWords, label) {
  const clean = text.split('---FOLLOWUPS---')[0].trim();
  const words = clean.split(/\s+/).length;
  const hasBullets = /^[\s]*[-*•]\s+/m.test(clean);
  const hasHeaders = /^###?\s+/m.test(clean);
  const paragraphs = clean.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  console.log(`\n--- ${label} ---`);
  console.log(clean);
  console.log(`\n[Checks]: Word Count: ${words}/${maxWords} | Has Bullets: ${hasBullets} | Has Headers: ${hasHeaders} | Paragraphs: ${paragraphs.length}`);
  
  const pass = words <= maxWords && !hasBullets && !hasHeaders && paragraphs.length >= 2;
  console.log(`[Result]: ${pass ? 'PASS' : 'WARN'}`);
  return pass;
}

async function run() {
  // Test 1: Opinionated
  const ans1 = await ask('What is the best frontend framework in 2026?');
  checkFormatting(ans1, 125, 'TEST 1: "What is the best frontend framework in 2026?" (Opinionated)');

  // Test 2: Comparative
  const history = [
    { role: 'user', content: 'We are deciding between Angular and React.' },
    { role: 'assistant', content: 'Both Angular and React are widely used across modern engineering teams.' }
  ];
  const ans2 = await ask('What are the main differences between them?', '', history);
  checkFormatting(ans2, 125, 'TEST 2: "What are the main differences between them?" (Comparative)');

  // Test 3: Behavioral
  const ans3 = await ask('Tell me about a time you resolved a major production incident.', 'Target Role: Senior Fullstack Engineer at Stripe. Tech Stack: Node.js, Redis, PostgreSQL.');
  checkFormatting(ans3, 185, 'TEST 3: "Tell me about a time you resolved a major production incident" (Behavioral)');
}

run().catch(console.error);
