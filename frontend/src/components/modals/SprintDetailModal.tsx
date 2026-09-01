import { useEffect, useState } from 'react'
import { getSprint, startSprint, completeSprint, updateSprint } from '@/api/sprints'
import { getTicketsByProject, updateTicketSprint } from '@/api/tickets'
import { Sprint, Ticket, PRIORITY_TAG, STATUS_TAG } from '@/types'
import { X, Play, CheckCircle, Save, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { Link } from 'react-router-dom'
import { wsClient } from '@/utils/websocket'

interface SprintDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sprintId: number | null
  projectId: number
  onUpdated: () => void
}

const STATUS_COLOR: Record<string, string> = {
  PLANNED: '#94A3B8',
  ACTIVE: '#2563EB',
  COMPLETED: '#059669',
  CANCELLED: '#DC2626'
}

export default function SprintDetailModal({
  isOpen,
  onClose,
  sprintId,
  projectId,
  onUpdated
}: SprintDetailModalProps) {
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [loading, setLoading] = useState(false)

  // Edit fields
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [capacityPoints, setCapacityPoints] = useState(40)

  // Backlog tickets to link
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  const user = useSelector((s: RootState) => s.auth.user)
  const canManageSprint = user && ['ADMIN', 'SCRUM_MASTER', 'PROJECT_OWNER'].includes(user.role)

  const loadSprint = async () => {
    if (!sprintId) return
    setLoading(true)
    try {
      const data = await getSprint(sprintId)
      setSprint(data)
      setName(data.name || '')
      setGoal(data.goal || '')
      setStartDate(data.startDate || '')
      setEndDate(data.endDate || '')
      setCapacityPoints(data.capacityPoints || 40)
    } catch {
      toast.error('Failed to load sprint details')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTickets = async () => {
    try {
      const all = await getTicketsByProject(projectId)
      // Filter out tickets that are already in a sprint
      setAvailableTickets(all.filter((t: Ticket) => !t.sprintId))
    } catch {
      toast.error('Failed to load project backlog')
    }
  }

  useEffect(() => {
    if (isOpen && sprintId) {
      loadSprint()
      loadAvailableTickets()
    }
  }, [isOpen, sprintId])

  useEffect(() => {
    if (!isOpen || !sprintId) return
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'TICKET_UPDATED' || evt.type === 'SPRINT_UPDATED') {
        loadSprint()
        loadAvailableTickets()
      }
    })
    return () => unsubscribe()
  }, [isOpen, sprintId])

  if (!isOpen || !sprint) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Sprint name is required')
    setSubmitting(true)
    try {
      await updateSprint(sprint.id, {
        name,
        goal,
        startDate,
        endDate,
        capacityPoints,
        projectId
      })
      toast.success('Sprint updated successfully! 💾')
      onUpdated()
      loadSprint()
    } catch {
      toast.error('Failed to update sprint details')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStart = async () => {
    try {
      await startSprint(sprint.id)
      toast.success('Sprint has started! 🚀')
      onUpdated()
      loadSprint()
    } catch {
      toast.error('Failed to start sprint')
    }
  }

  const handleComplete = async () => {
    try {
      await completeSprint(sprint.id)
      toast.success('Sprint completed! 🏁')
      onUpdated()
      loadSprint()
    } catch {
      toast.error('Failed to complete sprint')
    }
  }

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId) return
    try {
      await updateTicketSprint(selectedTicketId, sprint.id)
      toast.success('Ticket added to sprint! 🎟️')
      setSelectedTicketId('')
      loadSprint()
      loadAvailableTickets()
      onUpdated()
    } catch {
      toast.error('Failed to add ticket to sprint')
    }
  }

  const handleRemoveTicket = async (tId: number) => {
    if (!window.confirm('Remove this ticket from the sprint?')) return
    try {
      await updateTicketSprint(tId, null)
      toast.success('Ticket returned to backlog 🗑️')
      loadSprint()
      loadAvailableTickets()
      onUpdated()
    } catch {
      toast.error('Failed to remove ticket')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <div>
            <h2 className="text-[18px] font-black text-slate-800 flex items-center gap-2">
              🏃 {sprint.name} Details
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: STATUS_COLOR[sprint.status] + '20', color: STATUS_COLOR[sprint.status] }}>
                {sprint.status}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Sprint planning and metrics management dashboard</p>
          </div>
          <div className="flex gap-2">
            {canManageSprint && sprint.status === 'PLANNED' && (
              <button onClick={handleStart} className="btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1">
                <Play size={11} /> Start Sprint
              </button>
            )}
            {canManageSprint && sprint.status === 'ACTIVE' && (
              <button onClick={handleComplete} className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1">
                <CheckCircle size={11} /> Complete Sprint
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading sprint details...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Metadata & Settings Form */}
            <div className="md:col-span-1 border-r pr-6">
              <h3 className="text-[12px] font-bold text-slate-700 uppercase mb-3">Settings & Fields</h3>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="field-label">SPRINT NAME</label>
                  <input
                    type="text"
                    className="field-input text-[11.5px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canManageSprint}
                  />
                </div>
                <div>
                  <label className="field-label">SPRINT GOAL</label>
                  <textarea
                    className="field-input text-[11.5px] h-16 resize-none"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    disabled={!canManageSprint}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label">START DATE</label>
                    <input
                      type="date"
                      className="field-input text-[11px]"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={!canManageSprint}
                    />
                  </div>
                  <div>
                    <label className="field-label">END DATE</label>
                    <input
                      type="date"
                      className="field-input text-[11px]"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!canManageSprint}
                    />
                  </div>
                </div>
                <div>
                  <label className="field-label">ESTIMATED CAPACITY POINTS</label>
                  <input
                    type="number"
                    className="field-input text-[11.5px]"
                    value={capacityPoints}
                    onChange={(e) => setCapacityPoints(Number(e.target.value))}
                    disabled={!canManageSprint}
                  />
                </div>

                {canManageSprint && (
                  <button type="submit" disabled={submitting} className="btn-primary text-[11px] w-full py-2 flex items-center justify-center gap-1.5 mt-2">
                    <Save size={12} /> Save Changes
                  </button>
                )}
              </form>
            </div>

            {/* Right: Backlog & Velocity Progress */}
            <div className="md:col-span-2 flex flex-col gap-5">
              {/* Velocity Progress Card */}
              <div className="bg-slate-50/65 rounded-lg border p-4">
                <h3 className="text-[12px] font-bold text-slate-700 uppercase mb-2">Sprint Velocity & Progress</h3>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                  <span>Completed Velocity: <strong className="text-slate-800">{sprint.completedPoints}sp</strong></span>
                  <span>Estimated Capacity: <strong className="text-slate-800">{sprint.capacityPoints}sp</strong></span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${sprint.progressPercent}%`,
                      background: STATUS_COLOR[sprint.status]
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9.5px] font-bold text-slate-400">
                  <span>{sprint.progressPercent}% Velocity Achieved</span>
                  <span>{sprint.totalTickets} total tickets</span>
                </div>
              </div>

              {/* Backlog associated tickets list */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase">Sprint Backlog ({sprint.tickets.length})</h3>
                  {canManageSprint && availableTickets.length > 0 && (
                    <form onSubmit={handleAddTicket} className="flex gap-1.5">
                      <select
                        className="field-input text-[10.5px] py-1 w-44"
                        value={selectedTicketId}
                        onChange={(e) => setSelectedTicketId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">Select Backlog Ticket...</option>
                        {availableTickets.map((t) => (
                          <option key={t.id} value={t.id}>
                            [{t.ticketKey}] {t.title} ({t.storyPoints}sp)
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-primary text-[10.5px] py-1 px-2.5 flex items-center gap-1">
                        <Plus size={11} /> Add
                      </button>
                    </form>
                  )}
                </div>

                <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Key</th>
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Title</th>
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Assignee</th>
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Priority</th>
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Status</th>
                        <th className="p-2 text-[10.5px] font-bold text-slate-500">Points</th>
                        {canManageSprint && <th className="p-2 text-[10.5px] font-bold text-slate-500 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sprint.tickets.length === 0 ? (
                        <tr>
                          <td colSpan={canManageSprint ? 7 : 6} className="p-4 text-center text-[11px] text-slate-400 italic">
                            No tickets assigned to this sprint. Use the dropdown above to add tickets.
                          </td>
                        </tr>
                      ) : (
                        sprint.tickets.map((t) => (
                          <tr key={t.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-[10px] font-mono font-bold text-blue-600">
                              <Link to={`/tickets/${t.id}`} onClick={onClose}>{t.ticketKey}</Link>
                            </td>
                            <td className="p-2 text-[11.5px] font-medium text-slate-700 truncate max-w-xs">{t.title}</td>
                            <td className="p-2 text-[10.5px] text-slate-500">
                              {t.assignee ? t.assignee.firstName : <em className="text-slate-400">Unassigned</em>}
                            </td>
                            <td className="p-2">
                              <span className={`tag ${PRIORITY_TAG[t.priority]} text-[9px] px-1 py-0.5`}>{t.priority}</span>
                            </td>
                            <td className="p-2">
                              <span className={`tag ${STATUS_TAG[t.status]} text-[9px] px-1 py-0.5`}>{t.status.replace('_', ' ')}</span>
                            </td>
                            <td className="p-2 text-[10.5px] font-bold text-blue-600">{t.storyPoints}sp</td>
                            {canManageSprint && (
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleRemoveTicket(t.id)}
                                  className="text-red-500 hover:text-red-750 font-bold text-[10px] bg-transparent border-0 cursor-pointer"
                                  title="Remove from Sprint"
                                >
                                  ❌
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
