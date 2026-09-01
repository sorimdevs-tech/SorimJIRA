import { useState, useEffect } from 'react'
import { getProjects } from '@/api/projects'
import { createSprint } from '@/api/sprints'
import { Project } from '@/types'
import toast from 'react-hot-toast'

interface CreateSprintModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: number
  onCreated: () => void
}

export default function CreateSprintModal({ isOpen, onClose, projectId, onCreated }: CreateSprintModalProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [capacityPoints, setCapacityPoints] = useState(50)
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getProjects().then(setProjects).catch(() => toast.error('Failed to load projects'))
      if (projectId) {
        setSelectedProjectId(projectId)
      }
    }
  }, [isOpen, projectId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return toast.error('Project selection is required')
    if (!name.trim()) return toast.error('Sprint Name is required')
    if (!startDate) return toast.error('Start Date is required')
    if (!endDate) return toast.error('End Date is required')

    setSubmitting(true)
    try {
      await createSprint({
        name,
        goal,
        startDate,
        endDate,
        capacityPoints,
        projectId: selectedProjectId
      })
      toast.success('Sprint created successfully! 🏃‍♂️')
      onCreated()
      onClose()
      // Reset form
      setName('')
      setGoal('')
      setStartDate('')
      setEndDate('')
      setCapacityPoints(50)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create sprint')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold text-sm tracking-wide">Create New Sprint</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="field-label">PROJECT *</label>
            <select 
              className="field-input text-xs" 
              value={selectedProjectId} 
              onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
              required
              disabled={!!projectId}
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">SPRINT NAME *</label>
            <input 
              type="text" 
              className="field-input text-xs" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Sprint 4" 
              required 
            />
          </div>

          <div>
            <label className="field-label">SPRINT GOAL</label>
            <textarea 
              className="field-input text-xs resize-none" 
              rows={2} 
              value={goal} 
              onChange={e => setGoal(e.target.value)} 
              placeholder="What should this sprint accomplish?..." 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">START DATE *</label>
              <input 
                type="date" 
                className="field-input text-xs" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                required
              />
            </div>
            <div>
              <label className="field-label">END DATE *</label>
              <input 
                type="date" 
                className="field-input text-xs" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                required
              />
            </div>
          </div>

          <div>
            <label className="field-label">STORY POINTS CAPACITY</label>
            <input 
              type="number" 
              className="field-input text-xs" 
              value={capacityPoints} 
              onChange={e => setCapacityPoints(Number(e.target.value))} 
              min={1}
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary text-[11px] py-1.5" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary text-[11px] py-1.5" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
