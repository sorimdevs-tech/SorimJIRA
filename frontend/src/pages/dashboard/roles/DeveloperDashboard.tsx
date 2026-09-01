import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { PRIORITY_TAG, STATUS_TAG, Ticket, TicketStatus } from '@/types'
import toast from 'react-hot-toast'
import { updateStatus } from '@/api/tickets'
import { UploadCloud, FileText, Trash2, ArrowRight, Bell, Calendar, Clock } from 'lucide-react'

export default function DeveloperDashboard({ data }: { data: DashboardData }) {
  const { myTickets, notifications } = data
  const [ticketsList, setTicketsList] = useState<Ticket[]>(myTickets)
  const [activeAction, setActiveAction] = useState<'status' | 'worklog' | 'evidence' | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<number | ''>('')
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('')
  const [workHours, setWorkHours] = useState(1)
  const [workDesc, setWorkDesc] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<{ name: string; size: string } | null>(null)

  useEffect(() => {
    setTicketsList(myTickets)
  }, [myTickets])

  const assigned  = ticketsList
  const completed = ticketsList.filter(t => t.status === 'CLOSED')
  const pending   = ticketsList.filter(t => t.status !== 'CLOSED')
  const today = new Date()
  const overdue   = ticketsList.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'CLOSED')

  const upcoming = [...pending]
    .filter(t => t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  // Kanban Columns configuration
  const KANBAN_COLS: { key: TicketStatus; label: string; color: string }[] = [
    { key: 'TODO', label: 'To Do', color: 'bg-slate-100 text-slate-700' },
    { key: 'IN_PROGRESS', label: 'Active', color: 'bg-blue-50 text-blue-700' },
    { key: 'IN_REVIEW', label: 'Review', color: 'bg-amber-50 text-amber-700' },
    { key: 'TESTING', label: 'Testing', color: 'bg-purple-50 text-purple-700' },
    { key: 'CLOSED', label: 'Done', color: 'bg-emerald-50 text-emerald-700' },
  ]

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEvidenceFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB'
      })
      toast.success(`${file.name} attached!`)
    }
  }

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId) {
      toast.error('Please select a ticket')
      return
    }

    const tix = ticketsList.find(t => t.id === selectedTicketId)
    const tixKey = tix?.ticketKey || `#${selectedTicketId}`

    if (activeAction === 'status') {
      if (!newStatus) {
        toast.error('Please select a new status')
        return
      }
      try {
        await updateStatus(selectedTicketId, { status: newStatus })
        setTicketsList(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: newStatus } : t))
        toast.success(`Ticket ${tixKey} status updated to ${newStatus.replace('_', ' ')}!`)
        handleCloseModal()
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to update status')
      }
    } else if (activeAction === 'worklog') {
      if (!workDesc.trim()) {
        toast.error('Please enter a work summary')
        return
      }
      toast.success(`Logged ${workHours}h on ${tixKey}: "${workDesc}" successfully!`)
      handleCloseModal()
    } else if (activeAction === 'evidence') {
      if (!evidenceFile) {
        toast.error('Please upload evidence')
        return
      }
      toast.success(`Evidence "${evidenceFile.name}" uploaded to ${tixKey} successfully!`)
      handleCloseModal()
    }
  }

  const handleCloseModal = () => {
    setActiveAction(null)
    setSelectedTicketId('')
    setNewStatus('')
    setWorkHours(1)
    setWorkDesc('')
    setEvidenceFile(null)
  }

  return (
    <>
      {/* Top Level KPIs for Quick Context */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="My Total Workload" value={assigned.length} sub="tickets in active sprint" accent="#2563EB" />
        <KpiCard label="Tasks Completed" value={completed.length} sub="ready for release" accent="#059669" />
        <KpiCard label="Active Items" value={pending.length} sub="currently in flight" accent="#7C3AED" />
        <KpiCard label="Overdue Work" value={overdue.length} sub="past target milestones" accent="#DC2626" />
      </div>

      {/* Main Grid: Left (Deadlines & Alerts), Center (Kanban), Right (My Tasks & Quick Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 items-start">
        
        {/* Left Column: Deadlines & Notifications */}
        <div className="lg:col-span-1 space-y-4">
          <Section title="Upcoming Deadlines" sub="Nearest target dates">
            {upcoming.length === 0 && <EmptyRow text="No upcoming deadlines" type="tasks" />}
            <div className="space-y-2">
              {upcoming.map(t => {
                const isOverdue = new Date(t.dueDate) < today
                return (
                  <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-blue-300 bg-white shadow-sm transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9.5px] font-mono font-bold text-blue-600">{t.ticketKey}</div>
                      <div className="text-[10.5px] text-slate-700 truncate font-semibold">{t.title}</div>
                    </div>
                    <div className="text-right pl-2">
                      <div className={`text-[10px] font-bold flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                        <Calendar size={9} />
                        {t.dueDate}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </Section>

          <Section title="Recent Alerts" sub="System notifications">
            <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
              {notifications.slice(0, 4).map(n => (
                <div key={n.id} className="flex gap-2 text-[11px] leading-relaxed py-1.5 border-b border-slate-100 last:border-0">
                  <Bell size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">{n.title}</div>
                    <div className="text-slate-500 truncate">{n.message}</div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <EmptyRow text="No recent notifications" />}
            </div>
          </Section>
        </div>

        {/* Center Column: Kanban Board Widget */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Assigned Sprint Board" sub="Drag and drop or view tickets across stages" action={<Link to="/kanban" className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">Go to Full Board <ArrowRight size={10} /></Link>}>
            <div className="grid grid-cols-5 gap-2 select-none min-h-[320px]">
              {KANBAN_COLS.map(col => {
                const colTickets = ticketsList.filter(t => t.status === col.key)
                return (
                  <div key={col.key} className="flex flex-col bg-slate-50/70 border border-slate-100 rounded-lg p-1.5 min-h-[280px]">
                    <div className={`text-[9px] font-bold uppercase py-1 px-1.5 rounded text-center tracking-wide mb-2 ${col.color}`}>
                      {col.label} ({colTickets.length})
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[300px] pr-0.5">
                      {colTickets.map(t => (
                        <Link 
                          key={t.id} 
                          to={`/tickets/${t.id}`}
                          className="block bg-white p-2 rounded border border-slate-200 hover:border-blue-400 shadow-sm transition-all"
                        >
                          <div className="text-[9px] font-mono font-bold text-blue-600 truncate">{t.ticketKey}</div>
                          <div className="text-[10px] text-slate-600 truncate mt-0.5 font-medium">{t.title}</div>
                          <div className="flex justify-between items-center mt-1.5 text-[8.5px] text-slate-400">
                            <span className="font-semibold text-slate-500">{t.storyPoints}sp</span>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.priority === 'CRITICAL' ? '#DC2626' : t.priority === 'HIGH' ? '#D97706' : '#2563EB' }} />
                          </div>
                        </Link>
                      ))}
                      {colTickets.length === 0 && (
                        <div className="text-center py-8 text-[9px] text-slate-300 italic">Empty</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>

        {/* Right Column: My Tasks List & Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Section title="My Assigned Tasks" sub={`${pending.length} open items`} action={<button onClick={() => setActiveAction('status')} className="text-[10px] text-blue-600 font-bold hover:underline">Change Status</button>}>
            {pending.length === 0 && <EmptyRow text="No open tasks — clean slate! 🎉" type="tasks" />}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {pending.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="block card-sm border border-slate-100 hover:border-blue-400 transition-all bg-slate-50/50 hover:bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9.5px] font-mono font-bold text-blue-600">{t.ticketKey}</span>
                    <span className={`tag ${PRIORITY_TAG[t.priority]} text-[8px]`}>{t.priority}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{t.title}</div>
                  <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-100">
                    <span className={`tag ${STATUS_TAG[t.status]} text-[8px]`}>{t.status.replace('_', ' ')}</span>
                    <span className="text-[9px] text-slate-400">{t.storyPoints} sp</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Quick Actions">
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setActiveAction('worklog')} className="btn-secondary w-full justify-center text-[11.5px] py-1.5">🕒 Log Work Hours</button>
              <button onClick={() => setActiveAction('evidence')} className="btn-secondary w-full justify-center text-[11.5px] py-1.5">📎 Upload Evidence</button>
            </div>
          </Section>
        </div>

      </div>

      {/* Bottom: Activity Timeline */}
      <Section title="Work & Activity Timeline" sub="Historical updates of your tickets">
        <div className="relative border-l border-slate-200 ml-3 pl-5 space-y-4 py-2">
          {[...ticketsList].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0, 4).map((t, idx) => (
            <div key={t.id} className="relative text-xs">
              <span className="absolute -left-[25px] top-0.5 bg-blue-500 text-white rounded-full p-0.5 w-4.5 h-4.5 flex items-center justify-center text-[7.5px] font-bold">
                <Clock size={8} />
              </span>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="font-mono font-bold text-blue-600">[{t.ticketKey}]</span>{' '}
                  <span className="text-slate-700 font-semibold">{t.title}</span> was updated to status{' '}
                  <span className={`tag ${STATUS_TAG[t.status]} text-[9px]`}>{t.status.replace('_', ' ')}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex-shrink-0">{(t.updatedAt || '').slice(0, 16).replace('T', ' ')}</div>
              </div>
            </div>
          ))}
          {ticketsList.length === 0 && <EmptyRow text="No activities logged yet" />}
        </div>
      </Section>

      {/* Quick Action Modal overlays */}
      {activeAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">
                {activeAction === 'status' && 'Update Ticket Status'}
                {activeAction === 'worklog' && 'Log Work Hours'}
                {activeAction === 'evidence' && 'Upload Verification Evidence'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleActionSubmit} className="p-5 space-y-4">
              <div>
                <label className="field-label">SELECT TICKET</label>
                <select 
                  className="field-input text-xs" 
                  value={selectedTicketId} 
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedTicketId(val ? Number(val) : '');
                  }}
                  required
                >
                  <option value="">-- Choose Assigned Ticket --</option>
                  {ticketsList.map(t => (
                    <option key={t.id} value={t.id}>[{t.ticketKey}] {t.title} ({t.status})</option>
                  ))}
                </select>
              </div>

              {activeAction === 'status' && (
                <div>
                  <label className="field-label">NEW STATUS</label>
                  <select 
                    className="field-input text-xs" 
                    value={newStatus} 
                    onChange={e => setNewStatus(e.target.value as TicketStatus)}
                    required
                  >
                    <option value="">-- Choose Status --</option>
                    <option value="TODO">Todo</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="TESTING">Testing</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              )}

              {activeAction === 'worklog' && (
                <>
                  <div>
                    <label className="field-label">HOURS SPENT</label>
                    <input 
                      type="number" 
                      min={0.5} 
                      max={24} 
                      step={0.5}
                      className="field-input text-xs" 
                      value={workHours} 
                      onChange={e => setWorkHours(Number(e.target.value))}
                      required 
                    />
                  </div>
                  <div>
                    <label className="field-label">WORK SUMMARY</label>
                    <textarea 
                      className="field-input text-xs resize-none" 
                      rows={3} 
                      placeholder="What did you work on? (e.g. debugging OAuth controller integration)..."
                      value={workDesc}
                      onChange={e => setWorkDesc(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {activeAction === 'evidence' && (
                <div>
                  <label className="field-label">VERIFICATION ATTACHMENT</label>
                  {!evidenceFile ? (
                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50">
                      <UploadCloud size={24} className="text-slate-400 mb-1" />
                      <span className="text-[11.5px] font-semibold text-slate-600">Click to upload verification proof</span>
                      <span className="text-[9.5px] text-slate-400 mt-0.5">Supports images & PDF reports</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={handleEvidenceFileChange} 
                        required
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <FileText size={18} className="text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11.5px] font-semibold text-slate-700 truncate">{evidenceFile.name}</div>
                        <div className="text-[10px] text-slate-400">{evidenceFile.size}</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setEvidenceFile(null)} 
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded border-0 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={handleCloseModal} className="btn-secondary text-[11px] py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-[11px] py-1.5">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
