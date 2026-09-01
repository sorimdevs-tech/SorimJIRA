import api from './axios'
export const getNotifications = () => api.get('/notifications').then(r => r.data.data)
export const getUnreadCount = () => api.get('/notifications/unread-count').then(r => r.data.data)
export const markRead = (id: number) => api.put(`/notifications/${id}/read`).then(r => r.data)
