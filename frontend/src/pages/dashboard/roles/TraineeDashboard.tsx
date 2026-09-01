import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { STATUS_TAG } from '@/types'
import toast from 'react-hot-toast'
import { updateStatus } from '@/api/tickets'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

export default function TraineeDashboard({ data }: { data: DashboardData }) {
  const { myTickets, notifications } = data
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const isTrainee = currentUser?.role === 'TRAINEE'
  const [ticketsList, setTicketsList] = useState(myTickets)
  
  useEffect(() => {
    setTicketsList(myTickets)
  }, [myTickets])

  const completed = ticketsList.filter(t => t.status === 'CLOSED')
  const pending = ticketsList.filter(t => t.status !== 'CLOSED')
  const today = new Date()

  const [learning, setLearning] = useState(() => {
    const saved = localStorage.getItem('trainee_learning')
    return saved ? JSON.parse(saved) : [
      { title: 'Complete Spring Boot fundamentals course', done: true },
      { title: 'Shadow code review with senior developer', done: true },
      { title: 'Implement first CRUD endpoint (mentored)', done: false },
      { title: 'Learn Git branching workflow', done: false },
    ]
  })

  const [activeAction, setActiveAction] = useState<'submit_review' | 'log_work' | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<number | ''>('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [workHours, setWorkHours] = useState(1)
  const [workDesc, setWorkDesc] = useState('')

  const toggleLearning = (index: number) => {
    const updated = learning.map((l: any, i: number) => i === index ? { ...l, done: !l.done } : l)
    setLearning(updated)
    localStorage.setItem('trainee_learning', JSON.stringify(updated))
  }

  // Calculate learning progress percent
  const learningPct = learning.length > 0 ? Math.round((learning.filter((l: any) => l.done).length / learning.length) * 100) : 0

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId) {
      toast.error('Please select a ticket')
      return
    }

    const tix = ticketsList.find(t => t.id === selectedTicketId)
    const tixKey = tix?.ticketKey || `#${selectedTicketId}`

    if (activeAction === 'submit_review') {
      if (!reviewNotes.trim()) {
        toast.error('Please enter review notes')
        return
      }
      try {
        await updateStatus(selectedTicketId, { status: 'IN_REVIEW' })
        setTicketsList(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'IN_REVIEW' as any } : t))
        toast.success(`Work for ticket ${tixKey} submitted for review successfully!`)
        handleCloseModal()
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to submit work')
      }
    } else if (activeAction === 'log_work') {
      if (!workDesc.trim()) {
        toast.error('Please enter a work summary')
        return
      }
      toast.success(`Logged ${workHours}h on ${tixKey}: "${workDesc}" successfully!`)
      handleCloseModal()
    }
  }

  const handleCloseModal = () => {
    setActiveAction(null)
    setSelectedTicketId('')
    setReviewNotes('')
    setWorkHours(1)
    setWorkDesc('')
  }

  // Trainee roadmap input
  const [newRoadmapTitle, setNewRoadmapTitle] = useState('')
  const handleAddRoadmap = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoadmapTitle.trim()) return
    const updated = [...learning, { title: newRoadmapTitle, done: false }]
    setLearning(updated)
    localStorage.setItem('trainee_learning', JSON.stringify(updated))
    setNewRoadmapTitle('')
    toast.success('Roadmap item added!')
  }

  // Trainee Feedback state
  const [feedbackList, setFeedbackList] = useState<Array<{ from: string; text: string; when: string; color: string; initials: string }>>(() => {
    const saved = localStorage.getItem('trainee_feedback')
    return saved ? JSON.parse(saved) : [
      { from: 'Sarah Chen', text: 'Great progress on the notification module — clean code and good test coverage.', when: '2 days ago', color: '#1E40AF', initials: 'SC' },
      { from: 'James Doe', text: 'Remember to add null checks before accessing nested DTO fields.', when: '5 days ago', color: '#059669', initials: 'JD' },
    ]
  })
  const [showAddFeedback, setShowAddFeedback] = useState(false)
  const [feedbackFrom, setFeedbackFrom] = useState('')
  const [feedbackText, setFeedbackText] = useState('')

  const handleAddFeedback = (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackFrom.trim() || !feedbackText.trim()) return
    const colors = ['#1E40AF', '#059669', '#7C3AED', '#D97706', '#DC2626']
    const color = colors[feedbackList.length % colors.length]
    const initials = feedbackFrom.split(' ').map(n => n[0]).join('').toUpperCase()
    const newFeedback = {
      from: feedbackFrom,
      text: feedbackText,
      when: 'Just now',
      color,
      initials
    }
    const updated = [newFeedback, ...feedbackList]
    setFeedbackList(updated)
    localStorage.setItem('trainee_feedback', JSON.stringify(updated))
    setFeedbackFrom('')
    setFeedbackText('')
    setShowAddFeedback(false)
    toast.success('Feedback added!')
  }

  return (
    <>
      {/* Top: Trainee Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Assigned Tasks" value={myTickets.length} sub="tickets in backlog" accent="#2563EB" />
        <KpiCard label="Tasks Completed" value={completed.length} sub="verified resolved" accent="#059669" />
        <KpiCard label="Pending Action" value={pending.length} sub="currently active" accent="#D97706" />
        <KpiCard label="Learning Progress" value={`${learningPct}%`} sub="roadmap items completed" accent="#7C3AED" />
      </div>

      {/* Main Layout Grid: Left (Assigned Tasks), Center (Learning Progress), Right (Mentor Feedback) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-start">
        
        {/* Left Column: Assigned Tasks Panel */}
        <div className="space-y-4">
          <Section title="My Assigned Tasks" sub={`${pending.length} open items`}>
            {pending.length === 0 && <EmptyRow text="No active tasks. Speak with your mentor to get assigned!" type="roadmap" />}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {pending.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="block p-2 bg-slate-50 border border-slate-200 hover:border-blue-400 rounded hover:bg-white transition-all">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9.5px] font-mono font-bold text-blue-600">{t.ticketKey}</span>
                    <span className={`tag ${STATUS_TAG[t.status]} text-[8px]`}>{t.status.replace('_',' ')}</span>
                  </div>
                  <div className="text-[11.5px] font-semibold text-slate-700 truncate">{t.title}</div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Trainee Quick Actions">
            <div className="grid gap-2">
              <Link to="/tickets" className="btn-primary w-full justify-center text-[11px] py-1.5">✓ View Tasks List</Link>
              <button onClick={() => setActiveAction('submit_review')} className="btn-secondary w-full justify-center text-[11px] py-1.5">📤 Submit Work for Review</button>
              <button onClick={() => setActiveAction('log_work')} className="btn-secondary w-full justify-center text-[11px] py-1.5">📎 Upload Work Logs</button>
            </div>
          </Section>
        </div>

        {/* Center Column: Learning Progress Section */}
        <div className="space-y-4">
          <Section 
            title="Learning Roadmap & Progress" 
            sub="Track courses and practical modules"
            action={
              <form onSubmit={handleAddRoadmap} className="flex gap-1">
                <input 
                  type="text" 
                  value={newRoadmapTitle} 
                  onChange={e => setNewRoadmapTitle(e.target.value)}
                  placeholder="New goal..." 
                  className="field-input text-[10px] py-1 px-1.5 w-24"
                  required
                />
                <button type="submit" className="btn-primary text-[9px] py-1 px-2">+</button>
              </form>
            }
          >
            <div className="mb-4 bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                <span>Learning Completion</span>
                <span>{learningPct}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: `${learningPct}%` }} />
              </div>
            </div>

            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {learning.map((l: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => toggleLearning(i)} 
                  className="flex items-center gap-2.5 py-2.5 border-b border-slate-100 last:border-0 px-1 rounded hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <input 
                    type="checkbox" 
                    checked={l.done} 
                    readOnly
                    className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={`text-[11.5px] font-medium leading-tight ${l.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {l.title}
                  </span>
                </div>
              ))}
              {learning.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400 italic">No learning goals set.</div>
              )}
            </div>
          </Section>
        </div>

        {/* Right Column: Mentor Feedback Area */}
        <div className="space-y-4">
          <Section 
            title="Mentor Feedback Hub" 
            sub="Direct performance reviews from seniors"
            action={!isTrainee && (
              <button onClick={() => setShowAddFeedback(!showAddFeedback)} className="btn-primary text-[10px] py-1">
                + Add Feedback
              </button>
            )}
          >
            {!isTrainee && showAddFeedback && (
              <form onSubmit={handleAddFeedback} className="p-3 mb-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">FROM (SENIOR)</label>
                  <input 
                    type="text" 
                    value={feedbackFrom} 
                    onChange={e => setFeedbackFrom(e.target.value)}
                    placeholder="e.g. Sarah Chen" 
                    className="field-input text-xs py-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">FEEDBACK TEXT</label>
                  <textarea 
                    value={feedbackText} 
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="Enter review message..." 
                    className="field-input text-xs p-1.5 resize-none h-12"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary text-[10px] py-1 w-full justify-center">Save Feedback</button>
              </form>
            )}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {feedbackList.map((f, i) => (
                <div key={i} className="flex gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="avatar w-6 h-6 text-[9.5px] flex-shrink-0 font-bold" style={{ background: f.color }}>{f.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-slate-800">{f.from}</span>
                      <span className="text-[9.5px] text-slate-400 font-mono">{f.when}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal italic">"{f.text}"</p>
                  </div>
                </div>
              ))}
              {feedbackList.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400 italic">No mentor feedback logs.</div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Bottom: Activity Feed */}
      <Section title="Trainee Activity Feed" sub="Your latest system interactions and milestones achieved">
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {notifications.slice(0, 4).map(n => (
            <div key={n.id} className="flex gap-2.5 py-2 border-b border-slate-100 last:border-0 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800">{n.title}</span> — <span className="text-slate-500">{n.message}</span>
              </div>
              <span className="text-[9.5px] text-slate-400 font-mono">{(n.createdAt || '').slice(0,10)}</span>
            </div>
          ))}
          {notifications.length === 0 && <EmptyRow text="No recent trainee activities recorded." type="roadmap" />}
        </div>
      </Section>

      {activeAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wide">
                {activeAction === 'submit_review' && 'Submit Work for Review'}
                {activeAction === 'log_work' && 'Log Work Hours'}
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

              {activeAction === 'submit_review' && (
                <div>
                  <label className="field-label">REVIEW & CLOSURE NOTES</label>
                  <textarea 
                    className="field-input text-xs resize-none" 
                    rows={4} 
                    placeholder="Describe what work was done for review..."
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    required
                  />
                </div>
              )}

              {activeAction === 'log_work' && (
                <>
                  <div>
                    <label className="field-label">WORK HOURS SPENT</label>
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
                    <label className="field-label">WORK PERFORMED</label>
                    <textarea 
                      className="field-input text-xs resize-none" 
                      rows={3} 
                      placeholder="What did you work on?..."
                      value={workDesc}
                      onChange={e => setWorkDesc(e.target.value)}
                      required
                    />
                  </div>
                </>
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
