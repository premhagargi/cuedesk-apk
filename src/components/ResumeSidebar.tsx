import React, { useState, useEffect } from 'react'
import { X, User, Briefcase, Code, Sparkles, Check } from 'lucide-react'

interface ResumeSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSaveContext: (context: string) => void
}

export const ResumeSidebar: React.FC<ResumeSidebarProps> = ({
  isOpen,
  onClose,
  onSaveContext
}) => {
  const [role, setRole] = useState('')
  const [techStack, setTechStack] = useState('')
  const [projects, setProjects] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cuedesk_resume_data')
      if (saved) {
        const parsed = JSON.parse(saved)
        setRole(parsed.role || '')
        setTechStack(parsed.techStack || '')
        setProjects(parsed.projects || '')
      }
    } catch (e) {
      console.warn('Failed to load resume context from localStorage:', e)
    }
  }, [])

  // Compile full context string whenever fields change
  const buildContextString = (r: string, ts: string, p: string) => {
    const parts: string[] = []
    if (r.trim()) parts.push(`Target Role / Experience: ${r.trim()}`)
    if (ts.trim()) parts.push(`Primary Tech Stack: ${ts.trim()}`)
    if (p.trim()) parts.push(`Key Projects, Challenges & Architecture:\n${p.trim()}`)
    return parts.join('\n\n')
  }

  // Auto-save whenever fields change so closing sidebar never loses context
  useEffect(() => {
    const compiled = buildContextString(role, techStack, projects)
    try {
      localStorage.setItem(
        'cuedesk_resume_data',
        JSON.stringify({ role, techStack, projects })
      )
      localStorage.setItem('cuedesk_resume_context', compiled)
    } catch {}

    onSaveContext(compiled)
  }, [role, techStack, projects])

  const handleSave = () => {
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <aside className="relative w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl z-10 text-slate-900">
        {/* Header */}
        <div className="h-12 sm:h-14 px-4 border-b border-slate-200 flex items-center justify-between pt-1 sm:pt-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-sm sm:text-base tracking-tight text-slate-900">
              Candidate Resume Grounding
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-3 mx-4 mt-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
          <span>
            Grounds behavioral questions (<em>"Have you worked on this?"</em>, <em>"Tell me about a challenging project"</em>) in your real background instead of fictional stories.
          </span>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs font-sans">
          {/* Target Role & Seniority */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              Target Role & Experience
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend / Full-Stack Engineer (4 years exp)"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          {/* Primary Tech Stack */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-slate-400" />
              Primary Tech Stack & Tools
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g. React, TypeScript, Next.js, Node.js, Angular, Python, AWS, Docker"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          {/* Key Projects & Experience Details */}
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Projects, Challenges & Architecture (Paste Resume Highlights)
            </label>
            <textarea
              rows={9}
              value={projects}
              onChange={(e) => setProjects(e.target.value)}
              placeholder={`e.g.
• Built a semantic search platform using RAG with OpenAI embeddings, Pinecone, and LangChain. Handled 500k documents with <200ms latency.
• Architected high-throughput payment webhook processor in Node.js & Redis Streams with idempotency keys.
• Solved frontend memory leak in Angular by converting to OnPush change detection and unsubscribing RxJS subscriptions.`}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 leading-relaxed font-mono focus:bg-white focus:outline-none focus:border-indigo-600 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer with Save / Done button */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {savedNotice ? (
              <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Saved to browser
              </span>
            ) : (
              'Auto-grounded in chat'
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-xs"
            >
              Save Grounding
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
