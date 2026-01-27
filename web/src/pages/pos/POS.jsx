import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Cart from '../../components/pos/Cart'
import ProductGrid from '../../components/pos/ProductGrid'
import CustomerModal from '../../components/pos/CustomerModal'
import PaymentModal from '../../components/pos/PaymentModal'
import { useAuth } from '../../contexts/AuthContext'
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  updateDoc,
  doc,
  increment,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'
import { db, functions } from '../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { toast } from 'react-hot-toast'
import { FiSearch, FiPrinter, FiUserPlus } from 'react-icons/fi'

export default function POS() {
  const { userData } = useAuth()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products)
      return
    }

    const filtered = products.filter(product => 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.includes(searchTerm) ||
      product.code?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [searchTerm, products])

  const loadProducts = async () => {
    try {
      const q = query(
        collection(db, 'products'),
        where('companyId', '==', userData.companyId),
        where('isActive', '==', true)
      )
      const snapshot = await getDocs(q)
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setProducts(productsList)
      setFilteredProducts(productsList)
    } catch (error) {
      toast.error('فشل في تحميل المنتجات')
    }
  }

  const handleAddToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast.error('الكمية المتاحة غير كافية')
          return prevCart
        }
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        if (product.stock < 1) {
          toast.error('المنتجات غير متوفرة في المخزون')
          return prevCart
        }
        return [
          ...prevCart,
          {
            ...product,
            quantity: 1,
            subtotal: product.salePrice
          }
        ]
      }
    })
  }

  const handleRemoveFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(productId)
      return
    }

    const product = cart.find(item => item.id === productId)
    if (newQuantity > product.stock) {
      toast.error('الكمية المتاحة غير كافية')
      return
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { 
              ...item, 
              quantity: newQuantity,
              subtotal: newQuantity * item.salePrice
            }
          : item
      )
    )
  }

  const handleCompleteSale = async (paymentData) => {
    if (cart.length === 0) {
      toast.error('السلة فارغة')
      return
    }

    try {
      const generateInvoiceNumber = httpsCallable(functions, 'generateInvoiceNumber')
      const invoiceResult = await generateInvoiceNumber({
        companyId: userData.companyId
      })

      const invoiceNumber = invoiceResult.data.invoiceNumber

      await runTransaction(db, async (transaction) => {
        // إنشاء الفاتورة
        const invoiceRef = doc(collection(db, 'sales'))
        
        const invoiceData = {
          invoiceNumber,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || 'عميل نقدي',
          customerPhone: selectedCustomer?.phone || '',
          userId: userData.uid,
          userName: userData.name,
          companyId: userData.companyId,
          items: cart.map(item => ({
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.salePrice,
            subtotal: item.subtotal,
            costPrice: item.costPrice || 0
          })),
          subtotal: cart.reduce((sum, item) => sum + item.subtotal, 0),
          discount: paymentData.discount || 0,
          tax: paymentData.tax || 0,
          total: paymentData.total,
          paymentMethod: paymentData.method,
          paymentAmount: paymentData.amount,
          change: paymentData.change || 0,
          notes: paymentData.notes || '',
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }

        transaction.set(invoiceRef, invoiceData)

        // تحديث المخزون لكل منتج
        cart.forEach(item => {
          const productRef = doc(db, 'products', item.id)
          transaction.update(productRef, {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp()
          })

          // تسجيل حركة المخزون
          const logRef = doc(collection(db, 'inventoryLogs'))
          transaction.set(logRef, {
            productId: item.id,
            productName: item.name,
            type: 'sale',
            quantity: -item.quantity,
            reference: invoiceNumber,
            userId: userData.uid,
            userName: userData.name,
            companyId: userData.companyId,
            createdAt: serverTimestamp()
          })
        })
      })

      // إعادة تعيين السلة
      setCart([])
      setSelectedCustomer(null)
      toast.success('تم إتمام البيع بنجاح')
      setShowPaymentModal(false)

    } catch (error) {
      console.error('Error completing sale:', error)
      toast.error('فشل في إتمام البيع')
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* شريط البحث */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="بحث بالاسم أو الباركود..."
              className="input-field w-full pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          
          <button
            onClick={() => setShowCustomerModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <FiUserPlus />
            {selectedCustomer ? selectedCustomer.name : 'إضافة عميل'}
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex overflow-hidden">
        {/* شبكة المنتجات */}
        <div className="flex-1 overflow-y-auto p-4">
          <ProductGrid 
            products={filteredProducts}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* السلة */}
        <div className="w-1/3 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">سلة المشتريات</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <Cart
              items={cart}
              onRemove={handleRemoveFromCart}
              onQuantityChange={handleQuantityChange}
            />
          </div>

          {/* ملخص السلة */}
          <div className="p-4 border-t border-gray-700 bg-gray-900">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>المجموع:</span>
                <span className="font-bold">{cartTotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-success">
                <span>الضريبة (14%):</span>
                <span>{(cartTotal * 0.14).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-gray-700 pt-2">
                <span>الإجمالي:</span>
                <span>{(cartTotal * 1.14).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
                className="btn-primary w-full py-3 text-lg"
              >
                إتمام البيع
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* نافذة إضافة عميل */}
      <AnimatePresence>
        {showCustomerModal && (
          <CustomerModal
            onClose={() => setShowCustomerModal(false)}
            onSelect={setSelectedCustomer}
            selectedCustomer={selectedCustomer}
          />
        )}
      </AnimatePresence>

      {/* نافذة الدفع */}
      <AnimatePresence>
        {showPaymentModal && (
          <PaymentModal
            onClose={() => setShowPaymentModal(false)}
            onComplete={handleCompleteSale}
            total={cartTotal * 1.14}
            cart={cart}
            customer={selectedCustomer}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
