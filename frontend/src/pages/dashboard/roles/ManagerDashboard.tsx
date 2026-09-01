import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Section, ProgressRow, EmptyRow } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { approveManager } from '@/api/tickets'
import toast from 'react-hot-toast'
import ReportPreviewModal from '@/components/modals/ReportPreviewModal'

export default function ManagerDashboard({ data }: { data: DashboardData }) {
  const { users, projects, sprints, tickets } = data
  const activeSprint = sprints.find(s => s.status === 'ACTIVE')
  const today = new Date()
  const delayed = tickets.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'CLOSED')
  const pendingApprovals = tickets.filter(t => t.testerApproved && !t.managerApproved && t.status !== 'CLOSED')
  const [selectedReport, setSelectedReport] = useState<{ title: string; type: string; data?: any } | null>(null)

  const handleOpenReport = (type: string) => {
    let reportData = {}
    if (type === 'Team Utilization Report') {
      reportData = {
        usersCount: users.length,
        utilization: users.slice(0, 6).map(u => {
          const count = tickets.filter(t => t.assignee?.id === u.id).length
          const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0
          return [u.firstName + ' ' + (u.lastName || ''), u.role || 'Team Member', `${count} tickets`, `${pct}%`]
        })
      }
    } else if (type === 'Productivity Report') {
      const closedCount = tickets.filter(t => t.status === 'CLOSED').length
      reportData = {
        completedTickets: closedCount || 12
      }
    }
    setSelectedReport({ title: type, type, data: reportData })
  }

  const workload = users.slice(0, 7).map((u) => ({
    name: u.firstName,
    tickets: tickets.filter(t => t.assignee?.id === u.id).length,
  }))

  const handleApprove = async (id: number) => {
    try { await approveManager(id); toast.success('Manager approval granted ✅') }
    catch { toast.error('Approval failed') }
  }

  const getUtil = (uId: number) => {
    const userTix = tickets.filter(t => t.assignee?.id === uId)
    const openUserTix = userTix.filter(t => t.status !== 'CLOSED')
    return Math.min(100, openUserTix.length * 25)
  }

  return (
    <>
      {/* Top: Team KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Team Members" value={users.length} sub="registered resources" trend="flat" accent="#2563EB" />
        <KpiCard label="Active Projects" value={projects.filter(p => p.status === 'ACTIVE').length} sub={`of ${projects.length} workspace projects`} trend="up" accent="#059669" />
        <KpiCard label="Sprint Completion" value={`${activeSprint?.progressPercent ?? 0}%`} sub={activeSprint?.name || 'no active sprint'} trend="up" accent="#7C3AED" />
        <KpiCard label="Delayed Tasks" value={delayed.length} sub="past target dates" trend={delayed.length ? 'down' : 'flat'} accent="#DC2626" />
      </div>

      {/* Main Grid: Left (Resource Load), Center (Workload Matrix), Right (Approval Queue) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 items-start">
        
        {/* Left: Resource Utilization */}
        <div className="lg:col-span-1">
          <Section title="Resource Utilization" sub="Active workload per developer">
            <div className="space-y-1">
              {users.slice(0, 6).map((u) => {
                const util = getUtil(u.id)
                const color = util > 80 ? '#DC2626' : util > 60 ? '#2563EB' : '#059669'
                return <ProgressRow key={u.id} label={u.firstName} pct={util} color={color} avatarColor={u.avatarColor} avatarText={u.initials} />
              })}
            </div>
          </Section>
        </div>

        {/* Center: Team Workload Matrix */}
        <div className="lg:col-span-2">
          <Section title="Team Workload Distribution" sub="Assigned tickets aggregated by team member">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={workload} barSize={20}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="tickets" fill="#7C3AED" radius={[3, 3, 0, 0]} name="Assigned Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* Right: Approval Queue */}
        <div className="lg:col-span-1">
          <Section title="Sign-off Approvals" sub={`${pendingApprovals.length} pending manager sign-off`}>
            {pendingApprovals.length === 0 && <EmptyRow text="No approvals pending verification 🎉" type="approvals" />}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {pendingApprovals.map(t => (
                <div key={t.id} className="flex flex-col gap-1.5 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="flex justify-between items-center">
                    <Link to={`/tickets/${t.id}`} className="text-[9.5px] font-mono font-bold text-blue-600 hover:underline">{t.ticketKey}</Link>
                    <span className="tag tag-green text-[8px]">TESTER APPROVED</span>
                  </div>
                  <Link to={`/tickets/${t.id}`} className="text-xs font-semibold text-slate-700 truncate hover:text-blue-600">{t.title}</Link>
                  <button onClick={() => handleApprove(t.id)} className="btn-primary text-[10px] w-full justify-center py-1 mt-1">✓ Approve & Close</button>
                </div>
              ))}
            </div>
          </Section>
        </div>

      </div>

      {/* Bottom: Productivity Reports */}
      <Section title="Productivity & Delivery Audits" sub="Select reports to view and download official system documents">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-sm bg-slate-50/50 border border-slate-200 rounded-lg p-3">
            <h4 className="text-[12px] font-bold text-slate-700 mb-1">Developer Velocity</h4>
            <p className="text-[10px] text-slate-400 mb-3">Analysis of completed points per resource.</p>
            <button onClick={() => handleOpenReport('Productivity Report')} className="btn-secondary w-full justify-center text-[11px] py-1.5">📊 Productivity Report</button>
          </div>
          <div className="card-sm bg-slate-50/50 border border-slate-200 rounded-lg p-3">
            <h4 className="text-[12px] font-bold text-slate-700 mb-1">Workload Allocation</h4>
            <p className="text-[10px] text-slate-400 mb-3">Resource loading and bottleneck analysis.</p>
            <button onClick={() => handleOpenReport('Team Utilization Report')} className="btn-secondary w-full justify-center text-[11px] py-1.5">👥 Team Utilization Report</button>
          </div>
          <div className="card-sm bg-slate-50/50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <h4 className="text-[12px] font-bold text-slate-700 mb-1">Full Reporting Dashboard</h4>
              <p className="text-[10px] text-slate-400 mb-3">Access defect, burn-down, and velocity analytics.</p>
            </div>
            <Link to="/reports" className="btn-primary w-full justify-center text-[11px] py-1.5">Open Full Reports →</Link>
          </div>
        </div>
      </Section>

      {selectedReport && (
        <ReportPreviewModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          reportTitle={selectedReport.title}
          reportType={selectedReport.type}
          data={selectedReport.data}
        />
      )}
    </>
  )
}
