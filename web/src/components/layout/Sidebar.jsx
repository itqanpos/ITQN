import { Link, useLocation } from 'react-router-dom'
import { 
  FiHome, 
  FiShoppingCart, 
  FiPackage, 
  FiTrendingUp,
  FiUsers,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiClipboard
} from 'react-icons/fi'
import { motion } from 'framer-motion'

const menuItems = {
  admin: [
    { path: '/dashboard', label: 'لوحة التحكم', icon: FiHome },
    { path: '/pos', label: 'نقطة البيع', icon: FiShoppingCart },
    { path: '/products', label: 'المنتجات', icon: FiPackage },
    { path: '/inventory', label: 'المخزون', icon: FiTrendingUp },
    { path: '/customers', label: 'العملاء', icon: FiUsers },
    { path: '/sales', label: 'المبيعات', icon: FiDollarSign },
    { path: '/pending-orders', label: 'طلبات المندوبين', icon: FiClipboard },
    { path: '/treasury', label: 'الخزنة', icon: FiDollarSign },
    { path: '/reports', label: 'التقارير', icon: FiBarChart2 },
    { path: '/settings', label: 'الإعدادات', icon: FiSettings },
  ],
  cashier: [
    { path: '/pos', label: 'نقطة البيع', icon: FiShoppingCart },
    { path: '/products', label: 'المنتجات', icon: FiPackage },
    { path: '/customers', label: 'العملاء', icon: FiUsers },
    { path: '/sales', label: 'المبيعات', icon: FiDollarSign },
  ],
  sales_rep: [
    { path: '/dashboard', label: 'لوحة التحكم', icon: FiHome },
    { path: '/products', label: 'المنتجات', icon: FiPackage },
    { path: '/customers', label: 'العملاء', icon: FiUsers },
  ]
}

export default function Sidebar({ userRole = 'admin' }) {
  const location = useLocation()
  const items = menuItems[userRole] || menuItems.admin

  return (
    <motion.aside 
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col"
    >
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">نظام ERP</h1>
        <p className="text-gray-400 text-sm">إدارة متكاملة</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-primary-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </motion.aside>
  )
}
