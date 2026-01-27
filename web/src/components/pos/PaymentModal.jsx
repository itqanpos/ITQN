import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiX, FiCreditCard, FiDollarSign, FiFileText } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

export default function PaymentModal({ onClose, onComplete, total, cart, customer }) {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amount, setAmount] = useState(total.toFixed(2))
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    const numericAmount = parseFloat(amount)
    const numericDiscount = parseFloat(discount) || 0
    
    if (numericAmount < total - numericDiscount) {
      toast.error('المبلغ المدفوع أقل من الإجمالي')
      return
    }

    const tax = (total - numericDiscount) * 0.14
    
    onComplete({
      method: paymentMethod,
      amount: numericAmount,
      discount: numericDiscount,
      tax: tax,
      total: total - numericDiscount + tax,
      change: numericAmount - (total - numericDiscount + tax),
      notes
    })
  }

  const paymentMethods = [
    { value: 'cash', label: 'نقدي', icon: FiDollarSign },
    { value: 'card', label: 'بطاقة', icon: FiCreditCard },
    { value: 'transfer', label: 'تحويل', icon: FiFileText },
    { value: 'credit', label: 'آجل', icon: FiFileText }
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-800 rounded-xl max-w-md w-full"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">إتمام عملية الدفع</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* معلومات الفاتورة */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">الإجمالي:</span>
                  <span className="font-bold">{total.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">الخصم:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={total}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-right"
                    />
                    <span>ج.م</span>
                  </div>
                </div>
                <div className="flex justify-between text-success">
                  <span>الضريبة (14%):</span>
                  <span>{(total * 0.14).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t border-gray-700 pt-2">
                  <span>المبلغ المستحق:</span>
                  <span>{(total + (total * 0.14)).toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>

            {/* طرق الدفع */}
            <div>
              <h3 className="font-bold mb-4">طريقة الدفع</h3>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon
                  return (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 ${
                        paymentMethod === method.value
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{method.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* المبلغ المدفوع */}
            {paymentMethod !== 'credit' && (
              <div>
                <label className="block text-gray-300 mb-2">المبلغ المدفوع</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    ج.م
                  </span>
                  <input
                    type="number"
                    min={total}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field w-full pl-12"
                  />
                </div>
              </div>
            )}

            {/* ملاحظات */}
            <div>
              <label className="block text-gray-300 mb-2">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field w-full h-24"
                placeholder="أي ملاحظات على الفاتورة..."
              />
            </div>

            {/* الإجمالي النهائي */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">المبلغ المستحق:</span>
                  <span className="font-bold">{(total + (total * 0.14)).toFixed(2)} ج.م</span>
                </div>
                {paymentMethod !== 'credit' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">المبلغ المدفوع:</span>
                      <span className="font-bold">{parseFloat(amount).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-success">
                      <span>الباقي:</span>
                      <span className="font-bold">
                        {(parseFloat(amount) - (total + (total * 0.14))).toFixed(2)} ج.م
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* أزرار الإجراء */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="btn-secondary flex-1 py-3"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary flex-1 py-3"
              >
                تأكيد وإتمام البيع
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
