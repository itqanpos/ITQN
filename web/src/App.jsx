import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Layout from './components/layout/Layout'

// صفحات المصادقة
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// صفحات النظام
import Dashboard from './pages/Dashboard'
import POS from './pages/pos/POS'
import Products from './pages/products/Products'
import Inventory from './pages/inventory/Inventory'
import Sales from './pages/sales/Sales'
import Customers from './pages/customers/Customers'
import PendingOrdersPage from './pages/admin/PendingOrdersPage'
import Treasury from './pages/treasury/Treasury'
import Reports from './pages/reports/Reports'
import Settings from './pages/settings/Settings'

function App() {
  return (
    <Router>
      <AuthProvider>
        <CompanyProvider>
          <div className="min-h-screen bg-gray-900 text-white" dir="rtl">
            <Toaster position="top-left" />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/" element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }>
                <Route index element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="pos" element={<POS />} />
                <Route path="products" element={<Products />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="sales" element={<Sales />} />
                <Route path="customers" element={<Customers />} />
                <Route path="pending-orders" element={<PendingOrdersPage />} />
                <Route path="treasury" element={<Treasury />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </div>
        </CompanyProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
