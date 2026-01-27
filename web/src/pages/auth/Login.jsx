import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const result = await login(email, password)
    
    if (result.success) {
      toast.success('تم تسجيل الدخول بنجاح')
      navigate('/')
    } else {
      toast.error(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">نظام ERP + POS</h1>
          <p className="text-gray-400">تسجيل الدخول للنظام</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">البريد الإلكتروني</label>
            <div className="relative">
              <FiMail className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="example@domain.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">كلمة المرور</label>
            <div className="relative">
              <FiLock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            <FiLogIn />
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
          
          <div className="text-center">
            <p className="text-gray-400">
              ليس لديك حساب؟{' '}
              <Link to="/register" className="text-primary-500 hover:underline">
                أنشئ حساب جديد
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
