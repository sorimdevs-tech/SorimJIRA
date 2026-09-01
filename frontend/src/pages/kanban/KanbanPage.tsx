import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProjects } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { getTicketsBySprint, updateStatus } from '@/api/tickets'
import { Project, Sprint, Ticket, TicketStatus } from '@/types'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Filter,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Zap,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Flame,
  ArrowRight,
  FolderKanban,
  X
} from 'lucide-react'
import CreateTicketModal from '@/components/modals/CreateTicketModal'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { wsClient } from '@/utils/websocket'

interface ColumnDef {
  key: TicketStatus
  label: string
  icon: string
  color: string
  badgeClass: string
  borderClass: string
  bgClass: string
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'TODO',
    label: 'To Do',
    icon: '📋',
    color: '#64748B',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    borderClass: 'border-slate-200',
    bgClass: 'bg-slate-50/70',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    icon: '⚡',
    color: '#3B82F6',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-200/80',
    bgClass: 'bg-blue-50/20',
  },
  {
    key: 'IN_REVIEW',
    label: 'In Review',
    icon: '🔍',
    color: '#F59E0B',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    borderClass: 'border-amber-200/80',
    bgClass: 'bg-amber-50/20',
  },
  {
    key: 'TESTING',
    label: 'QA / Testing',
    icon: '🧪',
    color: '#8B5CF6',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    borderClass: 'border-purple-200/80',
    bgClass: 'bg-purple-50/20',
  },
  {
    key: 'CLOSED',
    label: 'Completed',
    icon: '✅',
    color: '#10B981',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    borderClass: 'border-emerald-200/80',
    bgClass: 'bg-emerald-50/20',
  },
]

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { label: 'Critical', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  HIGH:     { label: 'High',     bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  MEDIUM:   { label: 'Medium',   bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  LOW:      { label: 'Low',      bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
}

export default function KanbanPage() {
  const { sprintId } = useParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints]   = useState<Sprint[]>([])
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [selProject, setSelProject] = useState(0)
  const [selSprint, setSelSprint]   = useState(parseInt(sprintId || '0'))
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TicketStatus | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  const user = useSelector((s: RootState) => s.auth.user)
  const isDevOrTester = user && ['DEVELOPER', 'TESTER'].includes(user.role)

  const fetchTickets = () => {
    if (selSprint) getTicketsBySprint(selSprint).then(setTickets).catch(() => {})
  }

  useEffect(() => {
    getProjects().then(ps => {
      setProjects(ps)
      if (!selProject && ps.length) setSelProject(ps[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selProject) {
      getSprintsByProject(selProject).then(ss => {
        setSprints(ss)
        if (!selSprint && ss.length) {
          setSelSprint(ss.find((s: Sprint) => s.status === 'ACTIVE')?.id || ss[0].id)
        }
      }).catch(() => {})
    }
  }, [selProject])

  useEffect(() => {
    fetchTickets()
    
    const handleTicketUpdate = () => {
      fetchTickets()
    }
    window.addEventListener('ticket-updated', handleTicketUpdate)

    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'TICKET_UPDATED') {
        fetchTickets()
      }
    })

    return () => {
      window.removeEventListener('ticket-updated', handleTicketUpdate)
      unsubscribe()
    }
  }, [selSprint])

  const currentSprintObj = useMemo(() => {
    return sprints.find(s => s.id === selSprint)
  }, [sprints, selSprint])

  const currentProjectObj = useMemo(() => {
    return projects.find(p => p.id === selProject)
  }, [projects, selProject])

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ticketKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.assignee && t.assignee.fullName.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter
      return matchSearch && matchPriority
    })
  }, [tickets, searchQuery, priorityFilter])

  // Total sprint story points calculation
  const totalStoryPoints = useMemo(() => {
    return tickets.reduce((acc, t) => acc + (t.storyPoints || 0), 0)
  }, [tickets])

  const completedStoryPoints = useMemo(() => {
    return tickets
      .filter(t => t.status === 'CLOSED')
      .reduce((acc, t) => acc + (t.storyPoints || 0), 0)
  }, [tickets])

  const sprintProgressPercent = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0

  const handleDrop = async (e: React.DragEvent, targetStatus: TicketStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    if (!dragging) return

    if (isDevOrTester && (!currentSprintObj || currentSprintObj.status !== 'ACTIVE')) {
      toast.error('Developers and Testers can only work on tickets in active sprints')
      setDragging(null)
      return
    }

    try {
      await updateStatus(dragging, { status: targetStatus })
      setTickets(prev => prev.map(t => t.id === dragging ? { ...t, status: targetStatus } : t))
      toast.success(`Moved ticket to ${targetStatus.replace('_', ' ')}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update ticket status')
    }
    setDragging(null)
  }

  return (
    <div className="page-container space-y-6">
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              {currentProjectObj?.projectKey || 'BOARD'}
            </span>
            {currentSprintObj && (
              <span className={`tag text-[10px] ${currentSprintObj.status === 'ACTIVE' ? 'tag-green' : 'tag-gray'}`}>
                {currentSprintObj.status === 'ACTIVE' ? '● ACTIVE SPRINT' : currentSprintObj.status}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Kanban Board
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentProjectObj?.name || 'Project'} · {currentSprintObj?.name || 'Sprint Backlog'}
          </p>
        </div>

        {/* Project & Sprint Switcher + Create Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Project:</span>
            <select
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-2 cursor-pointer max-w-[160px] truncate"
              value={selProject}
              onChange={e => setSelProject(parseInt(e.target.value))}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.emoji || '📁'} {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Sprint:</span>
            <select
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-2 cursor-pointer max-w-[160px] truncate"
              value={selSprint}
              onChange={e => setSelSprint(parseInt(e.target.value))}
            >
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowTicketModal(true)}
            className="btn-primary text-xs py-2 px-4 shadow-sm"
          >
            <Plus size={14} />
            <span>Create Issue</span>
          </button>
        </div>
      </div>

      {/* ── Sprint Velocity & Filter Strip ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Sprint Goal & Progress Summary */}
        <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Sprint Goal:</span>
              <span className="text-xs text-slate-600 font-medium">
                {currentSprintObj?.goal || 'Deliver committed sprint backlog items on schedule.'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>{completedStoryPoints} of {totalStoryPoints} Story Points completed</span>
              <span>•</span>
              <span>{tickets.length} total tickets</span>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${sprintProgressPercent}%` }}
              />
            </div>
            <span className="text-xs font-extrabold text-indigo-600">{sprintProgressPercent}%</span>
          </div>
        </div>

        {/* Quick Search & Priority Filters */}
        <div className="lg:col-span-5 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-900 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5">Priority:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-1 cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 5 Full-Width Responsive Kanban Columns ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4.5 w-full items-start">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.key)
          const isOver = dragOverCol === col.key

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-2xl p-3.5 border transition-all duration-200 min-h-[520px] ${
                col.bgClass
              } ${isOver ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/30' : col.borderClass}`}
              onDragOver={e => {
                e.preventDefault()
                setDragOverCol(col.key)
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{col.icon}</span>
                  <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                    {col.label}
                  </span>
                </div>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${col.badgeClass}`}>
                  {colTickets.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
                {colTickets.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-slate-200/90 text-center">
                    <span className="text-lg mb-1 opacity-40">{col.icon}</span>
                    <p className="text-xs font-semibold text-slate-400">No issues</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Drag tickets here</p>
                  </div>
                ) : (
                  colTickets.map(t => {
                    const pConfig = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM
                    return (
                      <Link
                        key={t.id}
                        to={`/tickets/${t.id}`}
                        draggable
                        onDragStart={() => setDragging(t.id)}
                        className="group bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing block relative select-none"
                      >
                        {/* Top Key & Priority Strip */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {t.ticketKey}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${pConfig.bg} ${pConfig.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} />
                            {pConfig.label}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 mb-3">
                          {t.title}
                        </h4>

                        {/* Approvals Indicators */}
                        {(t.testerApproved || t.managerApproved) && (
                          <div className="flex flex-wrap gap-1 mb-2.5">
                            {t.testerApproved && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                <CheckCircle2 size={10} /> QA Approved
                              </span>
                            )}
                            {t.managerApproved && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                <CheckCircle2 size={10} /> Mgr Approved
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card Bottom Meta */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-slate-600 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                              <Zap size={10} className="text-amber-500" />
                              {t.storyPoints || 1} SP
                            </span>
                            {t.dueDate && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Calendar size={10} />
                                {t.dueDate}
                              </span>
                            )}
                          </div>

                          {t.assignee ? (
                            <div
                              className="avatar w-6 h-6 text-[9px] shadow-sm flex items-center justify-center font-bold"
                              style={{ background: t.assignee.avatarColor || '#3B82F6' }}
                              title={`Assigned to: ${t.assignee.fullName}`}
                            >
                              {t.assignee.initials}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
        <ArrowRight size={13} className="text-slate-400" />
        <span>Drag and drop cards between stages to update ticket lifecycle status</span>
      </div>

      <CreateTicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onCreated={fetchTickets}
        defaultProjectId={selProject}
        defaultSprintId={selSprint}
      />
    </div>
  )
}
