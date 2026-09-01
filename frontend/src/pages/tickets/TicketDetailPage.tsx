import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getTicket,
  addComment,
  approveTester,
  approveManager,
  updateStatus,
  updateAssignee
} from '@/api/tickets'
import { getUsers } from '@/api/users'
import { Ticket, User, TicketStatus } from '@/types'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  Paperclip,
  Eye,
  Trash2,
  FileText,
  Edit3,
  Calendar,
  Clock,
  Zap,
  Layers,
  FolderKanban,
  UserCheck,
  Send,
  Sparkles,
  ShieldCheck,
  Check,
  Lock,
  ExternalLink,
  MessageSquare,
  AlertCircle
} from 'lucide-react'
import { wsClient } from '@/utils/websocket'
import CreateTicketModal from '@/components/modals/CreateTicketModal'
import { RoleTag } from '@/components/dashboard/shared'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  TODO:        { label: 'To Do',       bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-50',     text: 'text-blue-700',     dot: 'bg-blue-500' },
  IN_REVIEW:   { label: 'In Review',   bg: 'bg-amber-50',    text: 'text-amber-700',    dot: 'bg-amber-500' },
  TESTING:     { label: 'QA Testing',  bg: 'bg-purple-50',   text: 'text-purple-700',   dot: 'bg-purple-500' },
  COMPLETED:   { label: 'Completed',   bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-500' },
  CLOSED:      { label: 'Closed',      bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-500' },
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { label: 'Critical', bg: 'bg-rose-50',  text: 'text-rose-700',  dot: 'bg-rose-500' },
  HIGH:     { label: 'High',     bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  MEDIUM:   { label: 'Medium',   bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  LOW:      { label: 'Low',      bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comment, setComment] = useState('')
  const [closureNotes, setClosureNotes] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; url: string; size: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  const refresh = () => {
    if (id) getTicket(parseInt(id)).then(setTicket).catch(() => {})
  }

  useEffect(() => {
    if (id) getTicket(parseInt(id)).then(setTicket).catch(() => {})
    getUsers().then(setAllUsers).catch(() => {})
  }, [id])

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'TICKET_UPDATED' && Number(evt.ticketId) === Number(id)) {
        refresh()
      }
    })
    return () => unsubscribe()
  }, [id])

  const handleComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!comment.trim() || !id) return
    setSubmittingComment(true)
    try {
      await addComment(parseInt(id), comment)
      setComment('')
      refresh()
      toast.success('Comment posted!')
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleApproveTester = async () => {
    if (!id) return
    try {
      await approveTester(parseInt(id))
      refresh()
      toast.success('QA Tester approval confirmed! ✓')
    } catch {
      toast.error('Failed to approve as Tester')
    }
  }

  const handleApproveManager = async () => {
    if (!id) return
    try {
      await approveManager(parseInt(id))
      refresh()
      toast.success('Engineering Manager approval confirmed! ✓')
    } catch {
      toast.error('Failed to approve as Manager')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          size: (file.size / 1024).toFixed(1) + ' KB',
          url: reader.result as string
        })
        toast.success(`${file.name} attached!`)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClose = async () => {
    if (!id || !closureNotes.trim()) {
      toast.error('Closure notes and verification summary are required')
      return
    }
    try {
      const finalNotes = attachedFile
        ? `[Attachment: ${attachedFile.name} (${attachedFile.size})]\n\n${closureNotes}`
        : closureNotes
      await updateStatus(parseInt(id), { status: 'CLOSED', closureNotes: finalNotes })
      refresh()
      toast.success('Ticket successfully closed and verified! 🎉')
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cannot close — Tester and Manager approval required')
    }
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return
    try {
      await updateStatus(ticket.id, { status: newStatus })
      refresh()
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  if (!ticket) {
    return (
      <div className="page-container flex flex-col items-center justify-center py-24">
        <div className="spinner mb-3" style={{ width: 28, height: 28 }} />
        <span className="text-xs text-slate-500 font-semibold">Loading ticket details...</span>
      </div>
    )
  }

  const sTheme = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO
  const pTheme = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM

  const canEdit = user && ['ADMIN', 'PROJECT_OWNER', 'SCRUM_MASTER', 'MANAGER', 'DEVELOPER', 'TESTER', 'TRAINEE', 'CTO'].includes(user.role)
  const canApproveTester = user && ['ADMIN', 'TESTER'].includes(user.role)
  const canApproveManager = user && ['ADMIN', 'MANAGER'].includes(user.role)

  return (
    <div className="page-container space-y-6">
      {/* ── Top Breadcrumbs & Action Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tickets')}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer border-0"
            title="Back to Backlog"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {ticket.ticketKey}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-600">{ticket.projectName || 'Project'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              {ticket.title}
            </h1>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-secondary text-xs py-2 px-4 shadow-sm"
            >
              <Edit3 size={13} />
              <span>Edit Ticket</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 2-Column Full-Width Jira/Linear Layout ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (65%): Main Content ───────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Description Card */}
          <div className="card space-y-3">
            <h3 className="section-title text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <span>Description</span>
            </h3>
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[90px]">
              {ticket.description || 'No detailed description provided for this issue.'}
            </div>
          </div>

          {/* Closure Checklist & Dual Approvals Hub */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span>Closure Checklist & Verification</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                Enforced by Security RBAC
              </span>
            </div>

            {/* Approval Progress Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tester Approval Tile */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  ticket.testerApproved
                    ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    {ticket.testerApproved ? (
                      <CheckCircle2 size={15} className="text-purple-600" />
                    ) : (
                      <Clock size={15} className="text-slate-400" />
                    )}
                    <span>QA Tester Approval</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ticket.testerApproved ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {ticket.testerApproved ? 'Approved ✓' : 'Pending'}
                  </span>
                </div>

                {!ticket.testerApproved && canApproveTester && (
                  <button
                    onClick={handleApproveTester}
                    className="btn-primary text-[11px] py-1.5 px-3 w-full justify-center mt-2 bg-purple-600 hover:bg-purple-700"
                  >
                    Approve as QA Tester
                  </button>
                )}
              </div>

              {/* Manager Approval Tile */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  ticket.managerApproved
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    {ticket.managerApproved ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <Clock size={15} className="text-slate-400" />
                    )}
                    <span>Manager Approval</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ticket.managerApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {ticket.managerApproved ? 'Approved ✓' : 'Pending'}
                  </span>
                </div>

                {!ticket.managerApproved && canApproveManager && (
                  <button
                    onClick={handleApproveManager}
                    className="btn-primary text-[11px] py-1.5 px-3 w-full justify-center mt-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Approve as Manager
                  </button>
                )}
              </div>
            </div>

            {/* Closure Form or Documentation */}
            {ticket.status !== 'CLOSED' ? (
              <div className="pt-3 border-t border-slate-100 space-y-3.5">
                <div>
                  <label className="field-label">CLOSURE SUMMARY / VERIFICATION NOTES *</label>
                  <textarea
                    className="field-input text-xs resize-none"
                    rows={3}
                    placeholder="Provide verification results, build IDs, or test regression summary..."
                    value={closureNotes}
                    onChange={e => setClosureNotes(e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label">VERIFICATION ARTIFACT (SCREENSHOT OR PDF)</label>
                  {!attachedFile ? (
                    <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50/50 hover:bg-indigo-50/20 group">
                      <UploadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600">
                        Click to upload or drag screenshot/PDF
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Supports PNG, JPG, JPEG, and PDF documents
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        {attachedFile.type.includes('pdf') ? <FileText size={18} /> : <Paperclip size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{attachedFile.name}</div>
                        <div className="text-[10px] text-slate-400">{attachedFile.size} · Ready to submit</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(attachedFile.url)}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttachedFile(null)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500"
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-danger w-full justify-center text-xs py-2.5 shadow-sm"
                >
                  <Lock size={13} />
                  <span>Submit Closure & Verification</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Ticket Verified & Closed</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {ticket.closureNotes || 'Ticket has been successfully verified and closed.'}
                </p>
              </div>
            )}
          </div>

          {/* Comments & Activity Thread */}
          <div className="card space-y-4">
            <h3 className="section-title text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-400" />
              <span>Discussion & Comments ({ticket.comments?.length || 0})</span>
            </h3>

            <div className="space-y-3">
              {(!ticket.comments || ticket.comments.length === 0) ? (
                <div className="py-8 text-center text-slate-400">
                  <MessageSquare size={24} className="mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs font-semibold">No comments yet</p>
                  <p className="text-[10px] text-slate-400">Be the first to share an update or note on this ticket.</p>
                </div>
              ) : (
                ticket.comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <div
                      className="avatar w-7 h-7 text-[9px] flex-shrink-0 font-bold shadow-sm"
                      style={{ background: c.author?.avatarColor || '#3B82F6' }}
                    >
                      {c.author?.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800">{c.author?.fullName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.createdAt?.split('T')[0]}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleComment} className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                className="field-input flex-1 text-xs"
                placeholder="Write a comment or update..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <button
                type="submit"
                className="btn-primary text-xs px-4"
                disabled={submittingComment || !comment.trim()}
              >
                <Send size={13} />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* ── Right Column (35%): Sticky Meta Sidebar ──────────────────────── */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
          <div className="card space-y-4">
            <h3 className="section-title text-xs font-extrabold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              Ticket Metadata & Status
            </h3>

            {/* Status Selector */}
            <div>
              <label className="field-label">LIFECYCLE STATUS</label>
              <select
                value={ticket.status}
                onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                className="field-input text-xs font-bold cursor-pointer"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="TESTING">QA / Testing</option>
                <option value="CLOSED">Closed (Requires Approvals)</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="field-label">PRIORITY</label>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${pTheme.bg} ${pTheme.text}`}>
                  <span className={`w-2 h-2 rounded-full ${pTheme.dot}`} />
                  {pTheme.label}
                </span>
              </div>
            </div>

            {/* Story Points */}
            <div>
              <label className="field-label">STORY POINTS ESTIMATE</label>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 font-extrabold text-xs rounded-xl">
                <Zap size={13} className="text-amber-500" />
                <span>{ticket.storyPoints || 1} Story Points</span>
              </div>
            </div>

            {/* Assignee & Transfer */}
            <div>
              <label className="field-label">CURRENT ASSIGNEE</label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                {ticket.assignee ? (
                  <div className="flex items-center gap-2.5">
                    <div
                      className="avatar w-8 h-8 text-[10px] font-bold shadow-sm"
                      style={{ background: ticket.assignee.avatarColor || '#3B82F6' }}
                    >
                      {ticket.assignee.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{ticket.assignee.fullName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{ticket.assignee.email}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Currently Unassigned</span>
                )}

                {/* Transfer Dropdown */}
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reassign Issue:</span>
                  <select
                    value={ticket.assignee?.id || ''}
                    onChange={async (e) => {
                      const val = e.target.value
                      const uid = val ? Number(val) : null
                      try {
                        await updateAssignee(ticket.id, uid)
                        toast.success('Ticket reassigned! Notification email dispatched. ✉️')
                        refresh()
                      } catch {
                        toast.error('Failed to transfer ticket')
                      }
                    }}
                    className="field-input text-xs"
                  >
                    <option value="">-- Unassigned --</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sprint */}
            <div>
              <label className="field-label">SPRINT</label>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Layers size={14} className="text-slate-400" />
                <span>{ticket.sprintName || 'Backlog (No Active Sprint)'}</span>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="field-label">TARGET DUE DATE</label>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Calendar size={14} className="text-slate-400" />
                <span>{ticket.dueDate || 'No target due date scheduled'}</span>
              </div>
            </div>

            {/* Project */}
            <div>
              <label className="field-label">PARENT PROJECT</label>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <FolderKanban size={14} className="text-slate-400" />
                <span>{ticket.projectName || 'Project Workspace'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="modal-overlay">
          <div className="modal max-w-2xl">
            <div className="modal-header">
              <span className="text-xs font-bold font-mono">Attachment Preview</span>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center overflow-auto max-h-[60vh]">
              {previewUrl.startsWith('data:image/') || previewUrl.endsWith('.png') || previewUrl.endsWith('.jpg') ? (
                <img src={previewUrl} alt="Attachment" className="max-w-full max-h-[50vh] object-contain rounded shadow" />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl border">
                  <FileText className="text-red-500 w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">PDF Verification Summary Document</p>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-primary text-xs mt-3">
                    Open in New Tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <CreateTicketModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onCreated={refresh}
        ticketToEdit={ticket}
      />
    </div>
  )
}
