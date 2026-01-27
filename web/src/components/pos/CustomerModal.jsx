import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiX, FiUser, FiPhone, FiMail, FiMapPin } from 'react-icons/fi'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'

export default function CustomerModal({ onClose, onSelect, selectedCustomer }) {
  const { userData } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })

  React.useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const q = query(
        collection(db, 'customers'),
        where('companyId', '==', userData.companyId)
      )
      const snapshot = await getDocs(q)
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCustomers(customersList)
    } catch (error) {
      toast.error('فشل في تحميل العملاء')
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان')
      return
    }

    setLoading(true)
    try {
      const customerRef = await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        companyId: userData.companyId,
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      })

      const createdCustomer = {
        id: customerRef.id,
        ...newCustomer
      }

      setCustomers(prev => [createdCustomer, ...prev])
      onSelect(createdCustomer)
      toast.success('تم إضافة العميل بنجاح')
      setShowNewForm(false)
      setNewCustomer({ name: '', phone: '', email: '', address: '' })
    } catch (error) {
      toast.error('فشل في إضافة العميل')
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">اختيار عميل</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="ابحث عن عميل بالاسم أو الهاتف..."
              className="input-field w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!showNewForm ? (
            <>
              <div className="mb-6">
                <button
                  onClick={() => setShowNewForm(true)}
                  className="btn-primary w-full py-3"
                >
                  + إضافة عميل جديد
                </button>
              </div>

              <div className="space-y-3">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className={`card p-4 cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedCustomer?.id === customer.id ? 'border-2 border-primary-500' : ''
                    }`}
                    onClick={() => {
                      onSelect(customer)
                      onClose()
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">{customer.name}</h3>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-2 text-gray-400 text-sm">
                            <FiPhone className="w-4 h-4" />
                            {customer.phone}
                          </span>
                          {customer.email && (
                            <span className="flex items-center gap-2 text-gray-400 text-sm">
                              <FiMail className="w-4 h-4" />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-success font-medium">
                          {customer.balance?.toFixed(2) || '0.00'} ج.م
                        </span>
                        <p className="text-sm text-gray-400">الرصيد</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">إضافة عميل جديد</h3>
              
              <div>
                <label className="block text-gray-300 mb-2">اسم العميل *</label>
                <div className="relative">
                  <FiUser className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field w-full pr-10"
                    placeholder="أحمد محمد"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">رقم الهاتف *</label>
                <div className="relative">
                  <FiPhone className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field w-full pr-10"
                    placeholder="01001234567"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">البريد الإلكتروني</label>
                <div className="relative">
                  <FiMail className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field w-full pr-10"
                    placeholder="example@domain.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">العنوان</label>
                <div className="relative">
                  <FiMapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                    className="input-field w-full pr-10"
                    placeholder="العنوان التفصيلي"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="btn-secondary flex-1 py-3"
                >
                  رجوع
                </button>
                <button
                  onClick={handleCreateCustomer}
                  disabled={loading}
                  className="btn-primary flex-1 py-3"
                >
                  {loading ? 'جاري الإضافة...' : 'إضافة العميل'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
