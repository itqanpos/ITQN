import { useAuth } from '../../contexts/AuthContext'
import { FiLogOut, FiUser } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

export default function Topbar() {
  const { userData, logout } = useAuth()

  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      toast.success('تم تسجيل الخروج بنجاح')
    }
  }

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-gray-400">
            {new Date().toLocaleDateString('ar-EG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
              <FiUser className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium">{userData?.name}</p>
              <p className="text-sm text-gray-400">{userData?.role === 'admin' ? 'مدير' : 
                userData?.role === 'cashier' ? 'كاشير' : 'مندوب مبيعات'}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <FiLogOut />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </div>
    </header>
  )
}
