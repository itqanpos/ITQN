import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getCountFromServer,
  sum 
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { 
  FiDollarSign, 
  FiUsers, 
  FiPackage, 
  FiTrendingUp,
  FiShoppingCart,
  FiCreditCard
} from 'react-icons/fi'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const { userData } = useAuth()
  const { companyData } = useCompany()
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    todaySales: 0,
    pendingOrders: 0,
    treasuryBalance: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [userData])

  const loadDashboardStats = async () => {
    if (!userData?.companyId) return

    try {
      const companyId = userData.companyId
      const today = new Date().toISOString().split('T')[0]

      // عدد المنتجات
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', companyId)
      )
      const productsSnapshot = await getCountFromServer(productsQuery)
      
      // عدد العملاء
      const customersQuery = query(
        collection(db, 'customers'),
        where('companyId', '==', companyId)
      )
      const customersSnapshot = await getCountFromServer(customersQuery)
      
      // إجمالي المبيعات
      const salesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', companyId)
      )
      const salesSnapshot = await getDocs(salesQuery)
      const totalSales = salesSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().total || 0)
      }, 0)
      
      // مبيعات اليوم
      const todaySalesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', new Date(today))
      )
      const todaySalesSnapshot = await getDocs(todaySalesQuery)
      const todaySales = todaySalesSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().total || 0)
      }, 0)
      
      // الطلبات المعلقة
      const pendingOrdersQuery = query(
        collection(db, 'pending_orders'),
        where('companyId', '==', companyId),
        where('status', '==', 'pending')
      )
      const pendingOrdersSnapshot = await getCountFromServer(pendingOrdersQuery)
      
      // رصيد الخزنة
      const treasuryQuery = query(
        collection(db, 'treasury_daily'),
        where('companyId', '==', companyId)
      )
      const treasurySnapshot = await getDocs(treasuryQuery)
      const latestTreasury = treasurySnapshot.docs
        .sort((a, b) => b.data().date.localeCompare(a.data().date))[0]
      const treasuryBalance = latestTreasury?.data()?.closingBalance || 0

      setStats({
        totalSales,
        totalProducts: productsSnapshot.data().count,
        totalCustomers: customersSnapshot.data().count,
        todaySales,
        pendingOrders: pendingOrdersSnapshot.data().count,
        treasuryBalance
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'إجمالي المبيعات',
      value: `${stats.totalSales.toFixed(2)} ج.م`,
      icon: FiTrendingUp,
      color: 'bg-green-500'
    },
    {
      title: 'مبيعات اليوم',
      value: `${stats.todaySales.toFixed(2)} ج.م`,
      icon: FiShoppingCart,
      color: 'bg-blue-500'
    },
    {
      title: 'المنتجات',
      value: stats.totalProducts,
      icon: FiPackage,
      color: 'bg-purple-500'
    },
    {
      title: 'العملاء',
      value: stats.totalCustomers,
      icon: FiUsers,
      color: 'bg-yellow-500'
    },
    {
      title: 'طلبات معلقة',
      value: stats.pendingOrders,
      icon: FiCreditCard,
      color: 'bg-red-500'
    },
    {
      title: 'رصيد الخزنة',
      value: `${stats.treasuryBalance.toFixed(2)} ج.م`,
      icon: FiDollarSign,
      color: 'bg-indigo-500'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري تحميل البيانات...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
        <p className="text-gray-400">مرحباً بك، {userData?.name}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-full`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
