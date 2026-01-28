import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Treasury from "./pages/Treasury";
import PendingOrders from "./pages/PendingOrders";
import Settings from "./pages/Settings";

function PrivateRoute({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10">تحميل...</div>;

  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

        <Route path="/pos" element={<PrivateRoute><POS /></PrivateRoute>} />

        <Route path="/products" element={<PrivateRoute><Products /></PrivateRoute>} />

        <Route path="/customers" element={<PrivateRoute><Customers /></PrivateRoute>} />

        <Route path="/treasury" element={<PrivateRoute><Treasury /></PrivateRoute>} />

        <Route path="/pending" element={<PrivateRoute><PendingOrders /></PrivateRoute>} />

        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />

      </Routes>
    </BrowserRouter>
  );
}
