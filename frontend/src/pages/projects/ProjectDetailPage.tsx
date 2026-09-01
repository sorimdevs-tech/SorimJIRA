import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getProject, addMember, removeMember, deleteProject } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { getTicketsByProject } from '@/api/tickets'
import { getUsers } from '@/api/users'
import { Project, Sprint, Ticket, User } from '@/types'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { wsClient } from '@/utils/websocket'
import CreateSprintModal from '@/components/modals/CreateSprintModal'
import EditProjectModal from '@/components/modals/EditProjectModal'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('')
  const [submittingMember, setSubmittingMember] = useState(false)
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentUser = useSelector((s: RootState) => s.auth.user)
  const canEdit = currentUser && ['ADMIN', 'SCRUM_MASTER', 'PROJECT_OWNER'].includes(currentUser.role)
  const canManageSprint = currentUser && ['ADMIN', 'SCRUM_MASTER', 'PROJECT_OWNER'].includes(currentUser.role)
  const canDeleteProject = currentUser && ['ADMIN', 'PROJECT_OWNER'].includes(currentUser.role)

  const fetchData = () => {
    if (!id) return
    const pid = parseInt(id)
    getProject(pid)
      .then(p => {
        setProject(p)
        setError(null)
      })
      .catch(err => {
        const msg = err.response?.data?.message || err.message || '';
        if (err.response?.status === 403 || msg.toLowerCase().includes("authorized") || msg.toLowerCase().includes("denied")) {
          setError("Access Denied: You do not have authorization to view this project's workspace.")
        } else {
          setError("Failed to load project details.")
        }
      })
    getSprintsByProject(pid).then(setSprints).catch(() => {})
    getTicketsByProject(pid).then(setTickets).catch(() => {})
  }

  useEffect(() => {
    fetchData()
    getUsers().then(setAllUsers).catch(() => {})
  }, [id, refreshTrigger])

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'PROJECT_UPDATED' || evt.type === 'SPRINT_UPDATED') {
        setRefreshTrigger(prev => prev + 1)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !selectedUserId) return
    setSubmittingMember(true)
    try {
      await addMember(parseInt(id), Number(selectedUserId))
      toast.success('Team member assigned successfully! 👥')
      setSelectedUserId('')
      setRefreshTrigger(prev => prev + 1)
    } catch (err: any) {
      toast.error('Failed to assign team member')
    } finally {
      setSubmittingMember(false)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!id) return
    if (!window.confirm("Are you sure you want to remove this member from the project?")) return
    try {
      await removeMember(parseInt(id), userId)
      toast.success('Team member removed successfully! 👥')
      setRefreshTrigger(prev => prev + 1)
    } catch (err: any) {
      toast.error('Failed to remove team member')
    }
  }

  const handleDeleteProject = async () => {
    if (!id) return
    if (!window.confirm("Are you sure you want to delete this project? This will permanently delete all sprints and tickets associated with it.")) return
    try {
      await deleteProject(parseInt(id))
      toast.success('Project deleted successfully! 🗑️')
      navigate('/projects')
    } catch (err: any) {
      toast.error('Failed to delete project')
    }
  }

  if (error) {
    return (
      <div className="page-container flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-black text-slate-850 tracking-tight">Offline Mode / Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary text-[11px] py-1.5 px-3">
          Go Back
        </button>
      </div>
    )
  }

  if (!project) return <div className="page-container flex justify-center py-16"><div className="spinner" style={{width:24,height:24}}/></div>

  const memberIds = new Set(project.members.map(m => m.id))
  const availableUsers = allUsers.filter(u => !memberIds.has(u.id))

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{project.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{project.name}</h1>
              <span className="tag tag-blue">{project.status}</span>
            </div>
            <div className="text-[11.5px] text-slate-400">{project.projectKey} · {project.description?.slice(0,80)}…</div>
          </div>
        </div>
        <div className="flex gap-2">
          {canManageSprint && (
            <button onClick={() => setShowSprintModal(true)} className="btn-primary text-[11px] gap-1.5 flex items-center">
              <Plus size={12} /> New Sprint
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowEditProjectModal(true)} className="btn-secondary text-[11px] gap-1 flex items-center">
              ⚙️ Edit Project
            </button>
          )}
          {canDeleteProject && (
            <button
              onClick={handleDeleteProject}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border shadow-sm bg-red-50 text-red-750 hover:bg-red-100 border-red-200 cursor-pointer"
            >
              Delete Project 🗑️
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label:'Total Sprints', value: sprints.length },
          { label:'Total Tickets', value: tickets.length },
          { label:'Completion',    value: `${project.progressPercent}%` },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <div className="text-2xl font-black text-slate-900">{m.value}</div>
            <div className="text-[11px] text-slate-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-start">
        {/* Team Members List */}
        <div className="md:col-span-2 card">
          <div className="section-title mb-3">Team Members</div>
          <div className="flex flex-wrap gap-3">
            {project.members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 relative group">
                <div className="avatar w-7 h-7 text-[10px]" style={{ background: m.avatarColor }}>{m.initials}</div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{m.fullName}</div>
                  <div className="text-[10px] text-slate-400">{m.role.replace('_', ' ')}</div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove member"
                    style={{ width: '16px', height: '16px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {project.members.length === 0 && (
              <div className="text-[11px] text-slate-400 italic">No team members assigned yet.</div>
            )}
          </div>
        </div>

        {/* Add Team Member Section */}
        {canEdit && (
          <div className="md:col-span-1 card">
            <div className="section-title mb-2">Assign Team Member</div>
            <p className="text-[11px] text-slate-400 mb-3">Add a registered resource to this project.</p>
            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                  className="field-input text-xs"
                  required
                >
                  <option value="">-- Select Member --</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submittingMember || !selectedUserId}
                className="w-full btn-primary text-[10.5px] py-1.5 flex items-center justify-center gap-1"
              >
                <Plus size={11} /> Add to Project
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title mb-3">Recent Tickets</div>
        <div className="flex flex-col gap-1">
          {tickets.slice(0,8).map(t => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
              <span className="text-[10px] font-mono text-blue-600 font-bold w-20">{t.ticketKey}</span>
              <span className="flex-1 text-xs text-slate-700 truncate">{t.title}</span>
              <span className="tag tag-blue text-[9px]">{t.status.replace('_',' ')}</span>
              <span className="text-[10px] font-bold text-blue-600">{t.storyPoints}sp</span>
            </Link>
          ))}
          {tickets.length === 0 && (
            <div className="text-[11px] text-slate-400 italic text-center py-4">No tickets in this project yet.</div>
          )}
        </div>
      </div>

      <CreateSprintModal
        isOpen={showSprintModal}
        onClose={() => setShowSprintModal(false)}
        projectId={project.id}
        onCreated={() => {
          setRefreshTrigger(prev => prev + 1)
        }}
      />

      <EditProjectModal
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        project={project}
        onUpdated={() => {
          setRefreshTrigger(prev => prev + 1)
        }}
      />
    </div>
  )
}
