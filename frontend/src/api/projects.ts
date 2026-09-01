import api from './axios'
export const getProjects = () => api.get('/projects').then(r => r.data.data)
export const getProject = (id: number) => api.get(`/projects/${id}`).then(r => r.data.data)
export const createProject = (data: any) => api.post('/projects', data).then(r => r.data.data)
export const addMember = (id: number, userId: number) => api.post(`/projects/${id}/members/${userId}`).then(r => r.data)
export const removeMember = (id: number, userId: number) => api.delete(`/projects/${id}/members/${userId}`).then(r => r.data)
export const deleteProject = (id: number) => api.delete(`/projects/${id}`).then(r => r.data)
export const updateProject = (id: number, data: any) => api.put(`/projects/${id}`, data).then(r => r.data.data)
