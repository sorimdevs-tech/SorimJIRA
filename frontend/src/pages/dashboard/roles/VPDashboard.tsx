import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, ProgressRow, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function VPDashboard({ data }: { data: DashboardData }) {
  const { projects, users, allTickets, sprints } = data
  
  const totalProjs = projects.length || 1
  const activeProjs = projects.filter(p => p.status === 'ACTIVE').length
  const portfolioHealth = Math.round((activeProjs / totalProjs) * 100) || 0

  const closedTicketsCount = allTickets.filter(t => t.status === 'CLOSED').length
  const totalTicketsCount = allTickets.length
  const successRate = totalTicketsCount > 0 ? Math.round((closedTicketsCount / totalTicketsCount) * 100) : 0
  
  const activeResources = users.length

  const healthScore = projects.map(p => ({ name: p.name.split(' ')[0], score: p.progressPercent }))
  
  const getUserUtilization = (uId: number) => {
    const userTix = allTickets.filter(t => t.assignee?.id === uId)
    const openUserTix = userTix.filter(t => t.status !== 'CLOSED')
    return Math.min(100, openUserTix.length * 25)
  }

  // Group users by role to simulate departments dynamically
  const roles = Array.from(new Set(users.map(u => u.role))).filter(Boolean)
  const resourceUsage = roles.map(r => {
    const roleUsers = users.filter(u => u.role === r)
    const avgRoleUtil = roleUsers.length ? Math.round(roleUsers.reduce((sum, u) => sum + getUserUtilization(u.id), 0) / roleUsers.length) : 0
    return { dept: r.replace('_', ' '), used: avgRoleUtil }
  }).slice(0, 4)

  const quarterly = sprints.map(s => ({
    q: s.name.replace('Sprint ', 'S'),
    success: s.progressPercent
  }))

  const highRisk = projects.filter(p => p.progressPercent < 40 && p.status !== 'COMPLETED')

  const [risksList] = useState<Array<{ level: string; text: string; tag: string }>>(() => {
    const saved = localStorage.getItem('sorim_risks')
    return saved ? JSON.parse(saved) : [
      { level: 'CRITICAL', text: 'Audit shows legacy dependencies requiring patch release.', tag: 'tag-red' },
      { level: 'MONITORING', text: 'Unit test coverage decreased slightly under Sprint 3.', tag: 'tag-gray' }
    ]
  })

  const deptPerformance = roles.map(r => {
    const roleUsers = users.filter(u => u.role === r)
    const roleTickets = allTickets.filter(t => roleUsers.some(u => u.id === t.assignee?.id))
    const closedRoleTickets = roleTickets.filter(t => t.status === 'CLOSED')
    const score = roleTickets.length ? Math.round((closedRoleTickets.length / roleTickets.length) * 100) : 0
    return { dept: r.replace('_', ' '), score }
  })

  return (
    <>
      {/* Top: Executive KPI Section */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Overall Portfolio Health" value={`${portfolioHealth}%`} sub="organization score" accent="#059669" />
        <KpiCard label="Managed Portfolio size" value={projects.length} sub={`${projects.filter(p=>p.status==='ACTIVE').length} active projects`} accent="#2563EB" />
        <KpiCard label="Strategic Headcount" value={activeResources} sub="assigned project members" accent="#7C3AED" />
        <KpiCard label="Commitment Completion" value={`${successRate}%`} sub="on-time milestones" accent="#D97706" />
      </div>

      {/* Main Layout Grid: Center (Portfolio Performance) & Right (Strategic Risk) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        
        {/* Center Column: Portfolio Performance (spans 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Portfolio Performance Dashboard" sub="Executive overview of delivery trajectories">
            <div className="text-[12px] text-slate-600 leading-relaxed mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-bold text-slate-800">Executive Summary: </span>
              {projects.filter(p=>p.status==='ACTIVE').length} active projects are progressing with an average completion rate of{' '}
              <span className="font-bold text-blue-600">
                {Math.round(projects.reduce((a,p)=>a+p.progressPercent,0)/(projects.length||1))}%
              </span>.
              A total of {allTickets.filter(t=>t.status==='CLOSED').length} deliverables have been closed this quarter.
            </div>

            <div className="space-y-2.5">
              {projects.map(p => (
                <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors">
                  <span className="text-sm">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.members.length} members · target: {p.endDate}</div>
                  </div>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${p.progressPercent}%`, background: p.progressPercent < 40 ? '#DC2626' : '#2563EB' }} />
                  </div>
                  <span className="text-[11px] font-bold w-10 text-right text-slate-500">{p.progressPercent}%</span>
                </Link>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Project Health Metrics" sub="Composite index score">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={healthScore} barSize={18}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={18} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="score" fill="#059669" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Quarterly Delivery Timeline" sub="Historical success trajectory">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={quarterly}>
                  <XAxis dataKey="q" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={18} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                  <Line type="monotone" dataKey="success" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} name="Success %" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </div>

        {/* Right Column: Strategic Risk Indicators */}
        <div className="lg:col-span-1 space-y-4">
          <Section title="Strategic Risk Indicators" sub="At-risk milestones & items">
            {highRisk.length === 0 && risksList.length === 0 && <EmptyRow text="No high-risk projects or concerns flagged ✅" type="portfolio" />}
            <div className="space-y-2">
              {highRisk.map(p => (
                <div key={p.id} className="p-2.5 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-red-600 font-mono">SCHEDULE BLOCKER</span>
                    <span className="tag tag-red text-[8px] font-extrabold">{p.progressPercent}% DONE</span>
                  </div>
                  <p className="text-[11.5px] text-red-700 leading-normal">{p.emoji} {p.name} is progressing below target. Executive remediation required.</p>
                </div>
              ))}
              
              {risksList.map((r, i) => (
                <div key={i} className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-amber-600 font-mono">{r.level}</span>
                    <span className={`tag ${r.tag} text-[8px]`}>{r.level}</span>
                  </div>
                  <p className="text-[11.5px] text-amber-700 leading-normal">{r.text}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Bottom: Organization Utilization Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Organizational Utilization" sub="Department loading metrics">
          <div className="space-y-1 py-1">
            {resourceUsage.map(d => (
              <ProgressRow key={d.dept} label={d.dept} pct={d.used}
                color={d.used > 80 ? '#DC2626' : d.used > 60 ? '#2563EB' : '#059669'} />
            ))}
          </div>
        </Section>

        <Section title="Department Performance Indices" sub="Average delivery score per department">
          <div className="space-y-1 py-1">
            {deptPerformance.map(x => (
              <ProgressRow key={x.dept} label={x.dept} pct={x.score} color="#7C3AED" />
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
