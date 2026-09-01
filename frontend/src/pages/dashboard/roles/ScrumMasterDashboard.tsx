import { Link } from 'react-router-dom'
import { KpiCard, Section, ProgressRow, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { PRIORITY_TAG, STATUS_TAG } from '@/types'

export default function ScrumMasterDashboard({ data }: { data: DashboardData }) {
  const { projects, sprints, tickets, users } = data
  const activeSprint = sprints.find(s => s.status === 'ACTIVE')
  const openTickets = tickets.filter(t => t.status !== 'CLOSED')
  const closedTickets = tickets.filter(t => t.status === 'CLOSED')
  const highPriority = tickets.filter(t => (t.priority === 'CRITICAL' || t.priority === 'HIGH') && t.status !== 'CLOSED').slice(0, 6)
  // "Blocked" heuristic: overdue (past due date) and not closed
  const today = new Date()
  const blocked = tickets.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'CLOSED').slice(0, 6)

  const velocity = sprints.map(s => ({ name: s.name.replace('Sprint ', 'S'), completed: s.completedPoints, capacity: s.capacityPoints }))
  
  const activeSprintTickets = tickets.filter(t => t.sprintId === activeSprint?.id)
  const totalPoints = activeSprintTickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0) || activeSprint?.capacityPoints || 52
  const completedPoints = activeSprintTickets.filter(t => t.status === 'CLOSED').reduce((sum, t) => sum + (t.storyPoints || 0), 0) || activeSprint?.completedPoints || 0

  const burndown = [
    { day: 'D1', ideal: totalPoints, actual: totalPoints },
    { day: 'D5', ideal: Math.round(totalPoints * 0.8), actual: Math.round(totalPoints - (completedPoints * 0.1)) },
    { day: 'D10', ideal: Math.round(totalPoints * 0.6), actual: Math.round(totalPoints - (completedPoints * 0.3)) },
    { day: 'D15', ideal: Math.round(totalPoints * 0.4), actual: Math.round(totalPoints - (completedPoints * 0.6)) },
    { day: 'D20', ideal: Math.round(totalPoints * 0.2), actual: Math.round(totalPoints - (completedPoints * 0.85)) },
    { day: 'D25', ideal: 0, actual: Math.max(0, totalPoints - completedPoints) },
  ]

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <KpiCard label="Total Projects" value={projects.length} sub="workspace wide" trend="up" accent="#2563EB" />
        <KpiCard label="Active Sprints" value={sprints.filter(s => s.status === 'ACTIVE').length} sub="in progress" trend="up" accent="#059669" />
        <KpiCard label="Total Tickets" value={tickets.length} sub="current project" trend="flat" accent="#0EA5E9" />
        <KpiCard label="Open Tickets" value={openTickets.length} sub="need attention" trend="down" accent="#7C3AED" />
        <KpiCard label="Completed" value={closedTickets.length} sub="tickets closed" trend="up" accent="#D97706" />
        <KpiCard label="Sprint Velocity" value={`${activeSprint?.completedPoints || 0} sp`} sub="this sprint" trend="up" accent="#DB2777" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Active Sprint Progress */}
        <Section title="Active Sprint Progress" sub={activeSprint ? `${activeSprint.name} · ${activeSprint.goal}` : 'No active sprint'}>
          {activeSprint ? (
            <>
              <div className="rounded-lg p-3.5 mb-3" style={{ background: 'linear-gradient(135deg,#1E40AF,#7C3AED)' }}>
                <div className="text-sm font-black text-white mb-0.5">{activeSprint.name}</div>
                <div className="text-[11px] text-white/70 mb-2.5 italic">"{activeSprint.goal}"</div>
                <div className="h-1.5 bg-white/20 rounded-full mb-2">
                  <div className="h-full bg-white rounded-full" style={{ width: `${activeSprint.progressPercent}%` }} />
                </div>
                <div className="flex gap-4">
                  <div className="text-[11px] text-white/80"><span className="font-bold text-white text-sm">{activeSprint.completedPoints}</span> pts done</div>
                  <div className="text-[11px] text-white/80"><span className="font-bold text-white text-sm">{activeSprint.capacityPoints - activeSprint.completedPoints}</span> pts left</div>
                  <div className="text-[11px] text-white/80"><span className="font-bold text-white text-sm">{activeSprint.progressPercent}%</span> complete</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/kanban/${activeSprint.id}`} className="btn-secondary text-[11px]">View Board</Link>
                <Link to="/tickets" className="btn-secondary text-[11px]">View Tickets</Link>
              </div>
            </>
          ) : <EmptyRow text="No active sprint right now" type="tasks" />}
        </Section>

        {/* Sprint Burndown */}
        <Section title="Sprint Burndown Chart" sub="Story points remaining vs ideal">
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={burndown}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
              <Line type="monotone" dataKey="ideal" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Ideal" />
              <Line type="monotone" dataKey="actual" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} name="Actual" />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Team Utilization */}
        <Section title="Team Utilization" action={<Link to="/resources" className="text-[11px] text-blue-600 font-semibold hover:underline">View all</Link>}>
          {users.slice(0, 5).map((u) => {
            const userTix = tickets.filter(t => t.assignee?.id === u.id)
            const openUserTix = userTix.filter(t => t.status !== 'CLOSED')
            const util = Math.min(100, openUserTix.length * 25)
            const color = util > 80 ? '#DC2626' : util > 60 ? '#2563EB' : '#059669'
            return <ProgressRow key={u.id} label={u.firstName} pct={util} color={color} avatarColor={u.avatarColor} avatarText={u.initials} />
          })}
        </Section>

        {/* Sprint Timeline */}
        <Section title="Sprint Timeline" sub={`${sprints.length} sprints scheduled`}>
          {sprints.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 mb-2">
              <div className="w-16 text-[10.5px] font-semibold text-slate-700 truncate">{s.name}</div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${s.status === 'PLANNED' ? 8 : s.progressPercent}%`,
                  background: s.status === 'COMPLETED' ? '#059669' : s.status === 'ACTIVE' ? '#2563EB' : '#CBD5E1',
                }} />
              </div>
              <span className={`tag text-[9px] ${s.status === 'COMPLETED' ? 'tag-green' : s.status === 'ACTIVE' ? 'tag-blue' : 'tag-gray'}`}>
                {s.status === 'ACTIVE' ? `${s.progressPercent}%` : s.status === 'COMPLETED' ? '✓' : '—'}
              </span>
            </div>
          ))}
        </Section>

        {/* Recent Activity (derived from tickets updatedAt, most recent first) */}
        <Section title="Recent Activities">
          {[...tickets].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5).map(t => (
            <div key={t.id} className="flex items-start gap-2 mb-2.5">
              <div className="avatar w-5 h-5 text-[8px] flex-shrink-0 mt-0.5" style={{ background: t.assignee?.avatarColor || '#94A3B8' }}>
                {t.assignee?.initials || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-700 leading-snug">
                  <span className="font-mono font-semibold text-blue-600">{t.ticketKey}</span> moved to <strong>{t.status.replace('_', ' ')}</strong>
                </div>
                <div className="text-[10px] text-slate-400">{(t.updatedAt || '').slice(0, 10)}</div>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <EmptyRow text="No activity yet" />}
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* High Priority Tickets */}
        <Section title="High Priority Tickets" sub={`${highPriority.length} critical/high open`}>
          {highPriority.length === 0 && <EmptyRow text="No high-priority tickets open 🎉" type="tasks" />}
          {highPriority.map(t => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded">
              <span className="text-[10px] font-mono font-bold text-blue-600 w-16">{t.ticketKey}</span>
              <span className="flex-1 text-[11.5px] text-slate-700 truncate">{t.title}</span>
              <span className={`tag ${PRIORITY_TAG[t.priority]} text-[9px]`}>{t.priority}</span>
            </Link>
          ))}
        </Section>

        {/* Blocked Tasks */}
        <Section title="Blocked / Overdue Tasks" sub={`${blocked.length} tickets past due`}>
          {blocked.length === 0 && <EmptyRow text="Nothing overdue right now ✅" type="tasks" />}
          {blocked.map(t => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded">
              <span className="text-[10px] font-mono font-bold text-red-600 w-16">{t.ticketKey}</span>
              <span className="flex-1 text-[11.5px] text-slate-700 truncate">{t.title}</span>
              <span className={`tag ${STATUS_TAG[t.status]} text-[9px]`}>{t.status.replace('_', ' ')}</span>
              <span className="text-[10px] text-red-500 font-semibold">{t.dueDate}</span>
            </Link>
          ))}
        </Section>
      </div>

      {/* Reports row */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Velocity Trend Report" sub="Completed vs capacity per sprint">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={velocity} barSize={18}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
              <Bar dataKey="completed" fill="#2563EB" radius={[3, 3, 0, 0]} name="Completed" />
              <Bar dataKey="capacity" fill="#E2E8F0" radius={[3, 3, 0, 0]} name="Capacity" />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
        <Section title="Resource Allocation Report" sub="Tickets assigned per team member">
          {users.slice(0, 6).map(u => {
            const count = tickets.filter(t => t.assignee?.id === u.id).length
            const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0
            return <ProgressRow key={u.id} label={u.firstName} pct={pct} rightLabel={`${count} tix`} color="#7C3AED" avatarColor={u.avatarColor} avatarText={u.initials} />
          })}
        </Section>
      </div>
    </>
  )
}
