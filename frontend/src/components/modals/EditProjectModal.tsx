import { useState, useEffect } from 'react'
import { updateProject } from '@/api/projects'
import { getUsers } from '@/api/users'
import { Project, User } from '@/types'
import toast from 'react-hot-toast'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  onUpdated: () => void
}

export default function EditProjectModal({ isOpen, onClose, project, onUpdated }: EditProjectModalProps) {
  const [name, setName] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [status, setStatus] = useState('PLANNING')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('')
  const [selectedScrumMasterId, setSelectedScrumMasterId] = useState<number | ''>('')
  const [users, setUsers] = useState<User[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getUsers()
        .then(setUsers)
        .catch(() => toast.error('Failed to load users for assignment'))
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && project) {
      setName(project.name || '')
      setProjectKey(project.projectKey || '')
      setDescription(project.description || '')
      setPriority(project.priority || 'MEDIUM')
      setStatus(project.status || 'PLANNING')
      setStartDate(project.startDate || '')
      setEndDate(project.endDate || '')
      setSelectedOwnerId(project.owner ? project.owner.id : '')
      setSelectedScrumMasterId('')
    }
  }, [isOpen, project])

  if (!isOpen) return null

  const projectOwnersList = users.filter(u => u.role === 'PROJECT_OWNER')
  const scrumMastersList = users.filter(u => u.role === 'SCRUM_MASTER')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Project Name is required')
    if (!projectKey.trim()) return toast.error('Project Key is required')
    if (projectKey.length > 10) return toast.error('Project Key must be less than 10 characters')

    setSubmitting(true)
    try {
      await updateProject(project.id, {
        name,
        projectKey: projectKey.toUpperCase(),
        description,
        emoji: project.emoji || '📋',
        priority,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        ownerId: selectedOwnerId || null,
        scrumMasterId: selectedScrumMasterId || null
      })
      toast.success('Project updated successfully! 🎉')
      onUpdated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold text-sm tracking-wide">Edit Project: {project.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">PROJECT NAME *</label>
              <input 
                type="text" 
                className="field-input text-xs" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="field-label">PROJECT KEY *</label>
              <input 
                type="text" 
                className="field-input text-xs" 
                value={projectKey} 
                onChange={e => setProjectKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                maxLength={10}
                required 
              />
            </div>
          </div>

          <div>
            <label className="field-label">DESCRIPTION</label>
            <textarea 
              className="field-input text-xs resize-none" 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">PROJECT OWNER (ASSIGN)</label>
              <select 
                className="field-input text-xs" 
                value={selectedOwnerId} 
                onChange={e => setSelectedOwnerId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Select Project Owner --</option>
                {projectOwnersList.map(o => (
                  <option key={o.id} value={o.id}>{o.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">SCRUM MASTER (ASSIGN)</label>
              <select 
                className="field-input text-xs" 
                value={selectedScrumMasterId} 
                onChange={e => setSelectedScrumMasterId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Select Scrum Master --</option>
                {scrumMastersList.map(sm => (
                  <option key={sm.id} value={sm.id}>{sm.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">PRIORITY</label>
              <select className="field-input text-xs" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="field-label">STATUS</label>
              <select className="field-input text-xs" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">START DATE</label>
              <input 
                type="date" 
                className="field-input text-xs" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="field-label">END DATE</label>
              <input 
                type="date" 
                className="field-input text-xs" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary text-[11px] py-1.5" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary text-[11px] py-1.5" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
