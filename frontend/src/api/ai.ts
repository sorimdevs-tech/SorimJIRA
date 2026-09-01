import api from './axios'
export const generateTasks = (data: { projectDescription: string; projectType?: string; sprintId?: number }) =>
  api.post('/ai/generate-tasks', data).then(r => r.data.data)

export const acceptTasks = (data: { sprintId: number; tasks: any[] }) =>
  api.post('/ai/accept-tasks', data).then(r => r.data)
