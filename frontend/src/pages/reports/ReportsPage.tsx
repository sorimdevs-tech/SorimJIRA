import { useEffect, useState } from 'react'
import { getProjects } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { getTicketsByProject } from '@/api/tickets'
import { Project, Sprint, Ticket } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import ReportPreviewModal from '@/components/modals/ReportPreviewModal'
import { wsClient } from '@/utils/websocket'

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedReport, setSelectedReport] = useState<{ title: string; type: string; data?: any } | null>(null)

  const loadData = async () => {
    try {
      const ps = await getProjects()
      setProjects(ps)
      if (ps.length) {
        const sprs = await getSprintsByProject(ps[0].id)
        setSprints(sprs)
        const tix = await getTicketsByProject(ps[0].id)
        setTickets(tix)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()

    const unsubscribe = wsClient.subscribe((data) => {
      if (
        data.type === 'TICKET_UPDATED' ||
        data.type === 'TICKET_CREATED' ||
        data.type === 'TICKET_DELETED' ||
        data.type === 'SPRINT_UPDATED' ||
        data.type === 'PROJECT_UPDATED'
      ) {
        loadData()
      }
    })

    return () => unsubscribe()
  }, [])

  const velocity = sprints.map(s => ({ name: s.name.replace('Sprint ','S'), completed: s.completedPoints, capacity: s.capacityPoints }))
  
  const activeSprint = sprints.find(s => s.status === 'ACTIVE') || sprints[0]
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

  const priorityData = ['CRITICAL','HIGH','MEDIUM','LOW'].map(p => ({
    name: p, value: tickets.filter(t => t.priority === p).length
  })).filter(d => d.value > 0)
  const COLORS = ['#DC2626','#D97706','#2563EB','#94A3B8']

  const statusData = ['TODO','IN_PROGRESS','IN_REVIEW','TESTING','CLOSED'].map(s => ({
    name: s.replace('_',' '), count: tickets.filter(t => t.status === s).length
  }))

  const handleOpenReport = (type: string) => {
    let reportData = {}
    if (type === 'Sprint Report') {
      const currentSprint = sprints.find(s => s.status === 'ACTIVE') || sprints[0]
      reportData = {
        sprintName: currentSprint?.name || 'Sprint 3',
        completedPoints: currentSprint?.completedPoints || 0,
        capacity: currentSprint?.capacityPoints || 0,
        completionRate: currentSprint?.capacityPoints ? `${Math.round((currentSprint.completedPoints / currentSprint.capacityPoints) * 100)}%` : '0%',
        tickets: tickets.slice(0, 10).map(t => [
          t.ticketKey,
          t.title,
          t.priority,
          t.status,
          t.assignee?.firstName ? `${t.assignee.firstName} ${t.assignee.lastName || ''}` : 'Unassigned'
        ])
      }
    } else if (type === 'Velocity Report') {
      reportData = {
        sprintsCount: sprints.length,
        sprints: sprints.map(s => [
          s.name,
          `${s.capacityPoints} pts`,
          `${s.completedPoints} pts`,
          s.capacityPoints ? `${Math.round((s.completedPoints / s.capacityPoints) * 100)}%` : '0%'
        ])
      }
    } else if (type === 'Defect Report') {
      const defects = tickets.filter(t => t.title.toLowerCase().includes('bug') || t.title.toLowerCase().includes('defect') || t.priority === 'CRITICAL')
      reportData = {
        totalBugs: defects.length,
        criticalBugs: defects.filter(t => t.priority === 'CRITICAL').length,
        lowBugs: defects.filter(t => t.priority !== 'CRITICAL').length,
        defects: defects.slice(0, 6).map(t => [
          t.ticketKey,
          t.title,
          t.priority,
          new Date().toLocaleDateString(),
          t.status
        ])
      }
    } else if (type === 'Utilization Report') {
      // Group tickets by user
      const userWorkload = tickets.reduce((acc: any, t) => {
        if (t.assignee) {
          const name = `${t.assignee.firstName} ${t.assignee.lastName || ''}`
          acc[name] = (acc[name] || 0) + 1
        }
        return acc
      }, {})
      
      reportData = {
        usersCount: Object.keys(userWorkload).length,
        utilization: Object.entries(userWorkload).map(([name, count]: any) => {
          const utilRate = Math.min(100, count * 25)
          return [name, 'Team Member', `${count} tickets`, `${utilRate}%`]
        })
      }
    }

    setSelectedReport({
      title: type,
      type,
      data: reportData
    })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <div className="flex gap-2">
          {['Sprint Report','Velocity Report','Defect Report','Utilization Report'].map(r => (
            <button key={r} onClick={() => handleOpenReport(r)} className="btn-secondary text-[11px]">↓ {r}</button>
          ))}
        </div>
      </div>


      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="section-title mb-1">Burndown Chart — Active Sprint</div>
          <div className="text-[11px] text-slate-400 mb-3">Story points remaining vs ideal</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={burndown}>
              <XAxis dataKey="day" tick={{fontSize:10, fill:'#94A3B8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10, fill:'#94A3B8'}} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={{fontSize:11, borderRadius:6, border:'1px solid #E2E8F0'}} />
              <Line type="monotone" dataKey="ideal" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Ideal" />
              <Line type="monotone" dataKey="actual" stroke="#2563EB" strokeWidth={2.5} dot={{r:3}} name="Actual" />
              <Legend wrapperStyle={{fontSize:10}} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title mb-1">Velocity by Sprint</div>
          <div className="text-[11px] text-slate-400 mb-3">Completed vs capacity story points</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={velocity} barSize={18}>
              <XAxis dataKey="name" tick={{fontSize:10, fill:'#94A3B8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10, fill:'#94A3B8'}} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={{fontSize:11, borderRadius:6, border:'1px solid #E2E8F0'}} />
              <Bar dataKey="completed" fill="#2563EB" radius={[3,3,0,0]} name="Completed" />
              <Bar dataKey="capacity"  fill="#E2E8F0" radius={[3,3,0,0]} name="Capacity" />
              <Legend wrapperStyle={{fontSize:10}} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="section-title mb-3">Tickets by Priority</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                {priorityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{fontSize:11, borderRadius:6, border:'1px solid #E2E8F0'}} />
              <Legend wrapperStyle={{fontSize:10}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-title mb-3">Tickets by Status</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={statusData} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{fontSize:10, fill:'#94A3B8'}} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{fontSize:10, fill:'#64748B'}} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{fontSize:11, borderRadius:6, border:'1px solid #E2E8F0'}} />
              <Bar dataKey="count" fill="#7C3AED" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {selectedReport && (
        <ReportPreviewModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          reportTitle={selectedReport.title}
          reportType={selectedReport.type}
          data={selectedReport.data}
        />
      )}
    </div>
  )
}
