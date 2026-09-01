import api from './axios'
export const getSprintsByProject = (projectId: number) => api.get(`/sprints/project/${projectId}`).then(r => r.data.data)
export const getSprint = (id: number) => api.get(`/sprints/${id}`).then(r => r.data.data)
export const createSprint = (data: any) => api.post('/sprints', data).then(r => r.data.data)
export const startSprint = (id: number) => api.put(`/sprints/${id}/start`).then(r => r.data.data)
export const completeSprint = (id: number) => api.put(`/sprints/${id}/complete`).then(r => r.data.data)
export const deleteSprint = (id: number) => api.delete(`/sprints/${id}`).then(r => r.data)
export const updateSprint = (id: number, data: any) => api.put(`/sprints/${id}`, data).then(r => r.data.data)
