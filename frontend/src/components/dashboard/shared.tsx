import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus, Inbox, ShieldAlert, Award, FolderOpen, UserCheck, CalendarDays } from 'lucide-react'

// ── KPI Card ────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  sub,
  trend,
  accent = '#0F172A',
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  accent?: string
  icon?: ReactNode
}) {
  return (
    <div className="metric-card group">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">{value}</div>
      {sub && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 font-medium">
          {trend === 'up'   && <TrendingUp size={13} className="text-emerald-500 flex-shrink-0" />}
          {trend === 'down' && <TrendingDown size={13} className="text-rose-500 flex-shrink-0" />}
          {trend === 'flat' && <Minus size={13} className="text-slate-400 flex-shrink-0" />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────────
export function Section({
  title,
  sub,
  action,
  children,
  className = '',
}: {
  title: string
  sub?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`card ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="section-title text-base font-bold text-slate-900">{title}</h2>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Labeled progress row ────────────────────────────────────────────────────
export function ProgressRow({
  label,
  pct,
  color,
  rightLabel,
  avatarColor,
  avatarText,
}: {
  label: string
  pct: number
  color: string
  rightLabel?: string
  avatarColor?: string
  avatarText?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100/60 last:border-0">
      {avatarText && (
        <div
          className="avatar w-7 h-7 text-[10px] flex-shrink-0 shadow-sm"
          style={{ background: avatarColor || '#2563EB' }}
        >
          {avatarText}
        </div>
      )}
      <div className="w-32 text-xs font-semibold text-slate-700 truncate">{label}</div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
        />
      </div>
      <div className="text-xs font-bold w-12 text-right text-slate-700">{rightLabel ?? `${pct}%`}</div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyRow({
  text,
  type,
}: {
  text: string
  type?: 'tasks' | 'bugs' | 'roadmap' | 'approvals' | 'portfolio' | 'default'
}) {
  let Icon = Inbox
  let colorClass = 'text-slate-400 bg-slate-50/50 border-slate-200'

  if (type === 'tasks') {
    Icon = CalendarDays
    colorClass = 'text-amber-600 bg-amber-50/40 border-amber-200/60'
  } else if (type === 'bugs') {
    Icon = ShieldAlert
    colorClass = 'text-rose-600 bg-rose-50/40 border-rose-200/60'
  } else if (type === 'roadmap') {
    Icon = Award
    colorClass = 'text-indigo-600 bg-indigo-50/40 border-indigo-200/60'
  } else if (type === 'approvals') {
    Icon = UserCheck
    colorClass = 'text-emerald-600 bg-emerald-50/40 border-emerald-200/60'
  } else if (type === 'portfolio') {
    Icon = FolderOpen
    colorClass = 'text-blue-600 bg-blue-50/40 border-blue-200/60'
  }

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 rounded-2xl border border-dashed ${colorClass} text-center`}>
      <Icon size={24} className="mb-2 opacity-80" />
      <span className="text-xs font-semibold leading-relaxed text-slate-600">{text}</span>
    </div>
  )
}

// ── Role badge pill for headers ─────────────────────────────────────────────
export function RoleTag({ role }: { role: string }) {
  const norm = role?.toUpperCase() || ''
  switch (norm) {
    case 'ADMIN':
      return <span className="tag tag-purple">👑 Admin</span>
    case 'SCRUM_MASTER':
      return <span className="tag tag-teal">⚡ Scrum Master</span>
    case 'PROJECT_OWNER':
      return <span className="tag tag-green">🎯 Project Owner</span>
    case 'CTO':
      return <span className="tag tag-red">🛡️ CTO</span>
    case 'VP':
      return <span className="tag tag-amber">💼 VP</span>
    case 'MANAGER':
      return <span className="tag tag-indigo">📊 Manager</span>
    case 'DEVELOPER':
      return <span className="tag tag-blue">💻 Developer</span>
    case 'TESTER':
      return <span className="tag tag-teal">🧪 Tester</span>
    case 'TRAINEE':
      return <span className="tag tag-amber">🌱 Trainee</span>
    default:
      return <span className="tag tag-gray">{role.replace('_', ' ')}</span>
  }
}
