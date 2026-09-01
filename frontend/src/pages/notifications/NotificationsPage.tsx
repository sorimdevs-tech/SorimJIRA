import { useEffect, useState } from 'react'
import { getNotifications, markRead } from '@/api/notifications'
import { Notification } from '@/types'
import toast from 'react-hot-toast'
import { Bell, CheckCheck } from 'lucide-react'

const TYPE_ICON: Record<string,{icon:string; bg:string}> = {
  TICKET_ASSIGNED:  { icon:'👤', bg:'#FFFBEB' },
  STATUS_CHANGED:   { icon:'🔄', bg:'#EFF6FF' },
  SPRINT_STARTED:   { icon:'🏃', bg:'#ECFDF5' },
  SPRINT_ENDED:     { icon:'🏁', bg:'#F5F3FF' },
  DEADLINE_REMINDER:{ icon:'🔴', bg:'#FEF2F2' },
  APPROVAL_REQUIRED:{ icon:'✅', bg:'#F5F3FF' },
  DEFECT_RAISED:    { icon:'🐛', bg:'#FEF2F2' },
  COMMENT_ADDED:    { icon:'💬', bg:'#EFF6FF' },
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const refresh = () => getNotifications().then(setNotifs).catch(() => {})
  useEffect(() => { refresh() }, [])

  const handleRead = async (id: number) => { await markRead(id); refresh() }
  const markAll = async () => {
    await Promise.all(notifs.filter(n => !n.read).map(n => markRead(n.id)))
    refresh(); toast.success('All notifications marked as read')
  }
  const unread = notifs.filter(n => !n.read).length

  return (
    <div className="page-container max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-[11.5px] text-slate-400 mt-0.5">{unread} unread of {notifs.length}</p>
        </div>
        {unread > 0 && <button onClick={markAll} className="btn-secondary text-[11px]"><CheckCheck size={12} /> Mark all read</button>}
      </div>

      <div className="card divide-y divide-slate-100 p-0">
        {notifs.length === 0 && (
          <div className="text-center py-14 text-slate-400">
            <Bell size={28} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm font-bold text-slate-600">No notifications</div>
          </div>
        )}
        {notifs.map(n => {
          const meta = TYPE_ICON[n.type] || { icon:'🔔', bg:'#F1F5F9' }
          return (
            <div key={n.id} onClick={() => !n.read && handleRead(n.id)}
              className={`flex gap-3 p-4 cursor-pointer transition-colors ${n.read ? 'opacity-70' : 'hover:bg-blue-50/40'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: meta.bg }}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-slate-900 mb-0.5">{n.title}</div>
                <div className="text-[11.5px] text-slate-500 leading-relaxed">{n.message}</div>
                <div className="text-[10.5px] text-slate-400 mt-1">{n.createdAt?.replace('T',' · ').slice(0,18)}</div>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
