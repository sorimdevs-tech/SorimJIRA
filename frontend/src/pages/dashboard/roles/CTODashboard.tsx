import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, ProgressRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, BarChart, Bar } from 'recharts'
import { Plus, Trash2 } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

export default function CTODashboard({ data }: { data: DashboardData }) {
  const { projects, users, allTickets } = data
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const isCTO = currentUser?.role === 'CTO'
  
  const closedTixCount = allTickets.filter(t => t.status === 'CLOSED').length
  const totalTixCount = allTickets.length
  const onTime = totalTixCount > 0 ? Math.round((closedTixCount / totalTixCount) * 100) : 0

  const getUserUtilization = (uId: number) => {
    const userTix = allTickets.filter(t => t.assignee?.id === uId)
    const openUserTix = userTix.filter(t => t.status !== 'CLOSED')
    return Math.min(100, openUserTix.length * 25)
  }

  const avgUtil = users.length ? Math.round(users.reduce((acc, u) => acc + getUserUtilization(u.id), 0) / users.length) : 0
  const openRisks = allTickets.filter(t => t.priority === 'CRITICAL' && t.status !== 'CLOSED').length

  const statusDist = ['PLANNING','ACTIVE','ON_HOLD','COMPLETED'].map(s => ({
    name: s.replace('_',' '), value: projects.filter(p => p.status === s).length
  })).filter(d => d.value > 0)
  const COLORS = ['#D97706','#2563EB','#94A3B8','#059669']

  const capacity = users.slice(0, 7).map((u) => ({
    name: u.firstName, capacity: 100, used: getUserUtilization(u.id),
  }))

  const deliveryTrend = projects.map(p => {
    const pTix = allTickets.filter(t => t.projectKey === p.projectKey)
    const delivered = pTix.filter(t => t.status === 'CLOSED').reduce((acc, t) => acc + (t.storyPoints || 0), 0)
    const planned = pTix.reduce((acc, t) => acc + (t.storyPoints || 0), 0)
    return { q: p.projectKey, delivered, planned }
  })

  const healthMatrix = projects.map(p => ({
    ...p,
    schedule: p.progressPercent >= 50 ? 'On Track' : 'At Risk',
    quality: p.status === 'COMPLETED' ? 'Excellent' : 'Good',
  }))

  const [risksList, setRisksList] = useState<Array<{ level: string; text: string; tag: string }>>(() => {
    const saved = localStorage.getItem('sorim_risks')
    return saved ? JSON.parse(saved) : [
      { level: 'CRITICAL', text: 'Audit shows legacy dependencies requiring patch release.', tag: 'tag-red' },
      { level: 'MONITORING', text: 'Unit test coverage decreased slightly under Sprint 3.', tag: 'tag-gray' }
    ]
  })

  const [newRiskLevel, setNewRiskLevel] = useState('CRITICAL')
  const [newRiskText, setNewRiskText] = useState('')
  const [showAddRisk, setShowAddRisk] = useState(false)

  const handleAddRisk = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRiskText.trim()) return
    const tag = newRiskLevel === 'CRITICAL' ? 'tag-red' : newRiskLevel === 'HIGH' ? 'tag-orange' : newRiskLevel === 'MEDIUM' ? 'tag-amber' : 'tag-gray'
    const updated = [...risksList, { level: newRiskLevel, text: newRiskText, tag }]
    setRisksList(updated)
    localStorage.setItem('sorim_risks', JSON.stringify(updated))
    setNewRiskText('')
    setShowAddRisk(false)
  }

  const handleDeleteRisk = (index: number) => {
    const updated = risksList.filter((_, i) => i !== index)
    setRisksList(updated)
    localStorage.setItem('sorim_risks', JSON.stringify(updated))
  }

  return (
    <>
      {/* Top: Large Executive Dashboard KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Global Portfolio Size" value={projects.length} sub={`${projects.filter(p=>p.status==='ACTIVE').length} active projects`} accent="#2563EB" />
        <KpiCard label="Strategic Delivery Rate" value={`${onTime}%`} sub="on-time sprints" accent="#059669" />
        <KpiCard label="Resource Allocation" value={`${avgUtil}%`} sub="utilized across all roles" accent="#7C3AED" />
        <KpiCard label="Vulnerability / Open Risks" value={openRisks} sub={`${openRisks} critical mitigations`} accent="#DC2626" />
      </div>

      {/* Main Layout Grid: Center Left (Portfolio Heatmap) & Center Right (Capacity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        
        {/* Center Left: Portfolio Health Heatmap (spans 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Portfolio Health Heatmap" sub="Assess active projects by schedule adherence and quality indices">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Project Portfolio</th>
                    <th className="table-header">Completeness</th>
                    <th className="table-header">Schedule Health</th>
                    <th className="table-header">Quality Index</th>
                    <th className="table-header">Engineers</th>
                  </tr>
                </thead>
                <tbody>
                  {healthMatrix.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="table-cell font-bold text-slate-800">
                        <Link to={`/projects/${p.id}`} className="hover:text-blue-600 flex items-center gap-1.5">
                          <span>{p.emoji}</span>
                          <span>{p.name}</span>
                        </Link>
                      </td>
                      <td className="table-cell font-bold text-blue-600">{p.progressPercent}%</td>
                      <td className="table-cell">
                        <span className={`tag text-[8.5px] ${p.schedule==='On Track'?'tag-green':'tag-amber'}`}>
                          {p.schedule}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`tag text-[8.5px] ${p.quality==='Excellent'?'tag-green':'tag-blue'}`}>
                          {p.quality}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500 font-mono text-[10px]">{p.members.length} Devs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* Center Right: Resource Capacity Graphs */}
        <div className="lg:col-span-1 space-y-4">
          <Section title="Resource Capacity & Loads" sub="Engineers load distribution">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={capacity} barSize={16}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={18} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="used" fill="#7C3AED" radius={[3, 3, 0, 0]} name="Load %" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      </div>

      {/* Bottom Layout: Strategic Delivery Metrics & Technology Risk Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Strategic Delivery Metrics */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Strategic Delivery Trends" sub="Project commitments vs realization">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={deliveryTrend} barSize={16}>
                <XAxis dataKey="q" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={18} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="delivered" fill="#059669" radius={[2, 2, 0, 0]} name="Delivered Value" />
                <Bar dataKey="planned" fill="#E2E8F0" radius={[2, 2, 0, 0]} name="Planned Commitments" />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Project Status Allocation" sub="Active, completed, and planning distribution">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={36} outerRadius={55} paddingAngle={3}>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* Technology Risk Panel */}
        <div className="lg:col-span-1">
          <Section 
            title="Technology Risk Assessment" 
            sub="Vulnerability and technical debts indicators"
            action={isCTO && (
              <button onClick={() => setShowAddRisk(!showAddRisk)} className="btn-primary text-[10px] py-1 flex items-center gap-1">
                <Plus size={10} /> Add Risk
              </button>
            )}
          >
            {isCTO && showAddRisk && (
              <form onSubmit={handleAddRisk} className="p-3 mb-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">LEVEL</label>
                  <select 
                    value={newRiskLevel} 
                    onChange={e => setNewRiskLevel(e.target.value)}
                    className="field-input text-xs py-1"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="MONITORING">Monitoring</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">DESCRIPTION</label>
                  <textarea 
                    value={newRiskText} 
                    onChange={e => setNewRiskText(e.target.value)}
                    placeholder="Describe the risk..." 
                    className="field-input text-xs p-1.5 resize-none h-12"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary text-[10px] py-1 w-full justify-center">Save Risk</button>
              </form>
            )}
            <div className="space-y-3 py-1 max-h-[220px] overflow-y-auto pr-1">
              {risksList.map((r, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg relative group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-600 font-mono">{r.level}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`tag ${r.tag} text-[8px]`}>{r.level === 'CRITICAL' ? 'ATTN NEEDED' : 'MONITORING'}</span>
                      {isCTO && (
                        <button 
                          onClick={() => handleDeleteRisk(idx)} 
                          className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Risk"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-normal pr-4">{r.text}</p>
                </div>
              ))}
              {risksList.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400 italic">No technology risks identified.</div>
              )}
            </div>
          </Section>
        </div>

      </div>
    </>
  )
}
