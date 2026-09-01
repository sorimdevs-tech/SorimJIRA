import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/slices/authSlice'
import { login, register as registerApi } from '@/api/auth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Edit, HelpCircle, Shield, ArrowLeft, Smartphone, MessageSquare, Key, ChevronRight } from 'lucide-react'
import api from '@/api/axios'

const ROLES = ['Admin', 'Scrum Master', 'Project Owner', 'CTO', 'VP', 'Manager', 'Developer', 'Tester', 'Trainee']

const COUNTRY_CODES = [
  { code: '+1', name: 'US/Canada' },
  { code: '+91', name: 'India' },
  { code: '+44', name: 'UK' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
]

const DEFAULT_DEMO_ACCOUNTS: Record<string, { email: string; password: string; name: string; initials: string; color: string }> = {}

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [demoAccounts, setDemoAccounts] = useState(() => {
    const saved = localStorage.getItem('fs_demo_accounts')
    if (saved) {
      const parsed = JSON.parse(saved)
      const merged = { ...DEFAULT_DEMO_ACCOUNTS }
      Object.keys(parsed).forEach(role => {
        if (merged[role]) {
          merged[role] = { ...merged[role], email: parsed[role].email, password: parsed[role].password }
        }
      })
      return merged
    }
    return DEFAULT_DEMO_ACCOUNTS
  })

  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState('Admin')
  const [showPassword, setShowPassword] = useState(false)
  
  // Steps: 'LOGIN' | 'VERIFY' | 'REGISTER' | 'CHANGE_PASSWORD'
  const [step, setStep] = useState<'LOGIN' | 'VERIFY' | 'REGISTER' | 'CHANGE_PASSWORD'>('LOGIN')
  const [tempAuthData, setTempAuthData] = useState<any>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Methods: 'AUTHENTICATOR' | 'SMS' | 'BACKUP'
  const [authMethod, setAuthMethod] = useState<'AUTHENTICATOR' | 'SMS' | 'BACKUP'>('AUTHENTICATOR')
  
  // Digit arrays
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [expectedMfa, setExpectedMfa] = useState('')
  
  // SMS states
  const [countryCode, setCountryCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [expectedSms, setExpectedSms] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsDigits, setSmsDigits] = useState<string[]>(Array(6).fill(''))

  // Backup Code states
  const [backupCodeInput, setBackupCodeInput] = useState('')
  const [expectedBackup] = useState('883-294-118')

  // Registration States
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('DEVELOPER')

  // Rename Profile States
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renamingRole, setRenamingRole] = useState('')
  const [renameEmail, setRenameEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [renameFirstName, setRenameFirstName] = useState('')
  const [renameLastName, setRenameLastName] = useState('')

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  // Edit Login Credentials States
  const [showEditCredentialsModal, setShowEditCredentialsModal] = useState(false)
  const [editCurrentEmail, setEditCurrentEmail] = useState('')
  const [editNewEmail, setEditNewEmail] = useState('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const [projectRedirect, setProjectRedirect] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    const emailParam = params.get('email')
    const redirectParam = params.get('redirect')
    if (emailParam) {
      setEmail(emailParam)
    }
    if (action === 'reset-password' && emailParam) {
      setStep('CHANGE_PASSWORD')
    }
    if (redirectParam) {
      setProjectRedirect(redirectParam)
    }
  }, [])

  const selectRole = (role: string) => {
    setSelectedRole(role)
    const acc = demoAccounts[role]
    if (acc) {
      setEmail(acc.email)
      setPass(acc.password)
    }
    setDigits(Array(6).fill(''))
    setSmsDigits(Array(6).fill(''))
    setSmsSent(false)
    setPhoneNumber('')
    setBackupCodeInput('')
    setExpectedMfa(Math.floor(100000 + Math.random() * 900000).toString())
  }

  const handleRestoreDefaults = async () => {
    if (!window.confirm("Are you sure you want to restore all demo profiles to defaults?")) return
    try {
      await api.post('/auth/reset-defaults')
      localStorage.removeItem('fs_demo_accounts')
      setDemoAccounts(DEFAULT_DEMO_ACCOUNTS)
      const acc = DEFAULT_DEMO_ACCOUNTS[selectedRole]
      if (acc) {
        setEmail(acc.email)
        setPass(acc.password)
      }
      toast.success("All demo profiles restored to defaults successfully! 🔄")
    } catch (err: any) {
      toast.error("Failed to restore default profiles")
    }
  }

  const triggerSmsProof = async () => {
    if (!phoneNumber.trim()) {
      return toast.error('Please enter your phone number first')
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setExpectedSms(code)
    console.log(`[Developer Console] Expected SMS Code generated: ${code}`)
    setSmsDigits(Array(6).fill(''))
    setSmsSent(true)
    
    try {
      const fullPhone = countryCode + phoneNumber
      const res = await api.post('/auth/send-sms', { phone: fullPhone, code: code })
      
      const responseBody = res.data?.data
      let isSuccess = false
      let gatewayError = ''
      
      try {
        if (responseBody) {
          const parsed = JSON.parse(responseBody)
          isSuccess = parsed.success === true
          if (parsed.error) {
            gatewayError = parsed.error
          }
        }
      } catch (e) {
        isSuccess = res.data?.success && !responseBody?.includes('"success":false')
      }

      if (isSuccess) {
        toast.success(`Verification SMS sent to ${fullPhone}! 📲`)
      } else {
        const detail = gatewayError || 'Free SMS limit reached (1/day per IP)'
        toast.error(`SMS Gateway: ${detail}`)
      }
    } catch (err: any) {
      toast.error('Failed to connect to SMS gateway. Sandbox mode: Check F12 console for code.')
    }
  }

  const handleDigitChange = (value: string, idx: number, isSms: boolean) => {
    const cleanVal = value.replace(/[^0-9]/g, '').slice(-1)
    if (isSms) {
      const copy = [...smsDigits]
      copy[idx] = cleanVal
      setSmsDigits(copy)
      if (cleanVal && idx < 5) {
        document.getElementById(`sms-digit-${idx + 1}`)?.focus()
      }
    } else {
      const copy = [...digits]
      copy[idx] = cleanVal
      setDigits(copy)
      if (cleanVal && idx < 5) {
        document.getElementById(`mfa-digit-${idx + 1}`)?.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, idx: number, isSms: boolean) => {
    if (e.key === 'Backspace') {
      if (isSms) {
        if (!smsDigits[idx] && idx > 0) {
          const copy = [...smsDigits]
          copy[idx - 1] = ''
          setSmsDigits(copy)
          document.getElementById(`sms-digit-${idx - 1}`)?.focus()
        } else {
          const copy = [...smsDigits]
          copy[idx] = ''
          setSmsDigits(copy)
        }
      } else {
        if (!digits[idx] && idx > 0) {
          const copy = [...digits]
          copy[idx - 1] = ''
          setDigits(copy)
          document.getElementById(`mfa-digit-${idx - 1}`)?.focus()
        } else {
          const copy = [...digits]
          copy[idx] = ''
          setDigits(copy)
        }
      }
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      return toast.error('Please enter email and password')
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const data = res.data.data
      if (data.mfaRequired) {
        setDigits(Array(6).fill(''))
        if (data.mfaCode) {
          setExpectedMfa(data.mfaCode)
        } else {
          setExpectedMfa('')
        }
        setOldPassword(password)
        setStep('VERIFY')
      } else if (data.passwordChanged === false) {
        setTempAuthData(data)
        setOldPassword(password)
        setStep('CHANGE_PASSWORD')
      } else {
        dispatch(setCredentials(data))
        toast.success(`Welcome back, ${data.user.fullName}! 👋`)
        navigate(projectRedirect || '/dashboard')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const code = digits.join('')
    if (expectedMfa && code !== expectedMfa) {
      return toast.error('Code mismatch! Please enter the code shown in the Security token banner.')
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password, mfaCode: code })
      const data = res.data.data
      
      if (data.passwordChanged === false) {
        setTempAuthData(data)
        setOldPassword(password)
        setStep('CHANGE_PASSWORD')
      } else {
        dispatch(setCredentials(data))
        toast.success(`Welcome back, ${data.user.fullName}! 👋`)
        navigate(projectRedirect || '/dashboard')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed. Check verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword.trim()) {
      return toast.error('Please enter your current/temporary password')
    }
    if (!newPassword.trim() || !confirmPassword.trim()) {
      return toast.error('New password and confirm password are required')
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match')
    }
    if (newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters')
    }
    if (newPassword === oldPassword) {
      return toast.error('New password cannot be the same as your old password')
    }
    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        email,
        oldPassword,
        newPassword,
        confirmPassword
      })
      toast.success('Password updated successfully! Welcome to IntelliSprint. 🎉')
      
      // If we had tempAuthData from verification, we can dispatch it and login directly
      if (tempAuthData) {
        const authenticatedUser = {
          ...tempAuthData,
          passwordChanged: true,
          user: { ...tempAuthData.user, passwordChanged: true }
        }
        dispatch(setCredentials(authenticatedUser))
        setTempAuthData(null)
        setPass('')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        navigate(projectRedirect || '/dashboard')
      } else {
        setPass('')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setStep('LOGIN')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password. Verify your current password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regFirstName.trim() || !regLastName.trim() || !regEmail.trim() || !regPassword.trim()) {
      return toast.error('All fields are required')
    }
    setLoading(true)
    try {
      await registerApi({
        firstName: regFirstName,
        lastName: regLastName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        avatarColor: '#4F46E5'
      })
      toast.success('Registration successful! Please check your email and log in.')
      
      // Auto fill details for the login stage
      setEmail(regEmail)
      setPass('') // Enforce typing the password they received or set
      
      // Proceed to login screen to start the temporary password change process
      setStep('LOGIN')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed. Try a different email.')
    } finally {
      setLoading(false)
    }
  }

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameFirstName.trim() || !renameLastName.trim() || !newEmail.trim()) {
      return toast.error('All fields are required')
    }
    try {
      await api.put('/auth/rename-by-email', {
        email: renameEmail,
        newEmail: newEmail,
        firstName: renameFirstName,
        lastName: renameLastName
      })

      const updatedAccounts = {
        ...demoAccounts,
        [renamingRole]: {
          ...demoAccounts[renamingRole],
          email: newEmail,
          password: 'password123',
          name: `${renameFirstName} ${renameLastName}`,
          initials: (renameFirstName[0] || '') + (renameLastName[0] || '').toUpperCase()
        }
      }
      setDemoAccounts(updatedAccounts)
      
      const saveObj: Record<string, any> = {}
      Object.keys(updatedAccounts).forEach(r => {
        saveObj[r] = { email: updatedAccounts[r].email, password: updatedAccounts[r].password }
      })
      localStorage.setItem('fs_demo_accounts', JSON.stringify(saveObj))

      if (selectedRole === renamingRole) {
        setEmail(newEmail)
      }

      toast.success(`Demo profile updated successfully to ${renameFirstName} ${renameLastName} (${newEmail})! 🎉`)
      setShowRenameModal(false)
    } catch (err: any) {
      toast.error('Failed to update profile')
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      return toast.error('Please enter a valid email address')
    }
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail })
      toast.success(`Password reset email dispatched to ${forgotEmail}! Check inbox. ✉️`)
      setShowForgotModal(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch password reset request')
    }
  }

  const handleEditCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCurrentEmail.trim()) {
      return toast.error("Current email address is required")
    }

    setEditSubmitting(true)
    try {
      await api.put('/auth/update-profile', {
        email: editCurrentEmail,
        newEmail: editNewEmail || undefined,
        password: editNewPassword || undefined
      })
      toast.success("Profile credentials updated successfully! 🎉")
      setEmail(editNewEmail || editCurrentEmail)
      if (editNewPassword) {
        setPass(editNewPassword)
      }
      setShowEditCredentialsModal(false)
      setEditCurrentEmail('')
      setEditNewEmail('')
      setEditNewPassword('')
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update credentials")
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F4F5F7]">
      
      {/* LEFT PANEL: Light premium side panel */}
      <div 
        className="w-full md:w-[35%] flex flex-col justify-start p-8 md:p-12 relative overflow-hidden select-none border-b md:border-b-0 md:border-r border-slate-200"
        style={{ backgroundColor: '#E2ECE9' }}
      >
        <div className="space-y-12">
          {/* Brand/Logo Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm">IS</div>
            <span className="text-lg font-black text-slate-800 tracking-tight">IntelliSprint</span>
            <span className="text-[9px] font-bold bg-gradient-to-r from-brand to-fs-amber text-white px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)]">AI</span>
          </div>

          {/* Middle Main Content */}
          <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              Plan, track, and release great software
            </h1>
            <p className="text-xs md:text-[13px] text-slate-600 leading-relaxed max-w-sm">
              Sign in to continue to IntelliSprint
            </p>

            {/* Feature lists */}
            <div className="space-y-4 pt-4">
              {[
                { title: 'Accelerate delivery', desc: 'Plan smarter, ship faster and get value to users sooner.', emoji: '⚡' },
                { title: 'Align your team', desc: 'Break down silos and connect everyone to the work that matters.', emoji: '👥' },
                { title: 'Data-driven decisions', desc: 'Gain insights and optimize every step of your workflow.', emoji: '📊' }
              ].map(f => (
                <div key={f.title} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-sm shadow-sm flex-shrink-0">{f.emoji}</div>
                  <div>
                    <h3 className="text-[12px] font-bold text-slate-800">{f.title}</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Brand */}
        <div className="mt-auto pt-16 flex items-center gap-1.5 text-slate-500">
          <span className="text-[10px] font-black uppercase tracking-wider">▲ IntelliSprint</span>
          <span className="text-[9px] text-slate-400">/ Dream Team 💛</span>
        </div>
      </div>

      {/* RIGHT PANEL: Login form area */}
      <div className="flex-1 flex flex-col justify-between p-8 md:p-12 relative bg-[#F4F5F7]">
        


        {/* Login Card Wrapper */}
        <div className="max-w-[400px] w-full mx-auto my-auto py-6">
          
          {/* STEP 1: CREDENTIALS LOGIN CARD */}
          {step === 'LOGIN' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center mx-auto mb-2 text-white text-sm font-black shadow-sm">IS</div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Welcome back! 👋</h2>
                <p className="text-[12.5px] text-slate-500">Log in to your IntelliSprint account</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Address Input */}
                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Email address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                    required
                  />
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Password</label>
                  </div>
                  <div className="relative">
                    <input 
                      className="field-input pr-10 text-[13px]" 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPass(e.target.value)} 
                      required 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 bg-transparent border-0 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me and Forgot Password */}
                <div className="flex justify-between items-center text-[12px] pt-1">
                  <label className="flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
                    <input type="checkbox" className="rounded text-brand focus:ring-brand border-slate-300 w-3.5 h-3.5" defaultChecked />
                    Remember me
                  </label>
                  <a 
                    href="#forgot" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      setForgotEmail(email); 
                      setShowForgotModal(true); 
                    }} 
                    className="text-brand hover:underline font-bold"
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Submit to Verification Step */}
                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-brand hover:bg-brand/95 text-white text-[12.5px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  Log in
                </button>
              </form>

              {/* Edit Profile Credentials Link */}
              <div className="text-center pt-2 text-[12px]">
                <button 
                  type="button" 
                  onClick={() => {
                    setEditCurrentEmail(email)
                    setShowEditCredentialsModal(true)
                  }} 
                  className="text-brand hover:underline font-bold bg-transparent border-0 cursor-pointer"
                >
                  ✏️ Edit Login Profile (Email/Password)
                </button>
              </div>

              {/* Create Account Link */}
              <div className="text-center pt-4 border-t border-slate-100 text-[12px] text-slate-500">
                New to IntelliSprint? <button onClick={() => setStep('REGISTER')} className="text-brand hover:underline font-bold bg-transparent border-0 cursor-pointer">Create an account</button>
              </div>
            </div>
          )}

          {/* STEP 2: REGISTER CARD */}
          {step === 'REGISTER' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center mx-auto mb-2 text-white text-sm font-black shadow-sm">IS</div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create your account</h2>
                <p className="text-[12.5px] text-slate-500">Sign up to get started with IntelliSprint</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">First Name</label>
                    <input 
                      type="text" 
                      value={regFirstName} 
                      onChange={e => setRegFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Last Name</label>
                    <input 
                      type="text" 
                      value={regLastName} 
                      onChange={e => setRegLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Email address</label>
                  <input 
                    type="email" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                    required
                  />
                </div>

                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Password</label>
                  <input 
                    type="password" 
                    value={regPassword} 
                    onChange={e => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                    required
                  />
                </div>

                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Role</label>
                  <select 
                    value={regRole} 
                    onChange={e => setRegRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="SCRUM_MASTER">Scrum Master</option>
                    <option value="PROJECT_OWNER">Project Owner</option>
                    <option value="CTO">CTO</option>
                    <option value="VP">VP</option>
                    <option value="MANAGER">Manager</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="TESTER">Tester</option>
                    <option value="TRAINEE">Trainee</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 bg-brand hover:bg-brand/95 text-white text-[12.5px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div className="text-center pt-2 text-[12px] text-slate-500">
                Already have an account? <button onClick={() => setStep('LOGIN')} className="text-brand hover:underline font-bold bg-transparent border-0 cursor-pointer">Log in</button>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFICATION IDENTITY CARD */}
          {step === 'VERIFY' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              
              {/* Card Header Back Link */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setStep('LOGIN')}
                  className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <div className="text-brand/80"><Shield size={16} /></div>
              </div>

              {/* Shield lock Icon Image */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 text-3xl shadow-inner">
                  🔐
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Verify your identity</h2>
                <p className="text-[11.5px] text-slate-500 leading-relaxed max-w-[280px]">
                  Multi-factor authentication is enabled for your account.
                </p>
              </div>

              {/* Form Body */}
              <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <div className="space-y-4">
                  {/* Live banner displaying expected code */}
                  {expectedMfa ? (
                    <div className="bg-amber-50/50 border border-amber-200/60 rounded-lg p-2.5 flex justify-between items-center">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">🔐 Security token</span>
                        <span className="text-[9.5px] text-amber-600">Enter code below to authorize</span>
                      </div>
                      <div className="font-mono font-black text-sm tracking-wider bg-white text-slate-800 px-2.5 py-1 rounded border border-amber-200 shadow-sm">{expectedMfa}</div>
                    </div>
                  ) : (
                    <div className="bg-blue-50/50 border border-blue-200/60 rounded-lg p-2.5 text-left">
                      <span className="text-[10px] font-bold text-blue-800 uppercase block">✉️ Verification Code Sent</span>
                      <span className="text-[11px] text-blue-600">A 6-digit authentication code has been sent directly to your registered email address.</span>
                    </div>
                  )}

                  <div className="space-y-2 text-center">
                    <p className="text-[11.5px] text-slate-500 font-semibold">Enter the 6-digit code</p>
                    
                    {/* Individual input digit boxes */}
                    <div className="flex justify-center gap-1.5">
                      {digits.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`mfa-digit-${idx}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleDigitChange(e.target.value, idx, false)}
                          onKeyDown={e => handleKeyDown(e, idx, false)}
                          className="w-10 h-11 text-center bg-white border border-slate-200 rounded-md text-[16px] font-black text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-sm"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verify Button */}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 bg-brand hover:bg-brand/95 text-white text-[12.5px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>

              {/* Troubleshooting link */}
              <div className="text-center pt-2 text-[11.5px] text-slate-400">
                Having trouble? <a href="#help" onClick={(e) => { e.preventDefault(); toast(`Current verification token is active: ${expectedMfa || 'Sent to email'}`, { icon: '🔑' }); }} className="text-brand hover:underline font-bold">Get help</a>
              </div>
            </div>
          )}

          {/* STEP 4: CHANGE PASSWORD CARD */}
          {step === 'CHANGE_PASSWORD' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center mx-auto mb-2 text-white text-sm font-black shadow-sm">🔑</div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Set a New Password</h2>
                <p className="text-[12px] text-slate-500">You are signing in with temporary credentials. Verify your current password and create a new secure password.</p>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Current / Temporary Password</label>
                  <div className="relative">
                    <input 
                      type={showOldPassword ? "text" : "password"} 
                      value={oldPassword} 
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="Enter temporary password (e.g. EMP-12345)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer p-0.5"
                    >
                      {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">New Password</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer p-0.5"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="field-label text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-850 focus:outline-none focus:border-brand"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 bg-brand hover:bg-brand/95 text-white text-[12.5px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  {loading ? 'Updating Password...' : 'Update Password & Access Dashboard'}
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Footer Policy Links */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400 text-center pb-2">
          <a href="#privacy" className="hover:text-slate-600">Privacy policy</a>
          <span>·</span>
          <a href="#notice" className="hover:text-slate-600">User notice</a>
          <span>·</span>
          <a href="#cookie" className="hover:text-slate-600">Cookie policy</a>
          <span>·</span>
          <span>© 2026 IntelliSprint</span>
        </div>
      </div>

      {/* Rename Profile Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs tracking-wide">Edit Demo Profile: {renamingRole}</h3>
              <button type="button" onClick={() => setShowRenameModal(false)} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleRenameSubmit} className="p-5 space-y-4">
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                You are updating the user record for <strong>{renameEmail}</strong>.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">FIRST NAME *</label>
                  <input
                    type="text"
                    className="field-input text-xs"
                    placeholder="New First Name"
                    value={renameFirstName}
                    onChange={e => setRenameFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">LAST NAME *</label>
                  <input
                    type="text"
                    className="field-input text-xs"
                    placeholder="New Last Name"
                    value={renameLastName}
                    onChange={e => setRenameLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">EMAIL ADDRESS *</label>
                <input
                  type="email"
                  className="field-input text-xs"
                  placeholder="New Email Address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowRenameModal(false)} className="btn-secondary text-[11px] py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-[11px] py-1.5">Apply Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs tracking-wide">Reset Account Password</h3>
              <button type="button" onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="p-5 space-y-4">
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                Enter your registered email address to receive password reset instructions.
              </div>
              <div>
                <label className="field-label">EMAIL ADDRESS *</label>
                <input
                  type="email"
                  className="field-input text-xs"
                  placeholder="e.g. sarah.chen@sorim.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForgotModal(false)} className="btn-secondary text-[11px] py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-[11px] py-1.5">Send Reset Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Login Credentials Modal */}
      {showEditCredentialsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs tracking-wide">✏️ Edit Login Credentials</h3>
              <button 
                type="button" 
                onClick={() => setShowEditCredentialsModal(false)} 
                className="text-slate-400 hover:text-white text-xs font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditCredentialsSubmit} className="p-5 space-y-4">
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                Modify the email address and password of any account before authenticating.
              </div>
              <div>
                <label className="field-label text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">CURRENT EMAIL ADDRESS *</label>
                <input
                  type="email"
                  className="field-input text-xs"
                  placeholder="e.g. admin@sorim.com"
                  value={editCurrentEmail}
                  onChange={e => setEditCurrentEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">NEW EMAIL ADDRESS (OPTIONAL)</label>
                <input
                  type="email"
                  className="field-input text-xs"
                  placeholder="Leave blank to keep unchanged"
                  value={editNewEmail}
                  onChange={e => setEditNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">NEW PASSWORD (OPTIONAL)</label>
                <input
                  type="password"
                  className="field-input text-xs"
                  placeholder="Leave blank to keep unchanged"
                  value={editNewPassword}
                  onChange={e => setEditNewPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowEditCredentialsModal(false)} 
                  className="btn-secondary text-[11px] py-1.5"
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary text-[11px] py-1.5"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
