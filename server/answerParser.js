/**
 * Parses streamed LLM markdown response into structured components:
 * 1. Spoken Approach Intro ("How I would approach it:")
 * 2. Code Block
 * 3. Spoken Complexity Breakdown & Why (Time & Space)
 */
export function parseAnswer(rawText, defaultLang = 'javascript') {
  if (!rawText) {
    return {
      approach: '',
      code: '',
      language: defaultLang,
      complexityTime: '',
      complexitySpace: '',
      raw: ''
    }
  }

  // Find code block: ```javascript or ```python or just ```
  const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)(?:```|$)/i
  const match = rawText.match(codeBlockRegex)

  let approach = ''
  let code = ''
  let detectedLang = defaultLang
  let afterCode = ''

  if (match) {
    const codeStartIndex = match.index || 0
    approach = rawText.slice(0, codeStartIndex).trim()
    const langTag = (match[1] || '').toLowerCase()
    if (langTag.includes('py')) {
      detectedLang = 'python'
    } else if (langTag.includes('js') || langTag.includes('javascript') || langTag.includes('ts')) {
      detectedLang = 'javascript'
    }
    code = match[2] || ''
    const codeEndIndex = codeStartIndex + match[0].length
    afterCode = rawText.slice(codeEndIndex).trim()
  } else {
    approach = rawText.trim()
  }

  let complexityTime = ''
  let complexitySpace = ''

  const timeMatch = afterCode.match(/(?:time\s*complexity|time)[:\s*]+([^\n\r]+)/i)
  if (timeMatch) {
    complexityTime = timeMatch[1].replace(/^[*-•\s]+/, '').trim()
  }

  const spaceMatch = afterCode.match(/(?:space\s*complexity|space)[:\s*]+([^\n\r]+)/i)
  if (spaceMatch) {
    complexitySpace = spaceMatch[1].replace(/^[*-•\s]+/, '').trim()
  }

  return {
    approach,
    code,
    language: detectedLang,
    complexityTime,
    complexitySpace,
    raw: rawText
  }
}
