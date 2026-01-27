import React from 'react'
import { motion } from 'framer-motion'
import { FiShoppingCart } from 'react-icons/fi'

export default function ProductGrid({ products, onAddToCart }) {
  if (products.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>لا توجد منتجات</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="card p-4 hover:shadow-xl transition-shadow"
        >
          <div className="aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="text-gray-400">
                <FiShoppingCart className="w-12 h-12" />
              </div>
            )}
          </div>
          
          <h3 className="font-medium text-white truncate">{product.name}</h3>
          <p className="text-sm text-gray-400 truncate">{product.code || 'بدون كود'}</p>
          
          <div className="mt-4 flex items-center justify-between">
            <span className="text-success font-bold">{product.salePrice.toFixed(2)} ج.م</span>
            <span className={`text-sm px-2 py-1 rounded ${
              product.stock > 10 ? 'bg-green-500/20 text-green-400' :
              product.stock > 0 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {product.stock} متوفر
            </span>
          </div>
          
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            <FiShoppingCart />
            إضافة للسلة
          </button>
        </motion.div>
      ))}
    </div>
  )
}
