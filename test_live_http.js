import http from 'http';

function postSSE(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(payload);
    const startTime = Date.now();
    let ttft = null;
    let fullText = '';
    let isDone = false;

    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                if (ttft === null) {
                  ttft = Date.now() - startTime;
                }
                fullText += data.chunk;
              }
              if (data.done) {
                isDone = true;
              }
              if (data.error) {
                reject(new Error(data.error));
              }
            } catch (e) {}
          }
        }
      });

      res.on('end', () => {
        const totalDuration = Date.now() - startTime;
        resolve({ fullText, ttft, totalDuration, isDone });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function getJSON(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function parseAnswer(rawText) {
  let cleanText = rawText || '';
  const followups = [];
  const trapsMarker = /(?:---FOLLOWUPS---|---TRAPS---|### Anticipated Follow-ups|Anticipated Traps:|Did the interviewer ask something else\??)/i;
  const trapsMatch = rawText.match(trapsMarker);
  if (trapsMatch && typeof trapsMatch.index === 'number') {
    cleanText = rawText.slice(0, trapsMatch.index).trim();
    const rawTraps = rawText.slice(trapsMatch.index + trapsMatch[0].length).trim();
    const trapLines = rawTraps.split('\n');
    for (const line of trapLines) {
      let cleaned = line.replace(/^[\s*•\-\d.)[\]]+/, '').replace(/\]$/, '').trim();
      if (cleaned.length > 5) followups.push(cleaned);
    }
  }

  const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)(?:```|$)/i;
  const match = cleanText.match(codeBlockRegex);
  let approach = '';
  let code = '';
  let afterCode = '';

  if (match) {
    approach = cleanText.slice(0, match.index).trim();
    code = match[2] || '';
    afterCode = cleanText.slice(match.index + match[0].length).trim();
  } else {
    approach = cleanText.trim();
  }

  let outro = '';
  let complexityTime = '';
  let complexitySpace = '';
  if (afterCode) {
    const complexityMarker = /(?:[*#\s]*(?:complexity\s*breakdown|time\s*complexity|time[:\s*]))/i;
    const compMatch = afterCode.match(complexityMarker);
    if (compMatch && typeof compMatch.index === 'number') {
      outro = afterCode.slice(0, compMatch.index).trim();
      const complexityText = afterCode.slice(compMatch.index);
      const timeRegex = /(?:time\s*complexity|time)[*:\s]+([\s\S]*?)(?=(?:space\s*complexity|space)[*:\s]+|$)/i;
      const timeMatch = complexityText.match(timeRegex);
      if (timeMatch) complexityTime = timeMatch[1].replace(/^[\s*•\-#:]+/, '').replace(/[\s*•\-#:]+$/, '').trim();
      const spaceRegex = /(?:space\s*complexity|space)[*:\s]+([\s\S]*?)(?=(?:naive|optimal|trade-off|note|complexity)[:\s*]|$)/i;
      const spaceMatch = complexityText.match(spaceRegex);
      if (spaceMatch) complexitySpace = spaceMatch[1].replace(/^[\s*•\-#:]+/, '').replace(/[\s*•\-#:]+$/, '').trim();
    } else {
      outro = afterCode.trim();
    }
  }

  return { approach, code, outro, complexityTime, complexitySpace, followups };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 CUEDESK WEB: LIVE HTTP & REAL CEREBRAS GPT-OSS-120B TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // 1. Health Endpoint Test
  console.log('--- TEST 1: GET /api/health ---');
  try {
    const health = await getJSON('http://127.0.0.1:3000/api/health');
    assert(health.status === 200, `Status is 200 (received ${health.status})`);
    assert(health.body.hasCerebrasKey === true, 'Cerebras API Key is loaded on server');
    assert(health.body.provider === 'cerebras', `AI Provider is cerebras`);
    assert(health.body.defaultModel === 'gpt-oss-120b', `Default model is gpt-oss-120b`);
  } catch (err) {
    assert(false, `Health check failed: ${err.message}`);
  }

  // 2. Real Groq Conceptual Question Test
  console.log('\n--- TEST 2: POST /api/chat (Conceptual: "What is Angular, and how does it work?") ---');
  try {
    const res = await postSSE('http://127.0.0.1:3000/api/chat', {
      prompt: 'What is Angular, and how does it work?',
      history: [],
      language: 'javascript'
    });
    console.log(`  ⏱️ Latency: TTFT = ${res.ttft}ms | Total = ${(res.totalDuration/1000).toFixed(2)}s`);
    assert(res.isDone === true, 'Stream completed with done signal');
    assert(res.fullText.length > 200, `Response length is substantial (${res.fullText.length} chars)`);

    const parsed = parseAnswer(res.fullText);
    assert(parsed.code === '', `No code block emitted for conceptual question (Length: ${parsed.code.length})`);
    assert(parsed.complexityTime === '' && parsed.complexitySpace === '', 'No Big-O complexity emitted for conceptual question');
    assert(parsed.followups.length >= 2, `Follow-up questions emitted (${parsed.followups.length} found)`);
    console.log('  Follow-ups:', parsed.followups.slice(0, 3));
  } catch (err) {
    assert(false, `Conceptual test failed: ${err.message}`);
  }

  // 3. Real Groq Practical Implementation Snippet Test
  console.log('\n--- TEST 3: POST /api/chat (Practical Code: "Can you write a simple REST API endpoint using NestJS?") ---');
  try {
    const res = await postSSE('http://127.0.0.1:3000/api/chat', {
      prompt: 'Can you write a simple REST API endpoint using NestJS?',
      history: [],
      language: 'javascript'
    });
    console.log(`  ⏱️ Latency: TTFT = ${res.ttft}ms | Total = ${(res.totalDuration/1000).toFixed(2)}s`);
    assert(res.isDone === true, 'Stream completed with done signal');

    const parsed = parseAnswer(res.fullText);
    assert(parsed.code.length > 50, `Code block emitted (Length: ${parsed.code.length} chars)`);
    assert(parsed.approach.length > 20, 'Spoken intro present before code');
    assert(parsed.outro.length > 20, 'Spoken outro present after code');
    assert(parsed.complexityTime === '' && parsed.complexitySpace === '', 'No Big-O cards emitted for practical REST endpoint');
    assert(parsed.followups.length >= 2, `Follow-ups emitted (${parsed.followups.length} found)`);
  } catch (err) {
    assert(false, `Practical test failed: ${err.message}`);
  }

  // 4. Real Groq Crisp Algorithmic / DSA Test (Code appears immediately without dense text walls)
  console.log('\n--- TEST 4: POST /api/chat (Crisp DSA: "Two Sum problem") ---');
  try {
    const res = await postSSE('http://127.0.0.1:3000/api/chat', {
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      history: [],
      language: 'javascript'
    });
    console.log(`  ⏱️ Latency: TTFT = ${res.ttft}ms | Total = ${(res.totalDuration/1000).toFixed(2)}s`);
    assert(res.isDone === true, 'Stream completed with done signal');

    const parsed = parseAnswer(res.fullText);
    assert(parsed.approach.length < 600, `Approach is crisp and concise (${parsed.approach.length} chars, no scrolling past walls of text)`);
    assert(parsed.code.length > 50, `Optimal algorithm code emitted immediately next (${parsed.code.length} chars)`);
    assert(parsed.complexityTime.length > 5, `Time complexity present: ${parsed.complexityTime.slice(0, 40)}...`);
    assert(parsed.complexitySpace.length > 5, `Space complexity present: ${parsed.complexitySpace.slice(0, 40)}...`);
    assert(parsed.followups.length >= 2, `DSA follow-ups present (${parsed.followups.length} found)`);
  } catch (err) {
    assert(false, `DSA test failed: ${err.message}`);
  }

  // 5. Quick Action: "Explain code step by step"
  console.log('\n--- TEST 5: POST /api/chat (Quick Action: "Explain code step by step in simple spoken English") ---');
  try {
    const res = await postSSE('http://127.0.0.1:3000/api/chat', {
      prompt: 'Explain how this code works step by step in simple spoken English for: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      history: [],
      language: 'javascript'
    });
    console.log(`  ⏱️ Latency: TTFT = ${res.ttft}ms | Total = ${(res.totalDuration/1000).toFixed(2)}s`);
    assert(res.isDone === true, 'Stream completed with done signal');

    const parsed = parseAnswer(res.fullText);
    assert(parsed.code === '', 'Zero code blocks emitted (pure spoken explanation)');
    assert(parsed.approach.length > 150, `Substantial spoken explanation generated (${parsed.approach.length} chars)`);
    assert(parsed.approach.includes('First') || parsed.approach.includes('step') || parsed.approach.includes('loop'), 'Contains step-by-step logic');
  } catch (err) {
    assert(false, `Explain code test failed: ${err.message}`);
  }

  // 6. Quick Action: "Naive approach"
  console.log('\n--- TEST 6: POST /api/chat (Quick Action: "Show naive / brute force approach") ---');
  try {
    const res = await postSSE('http://127.0.0.1:3000/api/chat', {
      prompt: 'Show the naive / brute force approach and code for: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      history: [],
      language: 'javascript'
    });
    console.log(`  ⏱️ Latency: TTFT = ${res.ttft}ms | Total = ${(res.totalDuration/1000).toFixed(2)}s`);
    assert(res.isDone === true, 'Stream completed with done signal');

    const parsed = parseAnswer(res.fullText);
    assert(parsed.code.length > 50, `Brute-force code emitted (${parsed.code.length} chars)`);
    assert(res.fullText.toLowerCase().includes('o(n²)') || res.fullText.toLowerCase().includes('o(n^2)') || res.fullText.toLowerCase().includes('nested') || res.fullText.toLowerCase().includes('quadratic'), 'Explains O(N²) quadratic time');
  } catch (err) {
    assert(false, `Naive test failed: ${err.message}`);
  }

  // 7. Code Translation / Conversion Test
  console.log('\n--- TEST 7: POST /api/convert-code (JavaScript -> Python) ---');
  try {
    const jsCode = `function reverseList(head) {\n  let prev = null, curr = head;\n  while (curr) {\n    let next = curr.next;\n    curr.next = prev;\n    prev = curr;\n    curr = next;\n  }\n  return prev;\n}`;
    const conv = await postJSON('http://127.0.0.1:3000/api/convert-code', {
      code: jsCode,
      targetLanguage: 'python',
      question: 'Reverse a singly linked list'
    });
    assert(conv.status === 200, `Status is 200 (received ${conv.status})`);
    assert(conv.body.language === 'python', 'Target language confirmed python');
    assert(conv.body.convertedCode.includes('def reverse') || conv.body.convertedCode.includes('prev'), 'Converted to Python syntax');
  } catch (err) {
    assert(false, `Convert code test failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`🎯 TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite();
