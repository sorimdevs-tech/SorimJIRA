import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getUsers } from '@/api/users'
import { getProjects } from '@/api/projects'
import { getTicketsByProject } from '@/api/tickets'
import { User, Ticket, Project } from '@/types'
import { wsClient } from '@/utils/websocket'
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  Layers,
  Clock,
  Mail,
  Zap,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Building,
  UserCheck,
  TrendingUp,
  X
} from 'lucide-react'
import { RoleTag, KpiCard } from '@/components/dashboard/shared'

export default function ResourcesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'OVERLOADED' | 'OPTIMAL' | 'AVAILABLE' | 'ONLINE'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)

  const fetchTickets = async () => {
    try {
      const projs = await getProjects()
      const tixPromises = projs.map((p: Project) => getTicketsByProject(p.id).catch(() => []))
      const allTix = (await Promise.all(tixPromises)).flat()
      setTickets(allTix)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const usrs = await getUsers()
        setUsers(usrs)
        await fetchTickets()
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()

    const unsubscribe = wsClient.subscribe((data) => {
      if (data.type === 'USER_LOGIN') {
        setUsers(prev => prev.map(usr => usr.email === data.user ? { ...usr, active: true } : usr))
      } else if (data.type === 'USER_LOGOUT') {
        setUsers(prev => prev.map(usr => usr.email === data.user ? { ...usr, active: false } : usr))
      } else if (
        data.type === 'TICKET_UPDATED' ||
        data.type === 'TICKET_CREATED' ||
        data.type === 'TICKET_DELETED' ||
        data.type === 'PROJECT_UPDATED'
      ) {
        fetchTickets()
      }
    })

    return () => unsubscribe()
  }, [])

  const getUserUtilization = (uId: number) => {
    const userTix = tickets.filter(t => t.assignee?.id === uId)
    const openUserTix = userTix.filter(t => t.status !== 'CLOSED')
    return Math.min(100, openUserTix.length * 25)
  }

  const getUserTasks = (uId: number) => {
    return tickets.filter(t => t.assignee?.id === uId)
  }

  const getUserStoryPoints = (uId: number) => {
    const userTix = tickets.filter(t => t.assignee?.id === uId && t.status !== 'CLOSED')
    return userTix.reduce((sum, t) => sum + (t.storyPoints || 0), 0)
  }

  // Summary Metrics
  const avgUtilization = users.length
    ? Math.round(users.reduce((acc, u) => acc + getUserUtilization(u.id), 0) / users.length)
    : 0

  const overloadedCount = users.filter(u => getUserUtilization(u.id) > 80).length
  const availableCount = users.filter(u => getUserUtilization(u.id) <= 20).length
  const optimalCount = users.filter(u => {
    const util = getUserUtilization(u.id)
    return util > 20 && util <= 80
  }).length
  const onlineCount = users.filter(u => u.active).length

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const util = getUserUtilization(u.id)
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.position && u.position.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesRole = selectedRole === 'ALL' || u.role === selectedRole

      let matchesFilter = true
      if (filter === 'OVERLOADED') matchesFilter = util > 80
      else if (filter === 'OPTIMAL') matchesFilter = util > 20 && util <= 80
      else if (filter === 'AVAILABLE') matchesFilter = util <= 20
      else if (filter === 'ONLINE') matchesFilter = Boolean(u.active)

      return matchesSearch && matchesRole && matchesFilter
    })
  }, [users, tickets, searchQuery, selectedRole, filter])

  // AI Insight Text
  const aiInsightText = useMemo(() => {
    if (overloadedCount > 0) {
      const names = users.filter(u => getUserUtilization(u.id) > 80).map(u => u.fullName).join(', ')
      return `Capacity Warning: ${names} ${overloadedCount === 1 ? 'is' : 'are'} operating at >80% capacity. Reassigning upcoming sprint tickets to available members will prevent sprint bottlenecks.`
    }
    return `Team capacity is well-balanced across all engineering departments. ${availableCount} members are currently ready to pick up new backlog tasks.`
  }, [overloadedCount, availableCount, users, tickets])

  if (loading) {
    return (
      <div className="page-container flex flex-col items-center justify-center py-24">
        <div className="spinner mb-3" style={{ width: 28, height: 28 }} />
        <span className="text-xs text-slate-500 font-semibold">Calculating team workload & utilization...</span>
      </div>
    )
  }

  return (
    <div className="page-container space-y-6">
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              WORKLOAD MATRIX
            </span>
            <span className="tag tag-green">● Real-time Synced</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Resource Allocation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Team bandwidth, capacity distribution, and sprint workload utilization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            👥 {users.length} Team Members
          </span>
        </div>
      </div>

      {/* ── KPI Metric Deck ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setFilter('ALL')}
          className={`cursor-pointer transition-all duration-200 ${filter === 'ALL' ? 'ring-2 ring-indigo-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Total Personnel"
            value={users.length}
            sub={`${onlineCount} currently active`}
            trend="up"
            accent="#6366F1"
            icon={<Users size={18} />}
          />
        </div>

        <div
          onClick={() => setFilter('ALL')}
          className="transition-all duration-200"
        >
          <KpiCard
            label="Avg Utilization"
            value={`${avgUtilization}%`}
            sub="Optimal target: 60-80%"
            trend={avgUtilization > 80 ? 'down' : 'up'}
            accent="#0EA5E9"
            icon={<Activity size={18} />}
          />
        </div>

        <div
          onClick={() => setFilter('OVERLOADED')}
          className={`cursor-pointer transition-all duration-200 ${filter === 'OVERLOADED' ? 'ring-2 ring-rose-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Overloaded (>80%)"
            value={overloadedCount}
            sub={overloadedCount === 0 ? 'No workload bottlenecks' : 'Requires re-allocation'}
            trend={overloadedCount === 0 ? 'up' : 'down'}
            accent="#EF4444"
            icon={<AlertTriangle size={18} />}
          />
        </div>

        <div
          onClick={() => setFilter('AVAILABLE')}
          className={`cursor-pointer transition-all duration-200 ${filter === 'AVAILABLE' ? 'ring-2 ring-emerald-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Available (<20%)"
            value={availableCount}
            sub="Ready for task intake"
            trend="up"
            accent="#10B981"
            icon={<UserCheck size={18} />}
          />
        </div>
      </div>

      {/* ── AI Workload Intelligence Banner ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                AI Capacity Intelligence & Recommendation
              </h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                Live Insights
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
              {aiInsightText}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="card !p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search member by name, email, department, position..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-900 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                filter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilter('OVERLOADED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                filter === 'OVERLOADED' ? 'bg-rose-50 text-rose-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              🔥 Overloaded ({overloadedCount})
            </button>
            <button
              onClick={() => setFilter('OPTIMAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                filter === 'OPTIMAL' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              ⚡ Optimal ({optimalCount})
            </button>
            <button
              onClick={() => setFilter('AVAILABLE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                filter === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              🌱 Available ({availableCount})
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Role:</span>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-2 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SCRUM_MASTER">Scrum Master</option>
              <option value="PROJECT_OWNER">Project Owner</option>
              <option value="CTO">CTO</option>
              <option value="VP">VP</option>
              <option value="MANAGER">Manager</option>
              <option value="DEVELOPER">Developer</option>
              <option value="TESTER">Tester</option>
              <option value="TRAINEE">Trainee</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Resource Allocation Table ───────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Team Member</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Open Tasks</th>
                <th className="py-3.5 px-4" style={{ minWidth: '220px' }}>Bandwidth & Capacity</th>
                <th className="py-3.5 px-4">Availability</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm text-slate-700">No resources match your filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the search keyword or workload filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const util = getUserUtilization(u.id)
                  const userTasksList = getUserTasks(u.id)
                  const openTasks = userTasksList.filter(t => t.status !== 'CLOSED')
                  const storyPoints = getUserStoryPoints(u.id)
                  const isExpanded = expandedUserId === u.id

                  const progressColor =
                    util > 80
                      ? 'bg-rose-500'
                      : util > 50
                      ? 'bg-blue-500'
                      : util > 20
                      ? 'bg-indigo-500'
                      : 'bg-emerald-500'

                  const statusBadge =
                    util > 80
                      ? { label: 'Overloaded', bg: 'bg-rose-50 text-rose-700 border-rose-200' }
                      : util > 50
                      ? { label: 'Busy', bg: 'bg-blue-50 text-blue-700 border-blue-200' }
                      : util > 20
                      ? { label: 'Optimal', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
                      : { label: 'Available', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${
                          isExpanded ? 'bg-slate-50/80' : ''
                        }`}
                        onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                      >
                        {/* Member Name + Department */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className="avatar w-9 h-9 text-xs flex-shrink-0 font-bold shadow-sm"
                              style={{ background: u.avatarColor || '#2563EB' }}
                            >
                              {u.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                                {u.fullName}
                                {u.active && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                                )}
                              </div>
                              <div className="text-slate-400 text-xs font-mono truncate mt-0.5">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Tag */}
                        <td className="py-3.5 px-4">
                          <RoleTag role={u.role} />
                        </td>

                        {/* Open Tasks */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800 text-sm">
                              {openTasks.length}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              ({storyPoints} SP)
                            </span>
                          </div>
                        </td>

                        {/* Capacity Meter */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                style={{ width: `${util}%` }}
                              />
                            </div>
                            <span className="text-xs font-extrabold w-10 text-right text-slate-800">
                              {util}%
                            </span>
                          </div>
                        </td>

                        {/* Workload Status */}
                        <td className="py-3.5 px-4">
                          <span className={`tag ${statusBadge.bg}`}>
                            {statusBadge.label}
                          </span>
                        </td>

                        {/* Expand / View Details Button */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedUserId(isExpanded ? null : u.id)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all border-0 bg-transparent cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                          >
                            <span>{openTasks.length} tasks</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Task Inspector Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={6} className="p-4 pl-16">
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                  <Layers size={13} className="text-indigo-600" />
                                  <span>Assigned Active Tasks for {u.fullName}</span>
                                </h4>
                                <span className="text-xs text-slate-500 font-medium">
                                  {openTasks.length} open issues · {storyPoints} Story Points
                                </span>
                              </div>

                              {openTasks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  No active tickets currently assigned. This member is completely free for new assignments.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                  {openTasks.map(t => (
                                    <Link
                                      key={t.id}
                                      to={`/tickets/${t.id}`}
                                      className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 hover:border-indigo-300 hover:bg-white transition-all block group"
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                                          {t.ticketKey}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500">
                                          {t.status.replace('_', ' ')}
                                        </span>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 truncate">
                                        {t.title}
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                                        <span className="flex items-center gap-0.5">
                                          <Zap size={10} className="text-amber-500" /> {t.storyPoints || 1} SP
                                        </span>
                                        {t.dueDate && (
                                          <span className="flex items-center gap-0.5">
                                            <Clock size={10} /> {t.dueDate}
                                          </span>
                                        )}
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
