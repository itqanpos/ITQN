import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../../contexts/AuthContext'

export default function Layout() {
  const { userData } = useAuth()

  return (
    <div className="flex h-screen">
      <Sidebar userRole={userData?.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
