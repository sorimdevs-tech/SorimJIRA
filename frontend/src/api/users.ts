import api from './axios'
export const getUsers = () => api.get('/users').then(r => r.data.data)
export const getMe = () => api.get('/users/me').then(r => r.data.data)
