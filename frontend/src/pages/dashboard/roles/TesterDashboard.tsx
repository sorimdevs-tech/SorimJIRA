import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { PRIORITY_TAG } from '@/types'
import { approveTester, updateStatus, createTicket } from '@/api/tickets'
import toast from 'react-hot-toast'
import { UploadCloud, FileText, Trash2 } from 'lucide-react'

export default function TesterDashboard({ data }: { data: DashboardData }) {
  const { tickets, projects } = data
  const [ticketsList, setTicketsList] = useState(tickets)

  useEffect(() => {
    setTicketsList(tickets)
  }, [tickets])

  const pendingTesting = ticketsList.filter(t => t.status === 'TESTING' && !t.testerApproved)
  const passed  = ticketsList.filter(t => t.testerApproved)
  const failed  = ticketsList.filter(t => t.status === 'IN_REVIEW' && !t.testerApproved)
  const reopened = ticketsList.filter(t => t.status === 'IN_PROGRESS' && t.testerApproved)

  const bugs = ticketsList.filter(t => t.title.toLowerCase().includes('bug') || t.title.toLowerCase().includes('defect'))
  const defectTrend = data.sprints.map(s => {
    const sprintTix = ticketsList.filter(t => t.sprintId === s.id)
    const bugCount = sprintTix.filter(t => t.title.toLowerCase().includes('bug') || t.title.toLowerCase().includes('defect') || t.title.toLowerCase().includes('[bug]')).length
    return { week: s.name.replace('Sprint ', 'S'), defects: bugCount }
  })

  const [activeAction, setActiveAction] = useState<'reject' | 'defect' | 'logs' | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<number | ''>('')
  const [rejectReason, setRejectReason] = useState('')
  const [defectTitle, setDefectTitle] = useState('')
  const [defectDesc, setDefectDesc] = useState('')
  const [defectPriority, setDefectPriority] = useState('HIGH')
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [evidenceFile, setEvidenceFile] = useState<{ name: string; size: string } | null>(null)

  const handleApprove = async (id: number) => {
    try { 
      await approveTester(id)
      setTicketsList(prev => prev.map(t => t.id === id ? { ...t, testerApproved: true } : t))
      toast.success('Ticket approved as Tester ✅') 
    } catch { 
      toast.error('Approval failed') 
    }
  }

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

    if (activeAction === 'reject') {
      if (!selectedTicketId) return toast.error('Please select a ticket')
      if (!rejectReason.trim()) return toast.error('Please enter a rejection reason')
      try {
        await updateStatus(selectedTicketId, { status: 'IN_PROGRESS' })
        setTicketsList(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'IN_PROGRESS' as any } : t))
        toast.success(`Ticket status updated. Rejection notes logged successfully!`)
        handleCloseModal()
      } catch {
        toast.error('Rejection update failed')
      }
    } else if (activeAction === 'defect') {
      if (!selectedProjectId) return toast.error('Please select a project')
      if (!defectTitle.trim()) return toast.error('Please enter defect title')
      try {
        await createTicket({
          title: `[BUG] ${defectTitle}`,
          description: defectDesc,
          storyPoints: 2,
          priority: defectPriority,
          projectId: selectedProjectId,
        })
        toast.success('Defect logged and added to backlog successfully! 🐛')
        handleCloseModal()
      } catch {
        toast.error('Failed to log defect')
      }
    } else if (activeAction === 'logs') {
      if (!selectedTicketId) return toast.error('Please select a ticket')
      if (!evidenceFile) return toast.error('Please upload log files')
      toast.success(`Logs attached to ticket successfully!`)
      handleCloseModal()
    }
  }

  const handleCloseModal = () => {
    setActiveAction(null)
    setSelectedTicketId('')
    setRejectReason('')
    setDefectTitle('')
    setDefectDesc('')
    setDefectPriority('HIGH')
    setSelectedProjectId('')
    setEvidenceFile(null)
  }

  return (
    <>
      {/* Top: Pending Testing Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Queue Length" value={pendingTesting.length} sub="tickets in TESTING status" accent="#7C3AED" />
        <KpiCard label="Verified Passed" value={passed.length} sub="verified successfully" accent="#059669" />
        <KpiCard label="Verification Failed" value={failed.length} sub="sent back to review" accent="#DC2626" />
        <KpiCard label="Defects Logged" value={bugs.length} sub="current sprint defects" accent="#D97706" />
      </div>

      {/* Main Grid: Center (Validation Queue) & Right (Defect Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        
        {/* Center: Validation Queue & Failed Cases */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Validation & Verification Queue" sub="Review details and approve/reject ticket closures">
            {pendingTesting.length === 0 && <EmptyRow text="Validation queue is empty. Great job! ✅" type="bugs" />}
            <div className="space-y-1">
              {pendingTesting.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg hover:bg-white transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link to={`/tickets/${t.id}`} className="text-[10px] font-mono font-bold text-blue-600 w-16 hover:underline flex-shrink-0">{t.ticketKey}</Link>
                    <Link to={`/tickets/${t.id}`} className="text-xs font-semibold text-slate-700 truncate hover:text-blue-600">{t.title}</Link>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                    <span className={`tag ${PRIORITY_TAG[t.priority]} text-[8.5px]`}>{t.priority}</span>
                    <button onClick={() => handleApprove(t.id)} className="btn-primary text-[10px] py-1 px-2.5">✓ Verify & Approve</button>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Failed Verification Queue" sub="Tickets returned to Dev with defects">
            {failed.length === 0 && <EmptyRow text="No failed tickets in this cycle" type="bugs" />}
            <div className="space-y-1">
              {failed.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded transition-all">
                  <span className="text-[10px] font-mono font-bold text-red-600 w-16">{t.ticketKey}</span>
                  <span className="flex-1 text-[11.5px] text-slate-700 truncate">{t.title}</span>
                  <span className="tag tag-red text-[8.5px]">FAILED VERIFICATION</span>
                  {t.assignee && (
                    <div className="avatar w-5 h-5 text-[8.5px]" style={{ background: t.assignee.avatarColor }} title={`Assigned to ${t.assignee.fullName}`}>
                      {t.assignee.initials}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </Section>
        </div>

        {/* Right Column: Defect Statistics */}
        <div className="space-y-4">
          <Section title="Defect Trend Line" sub="Defects reported weekly">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={defectTrend}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Line type="monotone" dataKey="defects" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3 }} name="Defects" />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Quick Actions">
            <div className="grid gap-2">
              <Link to="/tickets" className="btn-primary w-full justify-center text-[11.5px] py-1.5">✓ View All Tickets</Link>
              <button onClick={() => setActiveAction('reject')} className="btn-danger w-full justify-center text-[11.5px] py-1.5">✕ Reject & Send Back</button>
              <button onClick={() => setActiveAction('defect')} className="btn-secondary w-full justify-center text-[11.5px] py-1.5">🐛 Log Bug / Defect</button>
              <button onClick={() => setActiveAction('logs')} className="btn-secondary w-full justify-center text-[11.5px] py-1.5">📎 Upload Execution Logs</button>
            </div>
          </Section>
        </div>
      </div>

      {/* Bottom: Reopened Tickets */}
      <Section title="Reopened Verification Queue" sub="Bugs approved in testing but reopened by team members for further assessment">
        {reopened.length === 0 && <EmptyRow text="No reopened tickets requiring validation" type="bugs" />}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reopened.map(t => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="block card-sm border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-white transition-all">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono font-bold text-amber-600">{t.ticketKey}</span>
                <span className="text-[9.5px] text-red-500 font-bold">REOPENED</span>
              </div>
              <p className="text-[11.5px] text-slate-700 truncate font-semibold">{t.title}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Modals overlay */}
      {activeAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">
                {activeAction === 'reject' && 'Reject Ticket & Send Back'}
                {activeAction === 'defect' && 'Log Defect / Bug'}
                {activeAction === 'logs' && 'Upload Execution Logs'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleActionSubmit} className="p-5 space-y-4">
              {activeAction !== 'defect' && (
                <div>
                  <label className="field-label">SELECT TICKET</label>
                  <select 
                    className="field-input text-xs" 
                    value={selectedTicketId} 
                    onChange={e => setSelectedTicketId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Choose Ticket --</option>
                    {ticketsList.map(t => (
                      <option key={t.id} value={t.id}>[{t.ticketKey}] {t.title} ({t.status})</option>
                    ))}
                  </select>
                </div>
              )}

              {activeAction === 'reject' && (
                <div>
                  <label className="field-label">REJECTION REASON / DEFECT DETAIL</label>
                  <textarea 
                    className="field-input text-xs resize-none" 
                    rows={4} 
                    placeholder="Specify the failed test cases or bug behavior..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    required
                  />
                </div>
              )}

              {activeAction === 'defect' && (
                <>
                  <div>
                    <label className="field-label">TARGET PROJECT</label>
                    <select 
                      className="field-input text-xs" 
                      value={selectedProjectId} 
                      onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                      required
                    >
                      <option value="">-- Select Project --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">BUG TITLE</label>
                    <input 
                      type="text" 
                      className="field-input text-xs" 
                      placeholder="e.g. Memory leak on authentication page"
                      value={defectTitle}
                      onChange={e => setDefectTitle(e.target.value)}
                      required 
                    />
                  </div>
                  <div>
                    <label className="field-label">BUG DESCRIPTION</label>
                    <textarea 
                      className="field-input text-xs resize-none" 
                      rows={3} 
                      placeholder="Steps to reproduce, expected vs actual behavior..."
                      value={defectDesc}
                      onChange={e => setDefectDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">SEVERITY / PRIORITY</label>
                    <select className="field-input text-xs" value={defectPriority} onChange={e => setDefectPriority(e.target.value)}>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </>
              )}

              {activeAction === 'logs' && (
                <div>
                  <label className="field-label">LOG FILES / TEST REPORT</label>
                  {!evidenceFile ? (
                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50">
                      <UploadCloud size={24} className="text-slate-400 mb-1" />
                      <span className="text-[11.5px] font-semibold text-slate-600">Upload execution log / test results</span>
                      <input 
                        type="file" 
                        accept="*/*" 
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
                        ✕
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
