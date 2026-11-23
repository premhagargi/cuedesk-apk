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

async function run() {
  console.log('========================================================');
  console.log('TEST 1: "What are the main differences between them?"');
  console.log('========================================================');
  const history = [
    { role: 'user', content: 'We are deciding between Angular and React.' },
    { role: 'assistant', content: 'Angular and React are the two dominant web client technologies.' }
  ];
  const ans1 = await ask('What are the main differences between them?', '', history);
  console.log(ans1.split('---FOLLOWUPS---')[0].trim());
  const words1 = ans1.split('---FOLLOWUPS---')[0].trim().split(/\s+/).length;
  console.log(`Word count: ${words1}`);
  console.log('Contains "I pick Angular"?', ans1.includes('I pick Angular'));

  console.log('\n========================================================');
  console.log('TEST 2: "What is the best frontend framework in 2026?" (Opinionated)');
  console.log('========================================================');
  const ans2 = await ask('What is the best frontend framework in 2026?');
  console.log(ans2.split('---FOLLOWUPS---')[0].trim());
  const words2 = ans2.split('---FOLLOWUPS---')[0].trim().split(/\s+/).length;
  console.log(`Word count: ${words2}`);
  console.log('Starts with firm stance (Sentence 1)?', !ans2.toLowerCase().startsWith('it depends'));

  console.log('\n========================================================');
  console.log('TEST 3: "Tell me about a time you resolved a major production incident" (STAR)');
  console.log('========================================================');
  const ans3 = await ask('Tell me about a time you resolved a critical production latency incident.', 'Target Role: Staff Software Engineer at Stripe. Tech Stack: Node.js, Redis, PostgreSQL.');
  console.log(ans3.split('---FOLLOWUPS---')[0].trim());
  const words3 = ans3.split('---FOLLOWUPS---')[0].trim().split(/\s+/).length;
  console.log(`Word count: ${words3}`);
}

run().catch(console.error);
