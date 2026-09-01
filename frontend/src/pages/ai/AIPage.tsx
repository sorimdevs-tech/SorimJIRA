import { useState, useEffect } from 'react'
import { generateTasks, acceptTasks } from '@/api/ai'
import { getProjects } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { AITask, Project, Sprint } from '@/types'
import toast from 'react-hot-toast'
import { Sparkles, Plus, RefreshCw, X } from 'lucide-react'

const QUICK = [
  { label: 'Hospital Management', value: 'Hospital Management System with EHR, appointments, billing' },
  { label: 'E-commerce Platform', value: 'E-commerce platform with catalog, cart, checkout, inventory' },
  { label: 'Banking App', value: 'Banking application with fund transfers, KYC, statements' },
  { label: 'Learning Management', value: 'Learning management system with courses, quizzes, certificates' },
  { label: 'Food Delivery', value: 'Food delivery app with real-time tracking, payments, ratings' },
]
const PR_TAG: Record<string, string> = { CRITICAL: 'tag-red', HIGH: 'tag-amber', MEDIUM: 'tag-blue', LOW: 'tag-gray' }

export default function AIPage() {
  const [input, setInput] = useState(QUICK[0].value)
  const [tasks, setTasks] = useState<AITask[]>([])
  const [totalPts, setTotalPts] = useState(0)
  const [loading, setLoading] = useState(false)

  // Target sprint selection
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0)
  const [selectedSprintId, setSelectedSprintId] = useState<number>(0)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    getProjects().then(projs => {
      setProjects(projs)
      if (projs.length > 0) {
        setSelectedProjectId(projs[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      getSprintsByProject(selectedProjectId).then(sps => {
        setSprints(sps)
        const active = sps.find((s: Sprint) => s.status === 'ACTIVE')
        if (active) {
          setSelectedSprintId(active.id)
        } else if (sps.length > 0) {
          setSelectedSprintId(sps[0].id)
        } else {
          setSelectedSprintId(0)
        }
      })
    }
  }, [selectedProjectId])

  const generate = async (desc?: string) => {
    setLoading(true)
    try {
      const res = await generateTasks({ projectDescription: desc || input })
      setTasks(res.tasks)
      setTotalPts(res.totalPoints)
      toast.success(`✦ AI generated ${res.tasks.length} tasks (${res.totalPoints} story points)`)
    } catch {
      toast.error('AI generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAll = async () => {
    if (!selectedSprintId) {
      toast.error('Please create or select a target sprint first')
      return
    }
    setImporting(true)
    try {
      await acceptTasks({
        sprintId: selectedSprintId,
        tasks: tasks
      })
      toast.success('✓ All tasks successfully added to sprint backlog! 🎉')
      setTasks([])
    } catch {
      toast.error('Failed to import tasks to sprint')
    } finally {
      setImporting(false)
    }
  }

  const handleAddSingle = async (task: AITask, index: number) => {
    if (!selectedSprintId) {
      toast.error('Please create or select a target sprint first')
      return
    }
    try {
      await acceptTasks({
        sprintId: selectedSprintId,
        tasks: [task]
      })
      toast.success('✓ Task successfully added to sprint backlog!')
      setTasks(prev => prev.filter((_, idx) => idx !== index))
    } catch {
      toast.error('Failed to add task to sprint')
    }
  }

  return (
    <div className="page-container">
      <div className="rounded-xl p-5 mb-5 border border-teal-200" style={{ background: 'linear-gradient(135deg,#F0FDFA,#ECFDF5)' }}>
        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-bold mb-3">
          <Sparkles size={11} /> AI Task Generator
        </div>
        <div className="text-sm font-black text-slate-900 mb-3">Describe your project — AI generates sprint tasks automatically</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 block mb-1">PROJECT DESCRIPTION</label>
            <input className="field-input w-full" value={input} onChange={e => setInput(e.target.value)} placeholder="Describe your project…" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">TARGET IMPORT SPRINT</label>
            <div className="flex gap-2">
              <select className="field-input flex-1 text-xs" value={selectedProjectId} onChange={e => setSelectedProjectId(Number(e.target.value))}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
              <select className="field-input flex-1 text-xs" value={selectedSprintId} onChange={e => setSelectedSprintId(Number(e.target.value))}>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
                {sprints.length === 0 && <option value="0">-- No Sprints --</option>}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-teal-100/50">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[11px] font-semibold text-slate-500">Quick fill:</span>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => { setInput(q.value); generate(q.value) }}
                className="tag tag-teal cursor-pointer hover:bg-teal-100">{q.label}</button>
            ))}
          </div>
          <button onClick={() => generate()} disabled={loading} className="btn-primary whitespace-nowrap min-w-[140px] justify-center">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Tasks
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-slate-500 text-sm">
          <div className="spinner" /> AI is analyzing your project requirements…
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-black text-slate-900">AI Generated Tasks</div>
              <div className="text-[11.5px] text-slate-400 mt-0.5">{tasks.length} tasks · {totalPts} story points</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => generate()} className="btn-secondary text-[11px]"><RefreshCw size={11} /> Regenerate</button>
              <button onClick={handleAddAll} disabled={importing} className="btn-primary text-[11px]">
                {importing ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />} Add All to Sprint
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="card flex items-start gap-3 hover:border-blue-300 transition-colors">
                <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Sparkles size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 mb-1">{t.title}</div>
                  <div className="text-[11.5px] text-slate-500 leading-relaxed mb-2">{t.description}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className={`tag ${PR_TAG[t.priority] || 'tag-blue'}`}>{t.priority}</span>
                    <span className="tag tag-gray">{t.storyPoints} story pts</span>
                    <span className="tag tag-blue">{t.suggestedRole}</span>
                    <span className="tag tag-teal">{t.type}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => handleAddSingle(t, i)} className="btn-primary text-[10px]">+ Add</button>
                  <button onClick={() => setTasks(prev => prev.filter((_, idx) => idx !== i))} className="btn-secondary text-[10px]"><X size={10} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <Sparkles size={30} className="mx-auto mb-3 opacity-40" />
          <div className="text-sm font-bold text-slate-600 mb-1">No tasks generated yet</div>
          <div className="text-xs">Enter your project description above and click Generate Tasks</div>
        </div>
      )}
    </div>
  )
}
