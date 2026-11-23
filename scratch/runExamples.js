import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { buildSystemPrompt } from '../server/cerebrasService.js';

const apiKey = 'csk-54k8wf9fv3t4xh48x5xw2y8yv5h9wf9tpxwkhd9fw6p9fmkh';
const client = new Cerebras({ apiKey });

async function getAnswer(q, ctx = '') {
  const systemPrompt = buildSystemPrompt('javascript', ctx);
  const res = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: q }
    ],
    temperature: 0.25,
    max_tokens: 800
  });
  return res.choices[0].message.content.split('---FOLLOWUPS---')[0].trim();
}

async function run() {
  const questions = [
    { type: 'Type 1: Opinionated Question ("What is the best X?")', q: 'What is the best state management solution for React in 2026?' },
    { type: 'Type 2: Comparative Question ("X vs. Y" / "Differences")', q: 'What are the main differences between SQL and NoSQL databases?' },
    { type: 'Type 3: Behavioral / STAR Question ("Tell me about a time...")', q: 'Tell me about a time you resolved a major production outage.', ctx: 'Role: Senior Fullstack Engineer at Stripe. Tech Stack: Node.js, Redis, PostgreSQL.' },
    { type: 'Type 4: Single-Topic Conceptual Question', q: 'What is Context API in React, and when do we use it?' },
    { type: 'Type 5: Practical Code Implementation', q: 'Can you write a custom React hook for debouncing an input value?' },
    { type: 'Type 6: Algorithmic / Coding Puzzle', q: 'How would you solve the Two Sum problem?' }
  ];

  for (const item of questions) {
    console.log('\n### ' + item.type);
    console.log('**Question:** *"' + item.q + '"*');
    const ans = await getAnswer(item.q, item.ctx);
    console.log(ans);
  }
}

run().catch(console.error);
