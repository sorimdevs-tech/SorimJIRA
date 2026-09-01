import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, ProgressRow, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Edit2 } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { wsClient } from '@/utils/websocket'
import toast from 'react-hot-toast'

export default function ProjectOwnerDashboard({ data }: { data: DashboardData }) {
  const { projects, sprints, tickets, users } = data
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const isPO = currentUser?.role === 'PROJECT_OWNER'
  
  const primary = projects[0]
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE')
  const openTickets = tickets.filter(t => t.status !== 'CLOSED')
  const closed = tickets.filter(t => t.status === 'CLOSED')

  const milestones = sprints.map((s, i) => ({
    name: s.name, goal: s.goal, done: s.status === 'COMPLETED', active: s.status === 'ACTIVE', pct: s.progressPercent,
  }))

  const sprintPerf = sprints.map(s => ({ name: s.name.replace('Sprint ','S'), completed: s.completedPoints, capacity: s.capacityPoints }))

  const today = new Date()
  const overdueTickets = tickets.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'CLOSED')
  const criticalTickets = tickets.filter(t => t.priority === 'CRITICAL' && t.status !== 'CLOSED')

  const [budgetPercent, setBudgetPercent] = useState(() => {
    return Number(localStorage.getItem('po_budget_percent') || '63')
  })
  const [budgetTotal, setBudgetTotal] = useState(() => {
    return localStorage.getItem('po_budget_total') || '480K'
  })
  const [showEditBudget, setShowEditBudget] = useState(false)
  const [tempPercent, setTempPercent] = useState(budgetPercent)
  const [tempTotal, setTempTotal] = useState(budgetTotal)

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((data) => {
      if (data.type === 'BUDGET_UPDATED') {
        setBudgetPercent(data.percent)
        setBudgetTotal(data.total)
        localStorage.setItem('po_budget_percent', String(data.percent))
        localStorage.setItem('po_budget_total', data.total)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault()
    setBudgetPercent(tempPercent)
    setBudgetTotal(tempTotal)
    localStorage.setItem('po_budget_percent', String(tempPercent))
    localStorage.setItem('po_budget_total', tempTotal)
    
    wsClient.send({
      type: 'BUDGET_UPDATED',
      percent: tempPercent,
      total: tempTotal
    })
    
    setShowEditBudget(false)
    toast.success('Budget details updated! 💸')
  }

  const risks = [
    ...(overdueTickets.length > 0 ? [{
      level: 'HIGH',
      text: `${overdueTickets.length} ticket(s) are past their due date and remain open`,
      tag: 'tag-red'
    }] : []),
    ...(criticalTickets.length > 0 ? [{
      level: 'HIGH',
      text: `${criticalTickets.length} CRITICAL priority ticket(s) are uncompleted`,
      tag: 'tag-red'
    }] : []),
    {
      level: 'MEDIUM',
      text: `Sprint capacity allocation is currently at ${activeSprints[0]?.progressPercent || 0}%`,
      tag: 'tag-amber'
    },
    {
      level: 'LOW',
      text: `Workspace member utilization average is ${users.length ? Math.round(users.reduce((acc, u) => acc + (u.utilizationPercent || 60), 0) / users.length) : 60}%`,
      tag: 'tag-gray'
    }
  ].slice(0, 3)

  return (
    <>
      {/* Top: Project Overview */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Project Progress" value={`${primary?.progressPercent ?? 0}%`} sub={primary?.name || 'Main Project'} accent="#2563EB" />
        <KpiCard label="Active Sprints" value={activeSprints.length} sub="sprints currently running" accent="#059669" />
        <KpiCard label="Open Tickets Scope" value={openTickets.length} sub={`${closed.length} tickets delivered`} accent="#7C3AED" />
        <div className="relative group">
          <KpiCard label="Budget Allocations" value={`${budgetPercent}%`} sub={`of $${budgetTotal} approved`} accent="#D97706" />
          {isPO && (
            <button 
              onClick={() => {
                setTempPercent(budgetPercent)
                setTempTotal(budgetTotal)
                setShowEditBudget(!showEditBudget)
              }}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Budget"
            >
              <Edit2 size={10} />
            </button>
          )}
          
          {isPO && showEditBudget && (
            <div className="absolute top-12 right-0 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 w-48 space-y-2 animate-in fade-in zoom-in-95 duration-100">
              <form onSubmit={handleSaveBudget} className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block">BUDGET PERCENT</label>
                  <input 
                    type="number" 
                    value={tempPercent}
                    onChange={e => setTempPercent(Number(e.target.value))}
                    className="field-input text-xs py-1"
                    min="0" max="100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block">TOTAL APPROVED</label>
                  <input 
                    type="text" 
                    value={tempTotal}
                    onChange={e => setTempTotal(e.target.value)}
                    placeholder="e.g. 480K"
                    className="field-input text-xs py-1"
                    required
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <button type="submit" className="btn-primary text-[9px] py-1 px-2 flex-1 justify-center">Save</button>
                  <button type="button" onClick={() => setShowEditBudget(false)} className="btn-secondary text-[9px] py-1 px-2 flex-1 justify-center">Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Center (Milestone Tracking) & Right (Risk Dashboard) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        
        {/* Center: Milestone Tracking (spans 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Milestone & Release Tracking" sub="Sprint commitments tracked as roadmap milestones">
            <div className="space-y-2 py-1">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-all rounded px-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0
                    ${m.done ? 'bg-emerald-500' : m.active ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    {m.done ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-slate-800 flex items-center gap-1.5">
                      {m.name}
                      {m.active && <span className="tag tag-blue text-[8px]">ACTIVE</span>}
                      {m.done && <span className="tag tag-green text-[8px]">RELEASED</span>}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate italic">Goal: "{m.goal || 'Not specified'}"</div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 pr-1">{m.done ? '100%' : m.active ? `${m.pct}%` : 'Planned'}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Right Column: Risk Dashboard */}
        <div className="lg:col-span-1 space-y-4">
          <Section title="Project Risk Dashboard" sub="Critical delivery impediments">
            <div className="space-y-2">
              {risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                  <span className={`tag ${r.tag} text-[8.5px] mt-0.5 font-extrabold`}>{r.level}</span>
                  <span className="text-[11.5px] text-slate-600 leading-normal">{r.text}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recent Deliverables" sub="Completed tickets in this cycle">
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {closed.slice(0, 4).map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors">
                  <span className="text-[9.5px] font-mono font-bold text-emerald-600 w-16">{t.ticketKey}</span>
                  <span className="flex-1 text-[11px] text-slate-700 truncate">{t.title}</span>
                  <span className="tag tag-green text-[8px]">DELIVERED</span>
                </Link>
              ))}
              {closed.length === 0 && <EmptyRow text="No deliverables closed yet" type="portfolio" />}
            </div>
          </Section>
        </div>
      </div>

      {/* Bottom: Delivery Timeline & Performance charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Portfolio Delivery Timeline" sub="Progress percentage across workspace projects">
          <div className="space-y-3 py-1">
            {projects.map(p => {
              const hasAccess = currentUser?.role === 'ADMIN' || 
                                p.members?.some(m => m.id === currentUser?.id) || 
                                p.owner?.id === currentUser?.id;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-sm">{p.emoji}</span>
                  {hasAccess ? (
                    <Link to={`/projects/${p.id}`} className="w-32 text-[12px] font-bold text-slate-700 truncate hover:text-blue-600">{p.name}</Link>
                  ) : (
                    <span 
                      onClick={() => toast.error("Offline Mode: You are not a member of this project and cannot access it.")}
                      className="w-32 text-[12px] font-bold text-slate-400 truncate cursor-not-allowed flex items-center gap-1"
                      title="Offline Mode"
                    >
                      🔒 {p.name}
                    </span>
                  )}
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width:`${p.progressPercent}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 w-10 text-right">{p.progressPercent}%</span>
                  <span className={`tag text-[8px] ${p.status==='ACTIVE'?'tag-blue':p.status==='COMPLETED'?'tag-green':'tag-amber'}`}>{p.status}</span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Sprint Commitment Realization" sub="Delivered story points vs planned capacity">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sprintPerf} barSize={16}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={18} />
              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
              <Bar dataKey="completed" fill="#2563EB" radius={[2, 2, 0, 0]} name="Completed" />
              <Bar dataKey="capacity" fill="#E2E8F0" radius={[2, 2, 0, 0]} name="Planned Capacity" />
              <Legend wrapperStyle={{ fontSize: 9 }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </>
  )
}
