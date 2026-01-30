import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate } from '../middleware/auth';

const router = Router();
const db = admin.firestore();

// Get dashboard stats
router.get('/stats',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;
      const { period = 'today' } = req.query;

      const now = new Date();
      let startDate: Date;
      let endDate = new Date();

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Get sales stats
      const salesSnapshot = await db.collection('sales')
        .where('companyId', '==', companyId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const sales = salesSnapshot.docs.map((doc: any) => doc.data());

      const salesStats = {
        count: sales.length,
        total: sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
        paid: sales.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0),
        pending: sales.reduce((sum: number, s: any) => sum + (s.remainingAmount || 0), 0),
        items: sales.reduce((sum: number, s: any) => sum + (s.totalItems || 0), 0)
      };

      // Get previous period for comparison
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = new Date(startDate.getTime());

      const prevSalesSnapshot = await db.collection('sales')
        .where('companyId', '==', companyId)
        .where('createdAt', '>=', prevStartDate)
        .where('createdAt', '<=', prevEndDate)
        .get();

      const prevSales = prevSalesSnapshot.docs.map((doc: any) => doc.data());
      const prevTotal = prevSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);

      const growth = prevTotal > 0 ? ((salesStats.total - prevTotal) / prevTotal) * 100 : 0;

      // Get inventory stats
      const inventorySnapshot = await db.collection('inventory')
        .where('companyId', '==', companyId)
        .get();

      const inventory = inventorySnapshot.docs.map((doc: any) => doc.data());

      const inventoryStats = {
        totalProducts: inventory.length,
        lowStock: inventory.filter((i: any) => i.quantity <= i.minQuantity).length,
        outOfStock: inventory.filter((i: any) => i.quantity === 0).length,
        totalValue: inventory.reduce((sum: number, i: any) => sum + (i.totalValue || 0), 0)
      };

      // Get customer stats
      const customersSnapshot = await db.collection('customers')
        .where('companyId', '==', companyId)
        .get();

      const customers = customersSnapshot.docs.map((doc: any) => doc.data());

      const newCustomersSnapshot = await db.collection('customers')
        .where('companyId', '==', companyId)
        .where('createdAt', '>=', startDate)
        .get();

      const customerStats = {
        total: customers.length,
        new: newCustomersSnapshot.size,
        active: customers.filter((c: any) => c.status === 'active').length,
        withBalance: customers.filter((c: any) => c.currentBalance > 0).length
      };

      // Get receivables
      const receivables = customers.reduce((sum: number, c: any) => sum + (c.currentBalance || 0), 0);

      res.json({
        success: true,
        data: {
          sales: {
            ...salesStats,
            growth,
            averageOrderValue: salesStats.count > 0 ? salesStats.total / salesStats.count : 0
          },
          inventory: inventoryStats,
          customers: customerStats,
          receivables: {
            total: receivables,
            overdue: 0 // TODO: Calculate overdue
          },
          period: {
            start: startDate,
            end: endDate
          }
        }
      });
    } catch (error: any) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get dashboard stats'
      });
    }
  }
);

// Get sales chart data
router.get('/charts/sales',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;
      const { days = 7 } = req.query;

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - Number(days) * 24 * 60 * 60 * 1000);

      const salesSnapshot = await db.collection('sales')
        .where('companyId', '==', companyId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'asc')
        .get();

      const sales = salesSnapshot.docs.map((doc: any) => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      // Group by date
      const grouped: any = {};

      for (let i = 0; i < Number(days); i++) {
        const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        grouped[dateStr] = { date: dateStr, sales: 0, amount: 0, count: 0 };
      }

      sales.forEach((sale: any) => {
        const dateStr = sale.createdAt.toISOString().split('T')[0];
        if (grouped[dateStr]) {
          grouped[dateStr].sales += sale.total;
          grouped[dateStr].count += 1;
        }
      });

      const chartData = Object.values(grouped).reverse();

      res.json({
        success: true,
        data: chartData
      });
    } catch (error: any) {
      console.error('Get sales chart error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales chart'
      });
    }
  }
);

// Get top products
router.get('/top-products',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;
      const { limit = 10, period = 'month' } = req.query;

      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const salesSnapshot = await db.collection('sales')
        .where('companyId', '==', companyId)
        .where('createdAt', '>=', startDate)
        .get();

      const productMap: any = {};

      salesSnapshot.docs.forEach((doc: any) => {
        const sale = doc.data();
        sale.items?.forEach((item: any) => {
          if (!productMap[item.productId]) {
            productMap[item.productId] = {
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              quantity: 0,
              total: 0
            };
          }
          productMap[item.productId].quantity += item.quantity;
          productMap[item.productId].total += item.total;
        });
      });

      const topProducts = Object.values(productMap)
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, Number(limit));

      res.json({
        success: true,
        data: topProducts
      });
    } catch (error: any) {
      console.error('Get top products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get top products'
      });
    }
  }
);

// Get recent activity
router.get('/activity',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;
      const { limit = 20 } = req.query;

      const snapshot = await db.collection('auditLogs')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .get();

      const activity = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: activity
      });
    } catch (error: any) {
      console.error('Get activity error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get activity'
      });
    }
  }
);

// Get notifications
router.get('/notifications',
  authenticate,
  async (req, res) => {
    try {
      const userId = (req as any).user.uid;
      const { unreadOnly = false, limit = 20 } = req.query;

      let queryRef: any = db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

      if (unreadOnly === 'true') {
        queryRef = queryRef.where('isRead', '==', false);
      }

      queryRef = queryRef.limit(Number(limit));

      const snapshot = await queryRef.get();

      const notifications = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      // Get unread count
      const unreadSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .count()
        .get();

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount: unreadSnapshot.data().count
        }
      });
    } catch (error: any) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get notifications'
      });
    }
  }
);

// Mark notification as read
router.patch('/notifications/:id/read',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.uid;

      const notificationDoc = await db.collection('notifications').doc(id).get();

      if (!notificationDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      const notificationData = notificationDoc.data();

      if (notificationData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access notification'
        });
      }

      await notificationDoc.ref.update({
        isRead: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error: any) {
      console.error('Mark notification read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark notification as read'
      });
    }
  }
);

export { router as dashboardRoutes };
