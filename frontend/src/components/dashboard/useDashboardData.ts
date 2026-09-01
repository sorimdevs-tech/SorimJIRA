import { useEffect, useState } from 'react'
import { getProjects } from '@/api/projects'
import { getSprintsByProject } from '@/api/sprints'
import { getTicketsByProject, getMyTickets } from '@/api/tickets'
import { getUsers } from '@/api/users'
import { getNotifications } from '@/api/notifications'
import { Project, Sprint, Ticket, User, Notification } from '@/types'

export interface DashboardData {
  projects: Project[]
  sprints: Sprint[]      // sprints of the first/primary project
  tickets: Ticket[]      // tickets of the first/primary project
  allTickets: Ticket[]   // tickets aggregated across all projects (bounded fetch)
  users: User[]
  myTickets: Ticket[]
  notifications: Notification[]
  loading: boolean
}

/**
 * Central data loader reused by every role dashboard.
 * Individual dashboards derive their own KPIs/sections from this
 * shared payload rather than each issuing ad-hoc fetches.
 */
import { wsClient } from '@/utils/websocket'

export function useDashboardData(): DashboardData {
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === 'PROJECT_UPDATED' || evt.type === 'SPRINT_UPDATED' || evt.type === 'TICKET_UPDATED' || evt.type === 'USER_REGISTERED') {
        setRefreshTrigger(prev => prev + 1)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [projs, usrs, notifs, mine] = await Promise.all([
          getProjects(), getUsers(), getNotifications().catch(() => []), getMyTickets().catch(() => []),
        ])
        if (cancelled) return
        setProjects(projs); setUsers(usrs); setNotifications(notifs); setMyTickets(mine)

        if (projs.length > 0) {
          const [sps, tks] = await Promise.all([
            getSprintsByProject(projs[0].id),
            getTicketsByProject(projs[0].id),
          ])
          if (cancelled) return
          setSprints(sps); setTickets(tks)

          // Aggregate tickets across up to the first 4 projects for org-wide views
          const others = await Promise.all(
            projs.slice(0, 4).map((p: Project) => getTicketsByProject(p.id).catch(() => []))
          )
          if (cancelled) return
          setAllTickets(others.flat())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshTrigger])

  return { projects, sprints, tickets, allTickets, users, myTickets, notifications, loading }
}
