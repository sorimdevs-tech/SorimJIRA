import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProjects } from '@/api/projects'
import { getSprintsByProject, startSprint, completeSprint, deleteSprint } from '@/api/sprints'
import { Project, Sprint } from '@/types'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import CreateSprintModal from '@/components/modals/CreateSprintModal'
import SprintDetailModal from '@/components/modals/SprintDetailModal'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { wsClient } from '@/utils/websocket'

const STATUS_COLOR: Record<string,string> = { PLANNED:'#94A3B8', ACTIVE:'#2563EB', COMPLETED:'#059669', CANCELLED:'#DC2626' }
const STATUS_TAG: Record<string,string> = { PLANNED:'tag-gray', ACTIVE:'tag-blue', COMPLETED:'tag-green', CANCELLED:'tag-red' }

export default function SprintsPage() {
  const { projectId } = useParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedProject, setSelectedProject] = useState<number>(parseInt(projectId||'0'))
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [selectedSprintIdForDetail, setSelectedSprintIdForDetail] = useState<number | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const user = useSelector((s: RootState) => s.auth.user)
  const canManageSprint = user && ['ADMIN', 'SCRUM_MASTER', 'PROJECT_OWNER'].includes(user.role)

  const fetchSprints = () => {
    if (selectedProject) getSprintsByProject(selectedProject).then(setSprints)
  }

  useEffect(() => {
    getProjects().then(projs => {
      setProjects(projs)
      if (!selectedProject && projs.length > 0) setSelectedProject(projs[0].id)
    })
  }, [])

  useEffect(() => {
    fetchSprints()
  }, [selectedProject])

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'SPRINT_UPDATED' || evt.type === 'TICKET_UPDATED') {
        fetchSprints()
      }
    })
    return () => unsubscribe()
  }, [selectedProject])

  const handleStart = async (id: number) => {
    await startSprint(id); toast.success('Sprint started!'); fetchSprints()
  }
  const handleComplete = async (id: number) => {
    await completeSprint(id); toast.success('Sprint completed!'); fetchSprints()
  }
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this sprint? Any associated tickets will be returned to the backlog.")) return
    try {
      await deleteSprint(id)
      toast.success('Sprint deleted! 🗑️')
      fetchSprints()
    } catch {
      toast.error('Failed to delete sprint')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Sprint Planning</h1></div>
        <div className="flex gap-2">
          <select className="field-input w-48 text-[12px]" value={selectedProject} onChange={e => setSelectedProject(parseInt(e.target.value))}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          </select>
          {canManageSprint && (
            <button onClick={() => setShowSprintModal(true)} className="btn-primary text-[11px] gap-1.5"><Plus size={12} /> New Sprint</button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card mb-4">
        <div className="section-title mb-3">Sprint Timeline</div>
        <div className="flex mb-2">
          <div className="w-24" />
          <div className="flex-1 flex justify-between text-[9.5px] font-bold text-slate-400 px-1">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].slice(0,sprints.length+2).map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
        {sprints.map((sp, i) => (
          <div key={sp.id} className="flex items-center gap-2 mb-2">
            <div className="w-24 text-[11.5px] font-semibold text-slate-700 truncate">{sp.name}</div>
            <div className="flex-1 h-3 bg-slate-100 rounded-full relative overflow-hidden">
              <div className="h-full rounded-full absolute" style={{ left:`${i*16.67}%`, width:'16%', background: STATUS_COLOR[sp.status], opacity: sp.status==='PLANNED'?0.4:1 }} />
            </div>
            <span className={`tag ${STATUS_TAG[sp.status]} text-[9px]`}>{sp.status === 'ACTIVE' ? `${sp.progressPercent}%` : sp.status === 'COMPLETED' ? '✓' : '—'}</span>
          </div>
        ))}
      </div>

      {/* Sprint cards */}
      <div className="grid grid-cols-3 gap-3">
        {sprints.map(sp => (
          <div key={sp.id} onClick={() => { setSelectedSprintIdForDetail(sp.id); setShowDetailModal(true); }} className="card-sm cursor-pointer hover:shadow-md transition-shadow" style={{ borderLeft: `3px solid ${STATUS_COLOR[sp.status]}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-black text-slate-900">{sp.name}</span>
              <span className={`tag ${STATUS_TAG[sp.status]}`}>{sp.status}</span>
            </div>
            <div className="text-[10.5px] text-slate-400 mb-1">{sp.startDate} – {sp.endDate}</div>
            {sp.goal && <div className="text-[11px] text-slate-600 italic mb-2">"{sp.goal}"</div>}
            <div className="progress-bar mb-1">
              <div className="progress-fill" style={{ width: `${sp.progressPercent}%`, background: STATUS_COLOR[sp.status] }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-2">
              <span>{sp.completedPoints}/{sp.capacityPoints} pts</span>
              <span>{sp.totalTickets} tickets</span>
              <span>{sp.progressPercent}%</span>
            </div>
             <div className="flex gap-1 items-center">
              {canManageSprint && sp.status === 'PLANNED' && <button onClick={(e) => { e.stopPropagation(); handleStart(sp.id); }} className="btn-primary text-[10px] py-1">Start</button>}
              {canManageSprint && sp.status === 'ACTIVE' && <button onClick={(e) => { e.stopPropagation(); handleComplete(sp.id); }} className="btn-secondary text-[10px] py-1">Complete</button>}
              {canManageSprint && (
                <button onClick={(e) => { e.stopPropagation(); handleDelete(sp.id); }} className="ml-auto px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-[9.5px] font-semibold cursor-pointer">
                  Delete 🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateSprintModal 
        isOpen={showSprintModal} 
        onClose={() => setShowSprintModal(false)} 
        projectId={selectedProject}
        onCreated={fetchSprints} 
      />

      <SprintDetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedSprintIdForDetail(null); }}
        sprintId={selectedSprintIdForDetail}
        projectId={selectedProject}
        onUpdated={fetchSprints}
      />
    </div>
  )
}
