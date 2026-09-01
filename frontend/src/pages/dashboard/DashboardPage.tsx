import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { useDashboardData } from '@/components/dashboard/useDashboardData'
import { RoleTag } from '@/components/dashboard/shared'
import ScrumMasterDashboard from './roles/ScrumMasterDashboard'
import DeveloperDashboard from './roles/DeveloperDashboard'
import TesterDashboard from './roles/TesterDashboard'
import ManagerDashboard from './roles/ManagerDashboard'
import ProjectOwnerDashboard from './roles/ProjectOwnerDashboard'
import CTODashboard from './roles/CTODashboard'
import VPDashboard from './roles/VPDashboard'
import TraineeDashboard from './roles/TraineeDashboard'
import AdminDashboard from './roles/AdminDashboard'

const DASHBOARD_TITLES: Record<string, string> = {
  ADMIN: 'Admin Dashboard',
  SCRUM_MASTER: 'Scrum Master Dashboard',
  PROJECT_OWNER: 'Project Owner Dashboard',
  CTO: 'CTO Dashboard',
  VP: 'VP Dashboard',
  MANAGER: 'Manager Dashboard',
  DEVELOPER: 'Developer Dashboard',
  TESTER: 'Tester Dashboard',
  TRAINEE: 'Trainee Dashboard',
}

export default function DashboardPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const data = useDashboardData()
  const role = user?.role || 'DEVELOPER'

  if (data.loading) return (
    <div className="page-container flex items-center justify-center h-64">
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  )

  const renderRoleDashboard = () => {
    switch (role) {
      case 'ADMIN':         return <AdminDashboard data={data} />
      case 'SCRUM_MASTER':  return <ScrumMasterDashboard data={data} />
      case 'PROJECT_OWNER': return <ProjectOwnerDashboard data={data} />
      case 'CTO':           return <CTODashboard data={data} />
      case 'VP':            return <VPDashboard data={data} />
      case 'MANAGER':       return <ManagerDashboard data={data} />
      case 'TESTER':        return <TesterDashboard data={data} />
      case 'TRAINEE':       return <TraineeDashboard data={data} />
      case 'DEVELOPER':
      default:              return <DeveloperDashboard data={data} />
    }
  }

  const getGreeting = () => {
    const hrs = new Date().getHours()
    if (hrs < 12) return 'Good morning'
    if (hrs < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="page-container">
      {role !== 'ADMIN' && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {getGreeting()}, {user?.fullName?.split(' ')[0]} 👋
              </h1>
              <RoleTag role={role} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {(DASHBOARD_TITLES[role] || (role.replace('_', ' ') + ' Dashboard'))} · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      )}
      {renderRoleDashboard()}
    </div>
  )
}
