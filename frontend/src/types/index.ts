export interface User {
  id: number; firstName: string; lastName: string; fullName: string;
  email: string; role: string; initials: string; avatarColor: string;
  active: boolean; taskCount?: number; utilizationPercent?: number;
  lastLoginTime?: string; lastLogoutTime?: string;
  department?: string; position?: string; passwordChanged?: boolean; addedByAdmin?: boolean;
}

export interface Project {
  id: number; projectKey: string; name: string; description: string; emoji: string;
  status: string; priority: string; startDate: string; endDate: string;
  gitRepo?: string; duration?: string;
  owner: User; members: User[]; totalTickets: number; openTickets: number;
  totalSprints: number; progressPercent: number; hasAccess?: boolean; createdAt: string;
}

export interface Sprint {
  id: number; name: string; goal: string; startDate: string; endDate: string;
  capacityPoints: number; completedPoints: number; status: string;
  progressPercent: number; totalTickets: number; closedTickets: number;
  inProgressTickets: number; tickets: Ticket[];
}

export interface Ticket {
  id: number; ticketKey: string; title: string; description: string;
  storyPoints: number; status: TicketStatus; priority: Priority;
  dueDate: string; assignee: User; assigner: User; reporter: User;
  projectName: string; projectKey: string; projectId?: number; sprintName: string; sprintId: number;
  testerApproved: boolean; managerApproved: boolean; closureNotes: string;
  comments: Comment[]; createdAt: string; updatedAt: string;
}

export interface Comment {
  id: number; content: string; author: User; createdAt: string;
}

export interface Notification {
  id: number; type: string; title: string; message: string;
  read: boolean; relatedTicketId?: number; createdAt: string;
}

export interface AITask {
  title: string; description: string; storyPoints: number;
  priority: string; suggestedRole: string; type: string;
}

export interface AITaskResponse {
  tasks: AITask[]; totalPoints: number; generatedFor: string;
}

export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'COMPLETED' | 'CLOSED'
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export const PRIORITY_TAG: Record<string, string> = {
  CRITICAL: 'tag-red', HIGH: 'tag-amber', MEDIUM: 'tag-blue', LOW: 'tag-gray'
}
export const STATUS_TAG: Record<string, string> = {
  TODO: 'tag-gray', IN_PROGRESS: 'tag-blue', IN_REVIEW: 'tag-amber',
  TESTING: 'tag-purple', COMPLETED: 'tag-teal', CLOSED: 'tag-green'
}
export const PROJECT_STATUS_TAG: Record<string, string> = {
  PLANNING: 'tag-amber', ACTIVE: 'tag-blue', ON_HOLD: 'tag-gray',
  COMPLETED: 'tag-green', ARCHIVED: 'tag-gray'
}
export const SPRINT_STATUS_TAG: Record<string, string> = {
  PLANNED: 'tag-gray', ACTIVE: 'tag-blue', COMPLETED: 'tag-green', CANCELLED: 'tag-red'
}
