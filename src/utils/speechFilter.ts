/**
 * Advanced Multi-Rule Sentence Incompleteness Detector
 * Prevents premature AI triggers when interviewers pause mid-sentence on connectors,
 * prepositions, articles, or auxiliary verbs.
 */
export function isSentenceIncomplete(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  // 1. Explicit final terminal punctuation: question mark, period, or exclamation means complete
  if (/[.?!]$/.test(trimmed)) return false

  // 2. Trailing mid-sentence punctuation: comma, dash, colon, ellipsis definitely means incomplete
  if (/[,\-:\u2014\u2026]$|\.\.\.$/.test(trimmed)) return true

  const textLower = trimmed.toLowerCase()
  const words = textLower.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false

  const lastWord = words[words.length - 1].replace(/[^a-z0-9]/g, '')

  // 3. Trailing incomplete connectors, prepositions, determiners & auxiliaries
  const trailingIncompleteWords = new Set([
    // Conjunctions & Connectors
    'and', 'or', 'but', 'so', 'because', 'if', 'when', 'while', 'after', 'before',
    'than', 'as', 'that', 'which', 'where', 'whose', 'whom', 'since', 'until', 'unless',
    'although', 'though', 'whereas', 'whether', 'however', 'also', 'plus',

    // Prepositions
    'of', 'to', 'in', 'on', 'at', 'for', 'from', 'with', 'about', 'between',
    'into', 'through', 'during', 'without', 'under', 'above', 'across', 'along',
    'around', 'behind', 'by', 'near', 'over', 'towards', 'upon', 'within',

    // Articles & Determiners
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
    'her', 'its', 'our', 'their', 'some', 'any', 'every', 'each', 'either', 'neither',

    // Pronouns when trailing without a verb
    'i', 'you', 'he', 'she', 'it', 'we', 'they',

    // Auxiliary & Modal Verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'can', 'could', 'would', 'should', 'shall', 'will', 'might', 'must',

    // Prompt Starters when trailing at the end
    'tell', 'explain', 'walk', 'like', 'such'
  ])

  if (trailingIncompleteWords.has(lastWord)) return true

  // 4. Short Fragment Heuristic: 1 single lone word is too ambiguous to trigger an answer
  if (words.length < 2) return true

  return false
}

/**
 * Casual Banter & Audio Check Filter
 * Prevents non-technical conversational chatter, audio checks, and pleasantries from triggering AI answers.
 * CRITICAL: Real technical questions (e.g. "How are you going to implement X?", "Can you write it?")
 * MUST NEVER be falsely classified as banter!
 */
export function isCasualBanter(text: string): boolean {
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return true

  const words = clean.split(' ')

  // 1. Single or double word filler acknowledgments
  const acknowledgments = new Set([
    'yes', 'yeah', 'yep', 'yup', 'no', 'nope',
    'ok', 'okay', 'sure', 'fine', 'cool', 'right',
    'got it', 'all right', 'alright', 'makes sense', 'sounds good',
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'thanks', 'thank you', 'welcome', 'great', 'awesome', 'perfect',
    'take your time', 'no problem', 'no worries', 'bye', 'goodbye',
    'hold on', 'one moment', 'one second', 'just a moment', 'give me a second',
    'let me see', 'lets see', 'are you there'
  ])

  if (acknowledgments.has(clean)) return true

  // If 1 or 2 words and not a known technical keyword (like "Big O", "Two Sum", "RAG", "Redux")
  const techShortTokens = new Set(['rag', 'redux', 'sql', 'nosql', 'big o', 'two sum', 'jwt', 'cors', 'rest', 'api'])
  if (words.length <= 2 && !techShortTokens.has(clean)) {
    if (words.every((w) => ['yeah', 'yes', 'ok', 'okay', 'sure', 'right', 'so', 'um', 'uh', 'hmm', 'ah'].includes(w))) {
      return true
    }
  }

  // 2. Audio & Video connection checks (EXACT PHRASES ONLY, never prefix match)
  const exactConnectionPhrases = new Set([
    'can you hear me',
    'can you hear me now',
    'am i audible',
    'are you audible',
    'i can hear you',
    'you are audible',
    'can you see my screen',
    'is my screen visible',
    'let me share my screen',
    'my screen is visible',
    'let me pull up your resume',
    'let me open the problem',
    'let me share the link',
    'i will share the link',
    'i pasted the link',
    'i pasted the question',
    'check the chat',
    'check the meeting chat',
    'nice to meet you',
    'pleasure to meet you',
    'great to meet you',
    'how are you doing today',
    'how are you today',
    'how are you',
    'how are you doing'
  ])

  if (exactConnectionPhrases.has(clean)) {
    return true
  }

  // Handle pleasantry with trailing name (e.g. "nice to meet you Prem", "hello everyone")
  if (/^(nice|pleasure|great) to meet you(\s+[a-z]+)?$/.test(clean)) {
    return true
  }
  if (/^how are you( doing| today)?(\s+[a-z]+)?$/.test(clean)) {
    return true
  }

  return false
}
