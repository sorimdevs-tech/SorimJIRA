import api from './axios'
export const login = (email: string, password: string, mfaCode?: string) =>
  api.post('/auth/login', { email, password, mfaCode }).then(r => r.data.data)
export const register = (data: any) =>
  api.post('/auth/register', data).then(r => r.data.data)
export const logoutUser = (email: string) =>
  api.post('/auth/logout', { email }).then(r => r.data)
