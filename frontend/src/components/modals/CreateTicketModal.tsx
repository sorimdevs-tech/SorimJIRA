import { useState, useEffect } from 'react'
import { getProjects } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { getUsers } from '@/api/users'
import { createTicket, updateTicket } from '@/api/tickets'
import { Project, Sprint, User } from '@/types'
import toast from 'react-hot-toast'
import {
  X,
  CheckSquare,
  Bookmark,
  Calendar,
  Zap,
  User as UserIcon,
  Layers,
  Sparkles,
  Info
} from 'lucide-react'

interface CreateTicketModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  defaultProjectId?: number | ''
  defaultSprintId?: number | ''
  ticketToEdit?: any
}

export default function CreateTicketModal({ 
  isOpen, 
  onClose, 
  onCreated,
  defaultProjectId = '',
  defaultSprintId = '',
  ticketToEdit = null
}: CreateTicketModalProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [users, setUsers] = useState<User[]>([])
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [storyPoints, setStoryPoints] = useState(3)
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>(defaultProjectId)
  const [selectedSprintId, setSelectedSprintId] = useState<number | ''>(defaultSprintId)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getProjects().then(setProjects).catch(() => toast.error('Failed to load projects'))
      getUsers().then(setUsers).catch(() => toast.error('Failed to load users'))
      
      if (ticketToEdit) {
        setTitle(ticketToEdit.title || '')
        setDescription(ticketToEdit.description || '')
        setStoryPoints(ticketToEdit.storyPoints || 3)
        setPriority(ticketToEdit.priority || 'MEDIUM')
        setDueDate(ticketToEdit.dueDate || '')
        setSelectedProjectId(ticketToEdit.projectId || '')
        setSelectedSprintId(ticketToEdit.sprintId || '')
        setSelectedAssigneeId(ticketToEdit.assignee?.id || '')
      } else {
        setTitle('')
        setDescription('')
        setStoryPoints(3)
        setPriority('MEDIUM')
        setDueDate('')
        setSelectedProjectId(defaultProjectId)
        setSelectedSprintId(defaultSprintId)
        setSelectedAssigneeId('')
      }
    }
  }, [isOpen, defaultProjectId, defaultSprintId, ticketToEdit])

  useEffect(() => {
    if (selectedProjectId) {
      getSprintsByProject(selectedProjectId)
        .then(ss => {
          setSprints(ss)
          if (defaultSprintId && ss.some((s: { id: number }) => s.id === defaultSprintId)) {
            setSelectedSprintId(defaultSprintId)
          }
        })
        .catch(() => toast.error('Failed to load sprints for selected project'))
    } else {
      setSprints([])
      setSelectedSprintId('')
    }
  }, [selectedProjectId, defaultSprintId])

  if (!isOpen) return null

  const selectedProj = projects.find(p => p.id === selectedProjectId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) return toast.error('Project selection is required')
    if (!title.trim()) return toast.error('Ticket Title is required')

    setSubmitting(true)
    try {
      const payload = {
        title,
        description,
        storyPoints,
        priority,
        dueDate: dueDate || null,
        projectId: selectedProjectId,
        sprintId: selectedSprintId || null,
        assigneeId: selectedAssigneeId || null
      }
      if (ticketToEdit) {
        await updateTicket(ticketToEdit.id, payload)
        toast.success('Ticket updated successfully! 🎫')
      } else {
        await createTicket(payload)
        toast.success('Ticket created successfully! 🎫')
      }
      onCreated()
      onClose()
      // Reset form
      setTitle('')
      setDescription('')
      setStoryPoints(3)
      setPriority('MEDIUM')
      setDueDate('')
      setSelectedProjectId('')
      setSelectedSprintId('')
      setSelectedAssigneeId('')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden border border-[#DFE1E6] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Jira Style Modal Header */}
        <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#DEEBFF] text-[#0052CC] flex items-center justify-center flex-shrink-0 font-bold">
              <CheckSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-[#172B4D]">
                  {ticketToEdit ? 'Edit Issue' : 'Create Issue'}
                </h3>
                {selectedProj && (
                  <span className="text-[10px] font-bold bg-[#DEEBFF] text-[#0052CC] px-2 py-0.5 rounded uppercase tracking-wider">
                    {selectedProj.projectKey || 'JIRA'}
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#6B778C]">
                {ticketToEdit ? `Updating ticket ${ticketToEdit.ticketKey || ''}` : 'Required fields are marked with an asterisk *'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Jira Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-[#172B4D]">
          
          {/* Project & Sprint Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                PROJECT <span className="text-[#DE350B]">*</span>
              </label>
              <select 
                className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none" 
                value={selectedProjectId} 
                onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name} ({p.projectKey})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                SPRINT
              </label>
              <select 
                className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none disabled:opacity-60 disabled:bg-[#EBECF0]" 
                value={selectedSprintId} 
                onChange={e => setSelectedSprintId(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedProjectId}
              >
                <option value="">-- Backlog (No Active Sprint) --</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>🏃 {s.name} ({s.status})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ticket Title */}
          <div>
            <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
              SUMMARY / ISSUE TITLE <span className="text-[#DE350B]">*</span>
            </label>
            <input 
              type="text" 
              className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none placeholder-[#8993A4]" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. As a user, I want to authenticate via JWT tokens..." 
              required 
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide">
                DESCRIPTION
              </label>
              <span className="text-[10px] text-[#6B778C]">Markdown supported</span>
            </div>
            <textarea 
              className="w-full px-3 py-2.5 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] transition-all outline-none placeholder-[#8993A4] resize-y min-h-[90px]" 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Describe the acceptance criteria, steps to reproduce, or task technical specifications..." 
            />
          </div>

          {/* Story Points, Priority, Assignee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Zap size={13} className="text-[#FFAB00]" /> STORY POINTS
              </label>
              <select 
                className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none" 
                value={storyPoints} 
                onChange={e => setStoryPoints(Number(e.target.value))}
              >
                <option value={1}>1 pt (Very Small)</option>
                <option value={2}>2 pts (Small)</option>
                <option value={3}>3 pts (Medium)</option>
                <option value={5}>5 pts (Large)</option>
                <option value={8}>8 pts (Very Large)</option>
                <option value={13}>13 pts (Epic Scope)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                PRIORITY
              </label>
              <select 
                className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-semibold transition-all outline-none" 
                value={priority} 
                onChange={e => setPriority(e.target.value)}
              >
                <option value="CRITICAL">🔴 Critical (Highest)</option>
                <option value="HIGH">🟠 High</option>
                <option value="MEDIUM">🔵 Medium</option>
                <option value="LOW">🟢 Low (Lowest)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <UserIcon size={13} className="text-[#0052CC]" /> ASSIGNEE
              </label>
              <select 
                className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none" 
                value={selectedAssigneeId} 
                onChange={e => setSelectedAssigneeId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Unassigned --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role?.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-[#6B778C]" /> TARGET DUE DATE
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none" 
              value={dueDate} 
              onChange={e => setDueDate(e.target.value)} 
            />
          </div>

          {/* Jira Action Footer */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#EBECF0]">
            <div className="text-[11px] text-[#6B778C] flex items-center gap-1.5">
              <Info size={13} /> Saved in real-time
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-3.5 py-1.5 text-[13px] font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-transparent border-0 cursor-pointer" 
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0 disabled:opacity-50" 
                disabled={submitting}
              >
                {submitting ? (ticketToEdit ? 'Saving...' : 'Creating...') : (ticketToEdit ? 'Save Changes' : 'Create Issue')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
