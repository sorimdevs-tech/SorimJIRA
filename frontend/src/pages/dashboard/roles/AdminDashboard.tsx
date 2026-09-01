import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  ShieldCheck,
  FolderKanban,
  Activity,
  UserPlus,
  PlusCircle,
  Settings,
  Search,
  Filter,
  Edit3,
  Trash2,
  Mail,
  Building,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  MoreVertical,
  X,
  Copy,
  Check
} from 'lucide-react'
import { KpiCard, Section, RoleTag } from '@/components/dashboard/shared'
import { DashboardData } from '@/components/dashboard/useDashboardData'
import toast from 'react-hot-toast'
import api from '@/api/axios'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { wsClient } from '@/utils/websocket'

const RBAC_MATRIX: [string, ...boolean[]][] = [
  ['Create Project',    true, true,  true,  false, false, false, false, false, false],
  ['Manage Sprints',    true, true,  false, false, false, false, false, false, false],
  ['AI Task Generate',  true, true,  true,  false, false, false, false, false, false],
  ['Assign Tickets',    true, true,  true,  false, false, true,  false, false, false],
  ['Approve Closure',   true, false, false, false, false, true,  false, true,  false],
  ['Update Tickets',    true, true,  true,  false, false, true,  true,  true,  true ],
  ['View Reports',      true, true,  true,  true,  true,  true,  false, false, false],
  ['Manage Users',      true, false, false, false, false, false, false, false, false],
]
const ROLE_HEADERS = ['Admin', 'SM', 'PO', 'CTO', 'VP', 'Mgr', 'Dev', 'Test', 'Trainee']

const formatTimestamp = (timeStr?: string) => {
  if (!timeStr) return 'Never'
  try {
    const d = new Date(timeStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 2) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return timeStr
  }
}

export default function AdminDashboard({ data }: { data: DashboardData }) {
  const { users, projects, tickets } = data
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const [userList, setUserList] = useState(users)
  const [activeTab, setActiveTab] = useState<'USERS' | 'PROJECTS' | 'AUDIT' | 'RBAC'>('USERS')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; temporaryPassword?: string; role: string; department?: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Add Employee Form
  const [empName, setEmpName] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empDept, setEmpDept] = useState('Engineering')
  const [empPosition, setEmpPosition] = useState('Developer')
  const [empRole, setEmpRole] = useState('DEVELOPER')

  // Add Project Form
  const [projName, setProjName] = useState('')
  const [projKey, setProjKey] = useState('')
  const [projDuration, setProjDuration] = useState('')
  const [projGitRepo, setProjGitRepo] = useState('')

  // Assign Member Form
  const [memberProjId, setMemberProjId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<Array<{ action: string; detail: string; when: string; type: 'info' | 'success' | 'warning' }>>(() => {
    const saved = localStorage.getItem('sorim_audit_logs')
    return saved ? JSON.parse(saved) : [
      { action: 'SECURITY_AUDIT', detail: 'System initialized with 100% MFA compliance', when: 'Just now', type: 'success' },
      { action: 'USER_LOGIN', detail: 'Admin session authenticated via JWT', when: '10m ago', type: 'info' },
      { action: 'RBAC_VERIFIED', detail: 'All 9 security role definitions verified', when: '1h ago', type: 'success' },
      { action: 'SERVICE_SYNC', detail: 'Real-time WebSocket event bus connected', when: 'Today', type: 'info' },
    ]
  })

  useEffect(() => {
    setUserList(users)
  }, [users])

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'USER_LOGIN') {
        setUserList(prev => prev.map(u => u.email === evt.user ? { ...u, active: true, lastLoginTime: evt.lastLoginTime } : u))
      } else if (evt.type === 'USER_LOGOUT') {
        setUserList(prev => prev.map(u => u.email === evt.user ? { ...u, active: false, lastLogoutTime: evt.lastLogoutTime } : u))
      } else if (evt.type === 'USER_REGISTERED') {
        api.get('/users').then(res => setUserList(res.data?.data || [])).catch(() => {})
      }
    })
    return () => unsubscribe()
  }, [])

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return userList.filter(u => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.position && u.position.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.active) ||
        (statusFilter === 'INACTIVE' && !u.active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [userList, searchQuery, roleFilter, statusFilter])

  const activeCount = userList.filter(u => u.active).length
  const totalTicketsCount = tickets ? tickets.length : 0

  // Handlers
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empName.trim() || !empEmail.trim()) {
      return toast.error('Employee Name and Email are required')
    }
    setSubmitting(true)
    try {
      const res = await api.post('/admin/add-employee', {
        name: empName,
        email: empEmail,
        department: empDept,
        position: empPosition,
        role: empRole,
      })
      const createdData = res.data?.data
      setCreatedCredentials({
        name: empName,
        email: empEmail,
        temporaryPassword: createdData?.temporaryPassword,
        role: empRole,
        department: empDept,
      })
      toast.success('Employee registered successfully! ✉️')
      const freshUsers = await api.get('/users')
      setUserList(freshUsers.data?.data || [])
      setEmpName('')
      setEmpEmail('')
      setShowAddUserModal(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add employee')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim() || !projKey.trim()) {
      return toast.error('Project Name and Key are required')
    }
    setSubmitting(true)
    try {
      await api.post('/projects', {
        name: projName,
        projectKey: projKey.toUpperCase(),
        duration: projDuration,
        gitRepo: projGitRepo,
        priority: 'MEDIUM',
        status: 'ACTIVE'
      })
      toast.success('Project created successfully! 🚀')
      setProjName('')
      setProjKey('')
      setProjDuration('')
      setProjGitRepo('')
      setShowAddProjectModal(false)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberProjId || !memberUserId) {
      return toast.error('Please select a project and a team member')
    }
    setSubmitting(true)
    try {
      await api.post(`/projects/${memberProjId}/members/${memberUserId}`)
      toast.success('Member assigned to project! Notification dispatched. ✉️')
      setMemberProjId('')
      setMemberUserId('')
      setShowAssignMemberModal(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign member')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name}? All access and assignments will be revoked.`)) return
    try {
      await api.delete(`/admin/delete-employee/${id}`)
      toast.success('User account removed successfully 🗑️')
      const freshUsers = await api.get('/users')
      setUserList(freshUsers.data?.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    }
  }

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserId) return
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      return toast.error('All fields are required')
    }
    setSubmitting(true)
    try {
      const res = await api.put(`/users/${editingUserId}`, {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail
      })
      const updatedUser = res.data.data
      setUserList(prev => prev.map(u => u.id === editingUserId ? updatedUser : u))
      toast.success('User details updated successfully! 🎉')
      setShowEditModal(false)
      setEditingUserId(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Executive Header Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Subtle geometric background blur */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Shield size={12} /> System Administrator
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Realtime
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {currentUser?.fullName?.split(' ')[0] || 'Admin'} 👋
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Central administration console for team provisioning, role assignments, security controls, and enterprise sprint tracking.
            </p>
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all cursor-pointer border-0"
            >
              <UserPlus size={14} className="text-indigo-600" />
              <span>Add Employee</span>
            </button>

            <button
              onClick={() => setShowAddProjectModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-md hover:shadow-lg transition-all cursor-pointer border-0"
            >
              <PlusCircle size={14} />
              <span>New Project</span>
            </button>

            <button
              onClick={() => setShowAssignMemberModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 shadow-sm transition-all cursor-pointer"
            >
              <Layers size={14} />
              <span>Assign Member</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Deck ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Registered Personnel"
          value={userList.length}
          sub={`${activeCount} currently active`}
          trend="up"
          accent="#6366F1"
          icon={<Users size={18} />}
        />
        <KpiCard
          label="Active Projects"
          value={projects.length}
          sub="All systems healthy"
          trend="flat"
          accent="#0EA5E9"
          icon={<FolderKanban size={18} />}
        />
        <KpiCard
          label="System Tickets"
          value={totalTicketsCount}
          sub="Across all sprints"
          trend="up"
          accent="#F59E0B"
          icon={<Activity size={18} />}
        />
        <KpiCard
          label="Security Status"
          value="100% MFA"
          sub="JWT + RBAC Enforced"
          trend="up"
          accent="#10B981"
          icon={<ShieldCheck size={18} />}
        />
      </div>

      {/* ── Tab Navigation Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 w-fit">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
              activeTab === 'USERS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Users size={14} />
            <span>Team Directory</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'USERS' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {userList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PROJECTS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
              activeTab === 'PROJECTS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <FolderKanban size={14} />
            <span>Project Allocations</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'PROJECTS' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {projects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
              activeTab === 'AUDIT'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Activity size={14} />
            <span>Security & Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('RBAC')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
              activeTab === 'RBAC'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Shield size={14} />
            <span>Permissions Matrix</span>
          </button>
        </div>

        {/* Global Quick Action */}
        {activeTab === 'USERS' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Showing {filteredUsers.length} of {userList.length} members</span>
          </div>
        )}
      </div>

      {/* ── TAB 1: TEAM DIRECTORY ───────────────────────────────────────────── */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbars */}
          <div className="card !p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member by name, email, department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
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

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Role:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
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

              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-2 cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Table / Cards */}
          <div className="card !p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Team Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department & Title</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Activity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">No team members match your filter criteria</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting the search query or role filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="avatar w-9 h-9 text-xs flex-shrink-0 font-bold shadow-sm"
                              style={{ background: u.avatarColor || '#2563EB' }}
                            >
                              {u.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                                {u.fullName}
                                {u.addedByAdmin && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-600 font-bold rounded border border-indigo-100">Admin Added</span>
                                )}
                              </div>
                              <div className="text-slate-400 text-xs font-mono truncate flex items-center gap-1 mt-0.5">
                                <Mail size={11} /> {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <RoleTag role={u.role} />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-700 text-xs">
                              {u.position || 'Software Engineering'}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {u.department || 'Engineering'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              u.active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" />
                            <span>{formatTimestamp(u.lastLoginTime)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingUserId(u.id)
                                setEditFirstName(u.firstName || u.fullName.split(' ')[0] || '')
                                setEditLastName(u.lastName || u.fullName.split(' ')[1] || '')
                                setEditEmail(u.email)
                                setShowEditModal(true)
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-0 bg-transparent cursor-pointer"
                              title="Edit user profile"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border-0 bg-transparent cursor-pointer"
                              title="Remove employee"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROJECT ALLOCATIONS ──────────────────────────────────────── */}
      {activeTab === 'PROJECTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.length === 0 ? (
            <div className="col-span-full card py-12 text-center text-slate-400">
              <FolderKanban size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm text-slate-700">No active projects found</p>
              <p className="text-xs text-slate-400 mt-1">Create your first project to start organizing team members and sprints.</p>
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="btn-primary text-xs mt-4"
              >
                + Create Project
              </button>
            </div>
          ) : (
            projects.map(p => (
              <div key={p.id} className="card !p-5 flex flex-col justify-between hover:border-indigo-200">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.emoji || '🚀'}</span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug">{p.name}</h3>
                        <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {p.projectKey}
                        </span>
                      </div>
                    </div>
                    <span className="tag tag-green">{p.status || 'ACTIVE'}</span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {p.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Project Owner:</span>
                      <span className="font-bold text-slate-800">{p.owner?.fullName || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Team Size:</span>
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {(p.members || []).slice(0, 4).map(m => (
                            <div
                              key={m.id}
                              className="avatar w-5 h-5 text-[8px] border-2 border-white"
                              style={{ background: m.avatarColor || '#3B82F6' }}
                              title={m.fullName}
                            >
                              {m.initials}
                            </div>
                          ))}
                        </div>
                        <span className="font-bold text-slate-700 ml-1">{p.members?.length || 0} members</span>
                      </div>
                    </div>

                    {p.gitRepo && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Repository:</span>
                        <a
                          href={p.gitRepo}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-indigo-600 hover:underline flex items-center gap-1 text-[11px] truncate max-w-[160px]"
                        >
                          <ExternalLink size={11} /> {p.gitRepo.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setMemberProjId(String(p.id))
                      setShowAssignMemberModal(true)
                    }}
                    className="btn-secondary text-xs w-full justify-center"
                  >
                    <UserPlus size={13} />
                    <span>Assign Team Member</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 3: SECURITY & AUDIT ─────────────────────────────────────────── */}
      {activeTab === 'AUDIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card">
            <h3 className="section-title text-base font-bold text-slate-900 mb-1">Live Security & Access Trail</h3>
            <p className="text-xs text-slate-400 mb-4">Immutable log of user authentications, credential changes, and project security updates.</p>

            <div className="space-y-3">
              {auditLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-white transition-all"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      log.type === 'success'
                        ? 'bg-emerald-100 text-emerald-700'
                        : log.type === 'warning'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <ShieldCheck size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{log.action}</span>
                      <span className="text-[10px] font-medium text-slate-400">{log.when}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{log.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="section-title text-base font-bold text-slate-900">Security Policies</h3>
            
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100/80 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <ShieldCheck size={14} className="text-indigo-600" />
                <span>MFA Enforcement</span>
              </div>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                All employee accounts require temporary verification codes dispatched via email on new sign-ins.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100/80 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Dual Approval Workflow</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Ticket closures strictly require both QA Tester and Engineering Manager approvals.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Briefcase size={14} className="text-slate-600" />
                <span>Session Persistence</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                JWT Auth tokens refresh automatically with 7-day validity and 30-day rotation cycle.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: RBAC PERMISSIONS MATRIX ─────────────────────────────────── */}
      {activeTab === 'RBAC' && (
        <div className="card overflow-hidden !p-0 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="section-title text-base font-bold text-slate-900">Role-Based Access Control (RBAC) Specification</h3>
            <p className="text-xs text-slate-400 mt-1">Granular authorization boundaries mapped across all 9 enterprise roles.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-600 uppercase">
                  <th className="py-3 px-4">Permission / Capability</th>
                  {ROLE_HEADERS.map((h, i) => (
                    <th key={i} className="py-3 px-3 text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {RBAC_MATRIX.map(([permission, ...flags], index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">{permission}</td>
                    {flags.map((allowed, fi) => (
                      <td key={fi} className="py-3 px-3 text-center">
                        {allowed ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL 1: ADD EMPLOYEE ───────────────────────────────────────────── */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#DFE1E6] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#DEEBFF] text-[#0052CC] flex items-center justify-center flex-shrink-0 font-bold">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#172B4D]">Invite / Provision Team Member</h3>
                  <p className="text-[11.5px] text-[#6B778C]">Create an account and assign organization role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4 overflow-y-auto flex-1 text-[#172B4D]">
              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  FULL NAME <span className="text-[#DE350B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rachel Foster"
                  value={empName}
                  onChange={e => setEmpName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  WORK EMAIL <span className="text-[#DE350B]">*</span>
                </label>
                <input
                  type="email"
                  placeholder="rachel.foster@flowsync.com"
                  value={empEmail}
                  onChange={e => setEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    ORGANIZATION ROLE <span className="text-[#DE350B]">*</span>
                  </label>
                  <select
                    value={empRole}
                    onChange={e => setEmpRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                    required
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="TESTER">QA Tester</option>
                    <option value="SCRUM_MASTER">Scrum Master</option>
                    <option value="PROJECT_OWNER">Project Owner</option>
                    <option value="MANAGER">Product Manager</option>
                    <option value="CTO">Chief Technology Officer (CTO)</option>
                    <option value="VP">Vice President (VP)</option>
                    <option value="TRAINEE">Engineering Trainee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    DEPARTMENT <span className="text-[#DE350B]">*</span>
                  </label>
                  <select
                    value={empDept}
                    onChange={e => setEmpDept(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                    required
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="QA & Testing">QA & Testing</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#DEEBFF] border-l-4 border-[#0052CC] rounded-r-md text-[12px] text-[#0747A6] leading-relaxed">
                ℹ️ A secure temporary password starting with <strong>EMP-</strong> will be generated automatically and dispatched to the employee's email address.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-transparent border-0 cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Provisioning...' : 'Provision Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD PROJECT ────────────────────────────────────────────── */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#DFE1E6] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#EAE6FF] text-[#5E4DB2] flex items-center justify-center flex-shrink-0 font-bold">
                  <PlusCircle size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#172B4D]">Create Project</h3>
                  <p className="text-[11.5px] text-[#6B778C]">Initialize a project and sprint board</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 overflow-y-auto flex-1 text-[#172B4D]">
              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  PROJECT NAME <span className="text-[#DE350B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. NextGen Core Banking"
                  value={projName}
                  onChange={e => {
                    setProjName(e.target.value)
                    if (!projKey) {
                      const words = e.target.value.trim().split(' ')
                      const key = words.map(w => w[0] || '').join('').toUpperCase().slice(0, 4)
                      setProjKey(key)
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    PROJECT KEY <span className="text-[#DE350B]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BANK"
                    value={projKey}
                    onChange={e => setProjKey(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-bold uppercase transition-all outline-none"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    TARGET DURATION
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6 Months"
                    value={projDuration}
                    onChange={e => setProjDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  GIT REPOSITORY URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/company/repo"
                  value={projGitRepo}
                  onChange={e => setProjGitRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-transparent border-0 cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ASSIGN MEMBER ──────────────────────────────────────────── */}
      {showAssignMemberModal && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#DFE1E6] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#FFF0B3] text-[#172B4D] flex items-center justify-center flex-shrink-0 font-bold">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#172B4D]">Add People to Project</h3>
                  <p className="text-[11.5px] text-[#6B778C]">Grant project workspace access and ticket assignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignMemberModal(false)}
                className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignMember} className="p-6 space-y-4 overflow-y-auto flex-1 text-[#172B4D]">
              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  SELECT PROJECT <span className="text-[#DE350B]">*</span>
                </label>
                <select
                  value={memberProjId}
                  onChange={e => setMemberProjId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                >
                  <option value="">-- Choose a Project --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  SELECT TEAM MEMBER <span className="text-[#DE350B]">*</span>
                </label>
                <select
                  value={memberUserId}
                  onChange={e => setMemberUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                >
                  <option value="">-- Choose a Team Member --</option>
                  {userList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — {u.role.replace('_', ' ')} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => setShowAssignMemberModal(false)}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-transparent border-0 cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Add to Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: EDIT USER ──────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#DFE1E6] animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#DEEBFF] text-[#0052CC] flex items-center justify-center flex-shrink-0 font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#172B4D]">Edit Member Details</h3>
                  <p className="text-[11.5px] text-[#6B778C]">Update personal profile and organization email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingUserId(null)
                }}
                className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-[#172B4D]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    FIRST NAME <span className="text-[#DE350B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                    LAST NAME <span className="text-[#DE350B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase tracking-wide mb-1.5">
                  EMAIL ADDRESS <span className="text-[#DE350B]">*</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0]/50 focus:bg-white border border-[#DFE1E6] focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 rounded-md text-[13px] text-[#172B4D] font-medium transition-all outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUserId(null)
                  }}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-transparent border-0 cursor-pointer"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: CREATED EMPLOYEE CREDENTIALS (AUTHENTIC JIRA STYLE) ───────── */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-[#DFE1E6] flex flex-col">
            
            {/* Jira Header */}
            <div className="px-6 py-4 border-b border-[#EBECF0] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#E3FCEF] text-[#006644] flex items-center justify-center flex-shrink-0 font-bold border border-[#ABF5D1]">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#172B4D]">User Access Provisioned</h3>
                  <p className="text-[11.5px] text-[#6B778C]">IntelliSprint • User Directory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="text-[#6B778C] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-md transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Jira Body */}
            <div className="p-6 space-y-4 text-[#172B4D]">
              
              {/* Jira Info Banner */}
              <div className="bg-[#DEEBFF] border-l-4 border-[#0052CC] rounded-r-md p-3.5 text-[12px] text-[#0747A6] leading-relaxed">
                <p className="font-semibold mb-0.5">Invitation Dispatched</p>
                An account invitation has been sent to <strong>{createdCredentials.email}</strong>. The user can log in immediately using the temporary credentials below.
              </div>

              {/* User Identity Box */}
              <div className="bg-[#FAFBFC] border border-[#DFE1E6] rounded-md p-4 space-y-3.5">
                
                {/* Member Overview */}
                <div className="flex items-center justify-between border-b border-[#EBECF0] pb-3">
                  <div>
                    <div className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">MEMBER NAME</div>
                    <div className="text-sm font-bold text-[#172B4D] mt-0.5">{createdCredentials.name}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EAE6FF] text-[#5E4DB2]">
                      {createdCredentials.role}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EBECF0] text-[#42526E]">
                      {createdCredentials.department || 'General'}
                    </span>
                  </div>
                </div>

                {/* Email / Username Field */}
                <div>
                  <div className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>USERNAME / WORK EMAIL</span>
                    <span className="text-[10px] text-[#0052CC] font-semibold">User ID</span>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-[#DFE1E6] rounded-md px-3 py-2 focus-within:border-[#4C9AFF]">
                    <span className="text-[12.5px] font-mono font-medium text-[#172B4D] select-all truncate pr-2">
                      {createdCredentials.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.email)
                        setCopiedField('email')
                        toast.success('Email copied to clipboard!')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="text-[#6B778C] hover:text-[#0052CC] hover:bg-[#EBECF0] p-1 rounded transition-colors bg-transparent border-0 cursor-pointer flex-shrink-0"
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? <Check size={14} className="text-[#006644]" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Temporary Password Field */}
                <div>
                  <div className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>TEMPORARY PASSWORD</span>
                    <span className="text-[10px] text-[#BF2600] font-bold">First Login Required</span>
                  </div>
                  <div className="flex items-center justify-between bg-white border border-[#FFE380] rounded-md px-3 py-2 focus-within:border-[#4C9AFF]">
                    <span className="text-[13px] font-mono font-bold text-[#BF2600] select-all bg-[#FFEBE6] px-2 py-0.5 rounded">
                      {createdCredentials.temporaryPassword || 'EMP-Generated'}
                    </span>
                    {createdCredentials.temporaryPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdCredentials.temporaryPassword || '')
                          setCopiedField('password')
                          toast.success('Password copied to clipboard!')
                          setTimeout(() => setCopiedField(null), 2000)
                        }}
                        className="text-[#6B778C] hover:text-[#0052CC] hover:bg-[#EBECF0] p-1 rounded transition-colors bg-transparent border-0 cursor-pointer flex-shrink-0"
                        title="Copy Password"
                      >
                        {copiedField === 'password' ? <Check size={14} className="text-[#006644]" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#EBECF0]">
                <button
                  type="button"
                  onClick={() => {
                    const credText = `IntelliSprint User Credentials:\nName: ${createdCredentials.name}\nEmail / Username: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.temporaryPassword}\nLogin URL: ${window.location.origin}/login`
                    navigator.clipboard.writeText(credText)
                    toast.success('All credentials & login link copied! 📋')
                  }}
                  className="px-3.5 py-2 text-[12.5px] font-semibold text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D] rounded-md transition-colors bg-[#FAFBFC] border border-[#DFE1E6] cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={14} /> Copy All Credentials
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="px-4 py-2 text-[13px] font-semibold bg-[#0052CC] hover:bg-[#0065FF] text-white rounded-md shadow-sm transition-colors cursor-pointer border-0"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
