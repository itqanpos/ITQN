import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { FiMail, FiLock, FiUser, FiUserPlus } from 'react-icons/fi'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('كلمات المرور غير متطابقة')
      return
    }
    
    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    
    setLoading(true)
    
    const result = await signup(email, password)
    
    if (result.success) {
      toast.success('تم إنشاء الحساب بنجاح')
      navigate('/login')
    } else {
      toast.error(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إنشاء حساب جديد</h1>
          <p className="text-gray-400">أدخل بياناتك لإنشاء حساب جديد</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">الاسم الكامل</label>
            <div className="relative">
              <FiUser className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full pr-10"
                placeholder="أحمد محمد"
                required
              />
            </div>
          </div>
          
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
          
          <div>
            <label className="block text-gray-300 mb-2">تأكيد كلمة المرور</label>
            <div className="relative">
              <FiLock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            <FiUserPlus />
            {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
          
          <div className="text-center">
            <p className="text-gray-400">
              لديك حساب بالفعل؟{' '}
              <Link to="/login" className="text-primary-500 hover:underline">
                سجل الدخول
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
