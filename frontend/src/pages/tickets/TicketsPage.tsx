import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getProjects } from '@/api/projects'
import { getTicketsByProject, deleteTicket } from '@/api/tickets'
import { getSprintsByProject } from '@/api/sprints'
import { Project, Ticket, Sprint, TicketStatus } from '@/types'
import {
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Zap,
  Calendar,
  Layers,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Flame,
  Activity,
  X,
  FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import { wsClient } from '@/utils/websocket'
import CreateTicketModal from '@/components/modals/CreateTicketModal'
import { KpiCard } from '@/components/dashboard/shared'

const STATUS_THEME: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  TODO:        { label: 'To Do',       bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  IN_REVIEW:   { label: 'In Review',   bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  TESTING:     { label: 'QA / Testing',bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  COMPLETED:   { label: 'Completed',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CLOSED:      { label: 'Closed',      bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

const PRIORITY_THEME: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { label: 'Critical', bg: 'bg-rose-50',  text: 'text-rose-700',  dot: 'bg-rose-500' },
  HIGH:     { label: 'High',     bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  MEDIUM:   { label: 'Medium',   bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  LOW:      { label: 'Low',      bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
}

export default function TicketsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [sprints, setSprints]   = useState<Sprint[]>([])
  const [selProject, setSelProject] = useState(0)
  const [sprintFilter, setSprintFilter] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selProject)
  }, [projects, selProject])

  const handleDeleteTicket = async (id: number, key: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ticket ${key}?`)) return
    try {
      await deleteTicket(id)
      setTickets(prev => prev.filter(t => t.id !== id))
      toast.success(`Ticket ${key} deleted successfully! 🗑️`)
    } catch {
      toast.error('Failed to delete ticket')
    }
  }

  const fetchTicketsAndSprints = () => {
    if (selProject) {
      setLoading(true)
      Promise.all([
        getTicketsByProject(selProject),
        getSprintsByProject(selProject).catch(() => [])
      ]).then(([tix, sps]) => {
        setTickets(tix)
        setSprints(sps)
      }).finally(() => {
        setLoading(false)
      })
    }
  }

  useEffect(() => {
    getProjects().then(ps => {
      setProjects(ps)
      if (ps.length && !selProject) {
        setSelProject(ps[0].id)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchTicketsAndSprints()
    setSprintFilter('')
  }, [selProject])

  useEffect(() => {
    if (!selProject) return
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'TICKET_UPDATED' || evt.type === 'SPRINT_UPDATED') {
        fetchTicketsAndSprints()
      }
    })
    return () => unsubscribe()
  }, [selProject])

  // Computed metrics
  const totalCount = tickets.length
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS' || t.status === 'TODO').length
  const testingCount = tickets.filter(t => t.status === 'TESTING' || t.status === 'IN_REVIEW').length
  const closedCount = tickets.filter(t => t.status === 'CLOSED' || t.status === 'COMPLETED').length
  const totalStoryPoints = tickets.reduce((acc, t) => acc + (t.storyPoints || 0), 0)

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.ticketKey.toLowerCase().includes(search.toLowerCase()) ||
        (t.assignee && t.assignee.fullName.toLowerCase().includes(search.toLowerCase()))

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'TODO' && t.status === 'TODO') ||
        (statusFilter === 'IN_PROGRESS' && t.status === 'IN_PROGRESS') ||
        (statusFilter === 'TESTING' && (t.status === 'TESTING' || t.status === 'IN_REVIEW')) ||
        (statusFilter === 'CLOSED' && (t.status === 'CLOSED' || t.status === 'COMPLETED')) ||
        t.status === statusFilter

      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter
      const matchSprint = sprintFilter === '' || t.sprintId === sprintFilter

      return matchSearch && matchStatus && matchPriority && matchSprint
    })
  }, [tickets, search, statusFilter, priorityFilter, sprintFilter])

  return (
    <div className="page-container space-y-6">
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              {currentProject?.projectKey || 'ISSUES'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {filteredTickets.length} of {tickets.length} total issues
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Ticket Backlog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentProject?.name || 'Project'} · Issue tracking, QA approvals, and backlog management
          </p>
        </div>

        {/* Project Selector & Create Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Project:</span>
            <select
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-2 cursor-pointer max-w-[180px] truncate"
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

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-2 px-4 shadow-sm"
          >
            <Plus size={14} />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Deck ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer transition-all duration-200 ${statusFilter === 'ALL' ? 'ring-2 ring-indigo-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Total Backlog"
            value={totalCount}
            sub={`${totalStoryPoints} Total Story Points`}
            trend="up"
            accent="#6366F1"
            icon={<FileText size={18} />}
          />
        </div>

        <div
          onClick={() => setStatusFilter('IN_PROGRESS')}
          className={`cursor-pointer transition-all duration-200 ${statusFilter === 'IN_PROGRESS' ? 'ring-2 ring-blue-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="In Development"
            value={inProgressCount}
            sub="Active work in progress"
            trend="up"
            accent="#3B82F6"
            icon={<Zap size={18} />}
          />
        </div>

        <div
          onClick={() => setStatusFilter('TESTING')}
          className={`cursor-pointer transition-all duration-200 ${statusFilter === 'TESTING' ? 'ring-2 ring-purple-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Review & QA"
            value={testingCount}
            sub="Awaiting tester & manager sign-off"
            trend="flat"
            accent="#8B5CF6"
            icon={<ShieldCheck size={18} />}
          />
        </div>

        <div
          onClick={() => setStatusFilter('CLOSED')}
          className={`cursor-pointer transition-all duration-200 ${statusFilter === 'CLOSED' ? 'ring-2 ring-emerald-500 rounded-2xl' : ''}`}
        >
          <KpiCard
            label="Closed & Verified"
            value={closedCount}
            sub="Completed & approved"
            trend="up"
            accent="#10B981"
            icon={<CheckCircle2 size={18} />}
          />
        </div>
      </div>

      {/* ── Search & Filter Controls Bar ───────────────────────────────────── */}
      <div className="card !p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets by title, key, assignee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-900 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Quick Filter Buttons & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                statusFilter === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('TESTING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                statusFilter === 'TESTING' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              QA Testing
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border-0 ${
                statusFilter === 'CLOSED' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 bg-transparent'
              }`}
            >
              Closed
            </button>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Priority:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-2 cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Sprint Filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Sprint:</span>
            <select
              value={sprintFilter}
              onChange={e => setSprintFilter(e.target.value ? Number(e.target.value) : '')}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-2 cursor-pointer max-w-[140px] truncate"
            >
              <option value="">All Sprints</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tickets Table ──────────────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Issue Key</th>
                <th className="py-3.5 px-4">Title & Details</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4">Points</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm text-slate-700">No tickets found</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the search query or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => {
                  const sTheme = STATUS_THEME[t.status] || STATUS_THEME.TODO
                  const pTheme = PRIORITY_THEME[t.priority] || PRIORITY_THEME.MEDIUM

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Key */}
                      <td className="py-3.5 px-5">
                        <Link
                          to={`/tickets/${t.id}`}
                          className="font-mono font-bold text-xs text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-100 transition-colors inline-block"
                        >
                          {t.ticketKey}
                        </Link>
                      </td>

                      {/* Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/tickets/${t.id}`}
                          className="font-bold text-slate-900 text-xs hover:text-indigo-600 transition-colors block truncate"
                        >
                          {t.title}
                        </Link>
                        {t.sprintName && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Layers size={10} /> {t.sprintName}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sTheme.bg} ${sTheme.text} border-slate-200/60`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sTheme.dot}`} />
                          {sTheme.label}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${pTheme.bg} ${pTheme.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pTheme.dot}`} />
                          {pTheme.label}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4">
                        {t.assignee ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="avatar w-6 h-6 text-[8px] flex-shrink-0 font-bold shadow-sm"
                              style={{ background: t.assignee.avatarColor || '#3B82F6' }}
                            >
                              {t.assignee.initials}
                            </div>
                            <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                              {t.assignee.fullName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Story Points */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-extrabold bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                          <Zap size={11} className="text-amber-500" />
                          {t.storyPoints || 1} SP
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {t.dueDate ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {t.dueDate}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No due date</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/tickets/${t.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-block"
                            title="View ticket details"
                          >
                            <ExternalLink size={14} />
                          </Link>

                          <button
                            onClick={() => handleDeleteTicket(t.id, t.ticketKey)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border-0 bg-transparent cursor-pointer"
                            title="Delete ticket"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchTicketsAndSprints}
        defaultProjectId={selProject}
      />
    </div>
  )
}
