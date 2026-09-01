import { createSlice, PayloadAction } from '@reduxjs/toolkit'
interface AuthUser { id: number; fullName: string; email: string; role: string; initials: string; avatarColor: string; }
interface AuthState { token: string | null; refreshToken: string | null; user: AuthUser | null; }
const saved = localStorage.getItem('fs_auth')
const initial: AuthState = saved ? JSON.parse(saved) : { token: null, refreshToken: null, user: null }
const authSlice = createSlice({
  name: 'auth', initialState: initial,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; refreshToken: string; user: AuthUser }>) {
      state.token = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.user = action.payload.user
      localStorage.setItem('fs_auth', JSON.stringify(state))
    },
    logout(state) { state.token = null; state.refreshToken = null; state.user = null; localStorage.removeItem('fs_auth') }
  }
})
export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
