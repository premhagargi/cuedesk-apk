import { Language, ParsedAnswer } from '../types'

/**
 * Extracts only the pure function/class solution without runner or test invocations.
 * Looks for delimiter comments like `// --- Example Runner / Caller ---` or `// Example usage`
 */
export function extractFunctionOnly(code: string): string {
  if (!code) return ''

  // 1. Check for standard runner/caller comment delimiters
  const runnerMarker = /(?:\n\s*(?:\/\/|#|\/\*)\s*(?:---|===)?\s*(?:example runner|runner|caller|example usage|driver code|test cases?|example test|usage|main execution)\b.*$)|(?:\n\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:)/im
  const match = code.match(runnerMarker)
  if (match && typeof match.index === 'number') {
    return code.slice(0, match.index).trim()
  }

  // 2. Check for fallback runner headers like "// Example:", "// Test:"
  const fallbackMarker = /(?:\n\s*(?:\/\/|#)\s*(?:example|test|runner|driver):\s*$)/im
  const fbMatch = code.match(fallbackMarker)
  if (fbMatch && typeof fbMatch.index === 'number') {
    return code.slice(0, fbMatch.index).trim()
  }

  return code.trim()
}

/**
 * Parses streamed LLM markdown response into structured components:
 * 1. Spoken Approach Intro ("How I would approach it:" or Conversational Overview)
 * 2. Code Block (when present: concise, practical, or algorithmic)
 * 3. Function Only Code (without runner/caller, for LeetCode paste)
 * 4. Spoken Outro (explanation after code, real-world practical considerations)
 * 5. Complexity Breakdown (Time & Space - ONLY for DSA/algorithmic questions)
 * 6. Follow-ups ("Did the interviewer ask something else?")
 */
export function parseAnswer(rawText: string, defaultLang: Language = 'javascript'): ParsedAnswer {
  if (!rawText) {
    return {
      approach: '',
      code: '',
      codeFunctionOnly: '',
      outro: '',
      language: defaultLang,
      complexityTime: '',
      complexitySpace: '',
      followups: [],
      raw: ''
    }
  }

  // 1. Separate Follow-ups / Traps block if present ("Did the interviewer ask something else?")
  let cleanText = rawText
  const followups: string[] = []
  
  // Find the LAST occurrence of ---FOLLOWUPS--- or ---TRAPS--- to avoid matching early hallucinated markers
  const trapsMarker = /(?:\n\s*---FOLLOWUPS---|\n\s*---TRAPS---)/gi
  const allMatches = Array.from(rawText.matchAll(trapsMarker))
  const lastMatch = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null

  if (lastMatch && typeof lastMatch.index === 'number') {
    cleanText = rawText.slice(0, lastMatch.index).trim()
    const rawTraps = rawText.slice(lastMatch.index + lastMatch[0].length).trim()
    const trapLines = rawTraps.split('\n')
    for (const line of trapLines) {
      if (followups.length >= 4) break // Max 4 follow-ups

      let cleaned = line
        .replace(/^[\s*•\-\d.)[\]]+/, '')
        .replace(/^[<"']+|[>"']+$/g, '')
        .trim()
      
      if (!cleaned) continue
      // Safety guards: follow-up items must be conversational questions, never code snippets, brackets, or template placeholders
      if (
        cleaned.startsWith('```') ||
        cleaned.startsWith("'''") ||
        cleaned.includes('{') ||
        cleaned.includes('}') ||
        cleaned.includes(';') ||
        cleaned.includes('//') ||
        cleaned.includes('/*') ||
        cleaned.includes('#') ||
        cleaned.includes('function ') ||
        cleaned.includes('class ') ||
        cleaned.includes('const ') ||
        cleaned.includes('def ') ||
        cleaned.includes('return ') ||
        cleaned.includes('console.log') ||
        cleaned.length > 150 ||
        cleaned.length < 8
      ) {
        continue
      }

      const lower = cleaned.toLowerCase()
      if (
        lower === 'question1' ||
        lower === 'question2' ||
        lower === 'question3' ||
        lower.includes('realistic follow-up') ||
        lower.includes('interviewer ask something else')
      ) {
        continue
      }

      followups.push(cleaned)
    }
  }

  // 2. Find code block: ```typescript or ```javascript or ```python or just ```
  const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)(?:```|$)/i
  const match = cleanText.match(codeBlockRegex)

  let approach = ''
  let code = ''
  let detectedLang: Language = defaultLang
  let afterCode = ''

  if (match) {
    const codeStartIndex = match.index || 0
    approach = cleanText.slice(0, codeStartIndex).trim()
    const langTag = (match[1] || '').toLowerCase()
    if (langTag.includes('py')) {
      detectedLang = 'python'
    } else if (langTag.includes('js') || langTag.includes('javascript') || langTag.includes('ts') || langTag.includes('typescript')) {
      detectedLang = 'javascript'
    }
    code = match[2] || ''
    const codeEndIndex = codeStartIndex + match[0].length
    afterCode = cleanText.slice(codeEndIndex).trim()
  } else {
    // Pure conceptual or architectural answer (no code block)
    approach = cleanText.trim()
  }

  // Compute function-only version of the code
  const codeFunctionOnly = extractFunctionOnly(code)

  // 3. Multi-line Complexity & Spoken Outro parsing
  let outro = ''
  let complexityTime = ''
  let complexitySpace = ''

  if (afterCode) {
    const complexityMarker = /(?:[*#\s]*(?:complexity\s*breakdown|time\s*complexity|time[:\s*]))/i
    const compMatch = afterCode.match(complexityMarker)

    if (compMatch && typeof compMatch.index === 'number') {
      outro = afterCode.slice(0, compMatch.index).trim()
      const complexityText = afterCode.slice(compMatch.index)

      // Time complexity: match until Space Complexity or end
      const timeRegex = /(?:time\s*complexity|time)[*:\s]+([\s\S]*?)(?=(?:space\s*complexity|space)[*:\s]+|$)/i
      const timeMatch = complexityText.match(timeRegex)
      if (timeMatch) {
        complexityTime = timeMatch[1]
          .replace(/^[\s*•\-#:]+/, '')
          .replace(/[\s*•\-#:]+$/, '')
          .trim()
      }

      // Space complexity: match until subsequent headers or end
      const spaceRegex = /(?:space\s*complexity|space)[*:\s]+([\s\S]*?)(?=(?:naive|optimal|trade-off|note|complexity)[:\s*]|$)/i
      const spaceMatch = complexityText.match(spaceRegex)
      if (spaceMatch) {
        complexitySpace = spaceMatch[1]
          .replace(/^[\s*•\-#:]+/, '')
          .replace(/[\s*•\-#:]+$/, '')
          .trim()
      }
    } else {
      // Practical snippet without Big-O cards (e.g. NestJS endpoint / Angular fetch)
      outro = afterCode.trim()
    }
  }

  return {
    approach,
    code,
    codeFunctionOnly,
    outro,
    language: detectedLang,
    complexityTime,
    complexitySpace,
    followups,
    raw: rawText
  }
}
