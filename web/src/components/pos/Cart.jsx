import React from 'react'
import { motion } from 'framer-motion'
import { FiTrash2, FiPlus, FiMinus } from 'react-icons/fi'

export default function Cart({ items, onRemove, onQuantityChange }) {
  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>السلة فارغة</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ delay: index * 0.05 }}
          className="card p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-white">{item.name}</h3>
              <p className="text-sm text-gray-400">
                {item.code || 'بدون كود'}
              </p>
              <div className="mt-2 flex items-center gap-4">
                <span className="text-success font-medium">
                  {item.salePrice.toFixed(2)} ج.م
                </span>
                <span className="text-sm text-gray-400">
                  المخزون: {item.stock}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg">
                <button
                  onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                  className="p-2 hover:bg-gray-600 rounded-r-lg"
                >
                  <FiMinus className="w-4 h-4" />
                </button>
                
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => onQuantityChange(item.id, parseInt(e.target.value) || 1)}
                  className="w-16 bg-transparent text-center border-none focus:outline-none"
                />
                
                <button
                  onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock}
                  className="p-2 hover:bg-gray-600 rounded-l-lg disabled:opacity-50"
                >
                  <FiPlus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => onRemove(item.id)}
                className="p-2 text-danger hover:bg-danger/10 rounded-lg"
              >
                <FiTrash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
            <span className="text-gray-400">المجموع:</span>
            <span className="font-bold text-lg">
              {item.subtotal.toFixed(2)} ج.م
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
