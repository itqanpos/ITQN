import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Sales report
router.get('/sales',
  authenticate,
  authorize('reports', 'read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('groupBy').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('sales')
        .where('companyId', '==', companyId);

      if (startDate) {
        queryRef = queryRef.where('createdAt', '>=', new Date(startDate as string));
      }

      if (endDate) {
        queryRef = queryRef.where('createdAt', '<=', new Date(endDate as string));
      }

      const snapshot = await queryRef.get();

      const sales = snapshot.docs.map((doc: any) => doc.data());

      // Calculate summary
      const summary = {
        totalSales: sales.length,
        totalAmount: sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
        totalCost: sales.reduce((sum: number, s: any) => 
          sum + s.items?.reduce((itemSum: number, i: any) => itemSum + (i.costPrice * i.quantity), 0) || 0, 0),
        totalItems: sales.reduce((sum: number, s: any) => sum + (s.totalItems || 0), 0),
        totalDiscounts: sales.reduce((sum: number, s: any) => 
          sum + (s.discountAmount || 0) + (s.discountPercentage ? s.subtotal * s.discountPercentage / 100 : 0), 0),
        totalTax: sales.reduce((sum: number, s: any) => sum + (s.taxAmount || 0), 0)
      };

      summary.grossProfit = summary.totalAmount - summary.totalCost;
      summary.grossMargin = summary.totalAmount > 0 ? (summary.grossProfit / summary.totalAmount) * 100 : 0;
      summary.averageOrderValue = sales.length > 0 ? summary.totalAmount / sales.length : 0;

      // Group by date
      const grouped: any = {};
      sales.forEach((sale: any) => {
        const date = sale.createdAt.toDate();
        let key: string;

        switch (groupBy) {
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'year':
            key = `${date.getFullYear()}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }

        if (!grouped[key]) {
          grouped[key] = { date: key, sales: 0, amount: 0, items: 0 };
        }
        grouped[key].sales += 1;
        grouped[key].amount += sale.total || 0;
        grouped[key].items += sale.totalItems || 0;
      });

      // Group by product
      const productMap: any = {};
      sales.forEach((sale: any) => {
        sale.items?.forEach((item: any) => {
          if (!productMap[item.productId]) {
            productMap[item.productId] = {
              productId: item.productId,
              productName: item.productName,
              quantity: 0,
              amount: 0,
              cost: 0
            };
          }
          productMap[item.productId].quantity += item.quantity;
          productMap[item.productId].amount += item.total || 0;
          productMap[item.productId].cost += (item.costPrice || 0) * item.quantity;
        });
      });

      const byProduct = Object.values(productMap)
        .map((p: any) => ({
          ...p,
          profit: p.amount - p.cost
        }))
        .sort((a: any, b: any) => b.quantity - a.quantity);

      // Group by payment method
      const paymentMap: any = {};
      sales.forEach((sale: any) => {
        const method = sale.paymentMethod || 'other';
        if (!paymentMap[method]) {
          paymentMap[method] = { method, amount: 0, count: 0 };
        }
        paymentMap[method].amount += sale.total || 0;
        paymentMap[method].count += 1;
      });

      res.json({
        success: true,
        data: {
          summary,
          byDay: Object.values(grouped),
          byProduct: byProduct.slice(0, 20),
          byPaymentMethod: Object.values(paymentMap)
        }
      });
    } catch (error: any) {
      console.error('Get sales report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales report'
      });
    }
  }
);

// Inventory report
router.get('/inventory',
  authenticate,
  authorize('reports', 'read'),
  async (req, res) => {
    try {
      const { branchId } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('inventory')
        .where('companyId', '==', companyId);

      if (branchId) {
        queryRef = queryRef.where('branchId', '==', branchId);
      }

      const snapshot = await queryRef.get();

      const inventory = snapshot.docs.map((doc: any) => doc.data());

      const report = {
        totalItems: inventory.length,
        totalQuantity: inventory.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
        totalValue: inventory.reduce((sum: number, i: any) => sum + (i.totalValue || 0), 0),
        lowStock: inventory.filter((i: any) => i.quantity <= i.minQuantity).length,
        outOfStock: inventory.filter((i: any) => i.quantity === 0).length,
        overstock: inventory.filter((i: any) => i.maxQuantity && i.quantity > i.maxQuantity).length
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Get inventory report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get inventory report'
      });
    }
  }
);

// Customer report
router.get('/customers',
  authenticate,
  authorize('reports', 'read'),
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;

      const customersSnapshot = await db.collection('customers')
        .where('companyId', '==', companyId)
        .get();

      const customers = customersSnapshot.docs.map((doc: any) => doc.data());

      // Get top customers by total spent
      const topCustomers = customers
        .sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 10)
        .map((c: any) => ({
          customerId: c.id,
          customerName: c.displayName,
          totalOrders: c.totalOrders || 0,
          totalSpent: c.totalSpent || 0,
          averageOrderValue: c.averageOrderValue || 0
        }));

      const report = {
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c: any) => c.status === 'active').length,
        newCustomersThisMonth: customers.filter((c: any) => {
          const created = c.createdAt?.toDate();
          const now = new Date();
          return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length,
        totalReceivables: customers.reduce((sum: number, c: any) => sum + (c.currentBalance || 0), 0),
        averageCustomerValue: customers.length > 0 ? 
          customers.reduce((sum: number, c: any) => sum + (c.totalSpent || 0), 0) / customers.length : 0,
        topCustomers
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Get customer report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customer report'
      });
    }
  }
);

// Financial report
router.get('/financial',
  authenticate,
  authorize('reports', 'read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const companyId = (req as any).user.companyId;

      let salesQuery: any = db.collection('sales')
        .where('companyId', '==', companyId);

      let expensesQuery: any = db.collection('expenses')
        .where('companyId', '==', companyId);

      if (startDate) {
        salesQuery = salesQuery.where('createdAt', '>=', new Date(startDate as string));
        expensesQuery = expensesQuery.where('date', '>=', new Date(startDate as string));
      }

      if (endDate) {
        salesQuery = salesQuery.where('createdAt', '<=', new Date(endDate as string));
        expensesQuery = expensesQuery.where('date', '<=', new Date(endDate as string));
      }

      const [salesSnapshot, expensesSnapshot] = await Promise.all([
        salesQuery.get(),
        expensesQuery.get()
      ]);

      const sales = salesSnapshot.docs.map((doc: any) => doc.data());
      const expenses = expensesSnapshot.docs.map((doc: any) => doc.data());

      const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
      const totalCost = sales.reduce((sum: number, s: any) => 
        sum + s.items?.reduce((itemSum: number, i: any) => itemSum + (i.costPrice * i.quantity), 0) || 0, 0);
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      const grossProfit = totalSales - totalCost;
      const netProfit = grossProfit - totalExpenses;

      const report = {
        revenue: {
          total: totalSales,
          cost: totalCost,
          grossProfit,
          grossMargin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0
        },
        expenses: {
          total: totalExpenses,
          byCategory: expenses.reduce((acc: any, e: any) => {
            if (!acc[e.categoryName]) acc[e.categoryName] = 0;
            acc[e.categoryName] += e.amount || 0;
            return acc;
          }, {})
        },
        netProfit,
        netMargin: totalSales > 0 ? (netProfit / totalSales) * 100 : 0
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Get financial report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get financial report'
      });
    }
  }
);

// Sales rep performance report
router.get('/sales-reps',
  authenticate,
  authorize('reports', 'read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('sales')
        .where('companyId', '==', companyId);

      if (startDate) {
        queryRef = queryRef.where('createdAt', '>=', new Date(startDate as string));
      }

      if (endDate) {
        queryRef = queryRef.where('createdAt', '<=', new Date(endDate as string));
      }

      const snapshot = await queryRef.get();

      const sales = snapshot.docs.map((doc: any) => doc.data());

      // Group by sales rep
      const repMap: any = {};
      sales.forEach((sale: any) => {
        const repId = sale.salesRepId;
        if (!repMap[repId]) {
          repMap[repId] = {
            salesRepId: repId,
            salesRepName: sale.salesRepName,
            sales: 0,
            amount: 0,
            items: 0,
            customers: new Set()
          };
        }
        repMap[repId].sales += 1;
        repMap[repId].amount += sale.total || 0;
        repMap[repId].items += sale.totalItems || 0;
        if (sale.customerId) repMap[repId].customers.add(sale.customerId);
      });

      const performance = Object.values(repMap).map((r: any) => ({
        ...r,
        customers: r.customers.size,
        averageOrderValue: r.sales > 0 ? r.amount / r.sales : 0
      })).sort((a: any, b: any) => b.amount - a.amount);

      res.json({
        success: true,
        data: performance
      });
    } catch (error: any) {
      console.error('Get sales rep report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales rep report'
      });
    }
  }
);

export { router as reportRoutes };
