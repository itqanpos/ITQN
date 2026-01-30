import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all customers
router.get('/',
  authenticate,
  authorize('customers', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['individual', 'company']),
    query('status').optional().isIn(['active', 'inactive', 'blocked']),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status,
        category,
        hasBalance,
        search
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('customers')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc');

      if (type) {
        queryRef = queryRef.where('type', '==', type);
      }

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let customers = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastOrderDate: data.lastOrderDate?.toDate()
        };
      });

      // Filter by search
      if (search) {
        const searchLower = (search as string).toLowerCase();
        customers = customers.filter((c: any) =>
          c.displayName?.toLowerCase().includes(searchLower) ||
          c.firstName?.toLowerCase().includes(searchLower) ||
          c.lastName?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.phone?.includes(search as string) ||
          c.companyName?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by balance
      if (hasBalance === 'true') {
        customers = customers.filter((c: any) => c.currentBalance > 0);
      }

      // Get total count
      const countSnapshot = await db.collection('customers')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          customers,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get customers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customers'
      });
    }
  }
);

// Get customer by ID
router.get('/:id',
  authenticate,
  authorize('customers', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const customerDoc = await db.collection('customers').doc(id).get();

      if (!customerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      const customerData = customerDoc.data();

      if (customerData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access customer from other company'
        });
      }

      // Get recent sales
      const salesSnapshot = await db.collection('sales')
        .where('customerId', '==', id)
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const recentSales = salesSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: {
          id: customerDoc.id,
          ...customerData,
          recentSales,
          createdAt: customerData?.createdAt?.toDate(),
          updatedAt: customerData?.updatedAt?.toDate(),
          lastOrderDate: customerData?.lastOrderDate?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get customer error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customer'
      });
    }
  }
);

// Create customer
router.post('/',
  authenticate,
  authorize('customers', 'create'),
  [
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('email').optional().isEmail(),
    body('type').optional().isIn(['individual', 'company'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        phone2,
        type = 'individual',
        companyName,
        taxNumber,
        commercialRegistration,
        address,
        category,
        tags,
        creditLimit = 0,
        paymentTerms,
        notes
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // Check if phone exists
      const existingPhone = await db.collection('customers')
        .where('companyId', '==', companyId)
        .where('phone', '==', phone)
        .get();

      if (!existingPhone.empty) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }

      // Generate customer code
      const counterDoc = await db.collection('counters').doc(`customers_${companyId}`).get();
      const nextNumber = (counterDoc.data()?.value || 0) + 1;
      const code = `CUST-${String(nextNumber).padStart(5, '0')}`;

      await db.collection('counters').doc(`customers_${companyId}`).set(
        { value: nextNumber },
        { merge: true }
      );

      const displayName = type === 'company' ? companyName : `${firstName} ${lastName}`;

      const customerData: any = {
        code,
        firstName,
        lastName,
        displayName,
        email: email || null,
        phone,
        phone2: phone2 || null,
        type,
        companyName: companyName || null,
        taxNumber: taxNumber || null,
        commercialRegistration: commercialRegistration || null,
        address: address || null,
        category: category || null,
        tags: tags || [],
        creditLimit: Number(creditLimit),
        currentBalance: 0,
        paymentTerms: paymentTerms || null,
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        status: 'active',
        isActive: true,
        isVip: false,
        notes: notes || null,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId,
        updatedBy: userId
      };

      const docRef = await db.collection('customers').add(customerData);

      // Create audit log
      await db.collection('auditLogs').add({
        userId,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'CREATE',
        resource: 'customers',
        resourceId: docRef.id,
        newData: customerData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: {
          id: docRef.id,
          ...customerData
        }
      });
    } catch (error: any) {
      console.error('Create customer error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create customer'
      });
    }
  }
);

// Update customer
router.put('/:id',
  authenticate,
  authorize('customers', 'update'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const customerDoc = await db.collection('customers').doc(id).get();

      if (!customerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      const customerData = customerDoc.data();

      if (customerData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update customer from other company'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId
      };

      if (updates.firstName) {
        updateData.firstName = updates.firstName;
        updateData.displayName = `${updates.firstName} ${customerData?.lastName}`;
      }

      if (updates.lastName) {
        updateData.lastName = updates.lastName;
        updateData.displayName = `${customerData?.firstName} ${updates.lastName}`;
      }

      if (updates.firstName && updates.lastName) {
        updateData.displayName = `${updates.firstName} ${updates.lastName}`;
      }

      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone) updateData.phone = updates.phone;
      if (updates.phone2 !== undefined) updateData.phone2 = updates.phone2;
      if (updates.type) updateData.type = updates.type;
      if (updates.companyName !== undefined) updateData.companyName = updates.companyName;
      if (updates.taxNumber !== undefined) updateData.taxNumber = updates.taxNumber;
      if (updates.commercialRegistration !== undefined) updateData.commercialRegistration = updates.commercialRegistration;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.shippingAddresses !== undefined) updateData.shippingAddresses = updates.shippingAddresses;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.creditLimit !== undefined) updateData.creditLimit = Number(updates.creditLimit);
      if (updates.paymentTerms !== undefined) updateData.paymentTerms = updates.paymentTerms;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.isVip !== undefined) updateData.isVip = updates.isVip;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await db.collection('customers').doc(id).update(updateData);

      // Create audit log
      await db.collection('auditLogs').add({
        userId,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'UPDATE',
        resource: 'customers',
        resourceId: id,
        oldData: customerData,
        newData: updateData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update customer error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update customer'
      });
    }
  }
);

// Delete customer
router.delete('/:id',
  authenticate,
  authorize('customers', 'delete'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const customerDoc = await db.collection('customers').doc(id).get();

      if (!customerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      const customerData = customerDoc.data();

      if (customerData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete customer from other company'
        });
      }

      // Check if customer has sales
      const salesSnapshot = await db.collection('sales')
        .where('customerId', '==', id)
        .limit(1)
        .get();

      if (!salesSnapshot.empty) {
        // Soft delete
        await db.collection('customers').doc(id).update({
          status: 'inactive',
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          message: 'Customer deactivated (has sales history)'
        });
      }

      await db.collection('customers').doc(id).delete();

      res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete customer error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete customer'
      });
    }
  }
);

// Get customer statement
router.get('/:id/statement',
  authenticate,
  authorize('customers', 'read'),
  [
    param('id').notEmpty(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const companyId = (req as any).user.companyId;

      const customerDoc = await db.collection('customers').doc(id).get();

      if (!customerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      const customerData = customerDoc.data();

      // Get sales
      let salesQuery: any = db.collection('sales')
        .where('customerId', '==', id)
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'asc');

      if (startDate) {
        salesQuery = salesQuery.where('createdAt', '>=', new Date(startDate as string));
      }

      if (endDate) {
        salesQuery = salesQuery.where('createdAt', '<=', new Date(endDate as string));
      }

      const salesSnapshot = await salesQuery.get();

      // Get payments
      let paymentsQuery: any = db.collection('payments')
        .where('customerId', '==', id)
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'asc');

      if (startDate) {
        paymentsQuery = paymentsQuery.where('createdAt', '>=', new Date(startDate as string));
      }

      if (endDate) {
        paymentsQuery = paymentsQuery.where('createdAt', '<=', new Date(endDate as string));
      }

      const paymentsSnapshot = await paymentsQuery.get();

      // Build statement
      const transactions: any[] = [];
      let balance = 0;

      salesSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          date: data.createdAt?.toDate(),
          type: 'sale',
          reference: data.invoiceNumber,
          description: `Sale - ${data.totalItems} items`,
          debit: data.total,
          credit: 0,
          balance: 0
        });
      });

      paymentsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          date: data.createdAt?.toDate(),
          type: 'payment',
          reference: data.method,
          description: `Payment - ${data.notes || ''}`,
          debit: 0,
          credit: data.amount,
          balance: 0
        });
      });

      // Sort by date and calculate balance
      transactions.sort((a, b) => a.date - b.date);
      transactions.forEach(t => {
        balance += t.debit - t.credit;
        t.balance = balance;
      });

      const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.debit, 0);
      const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.credit, 0);

      res.json({
        success: true,
        data: {
          customer: {
            id: customerDoc.id,
            name: customerData?.displayName,
            code: customerData?.code,
            currentBalance: customerData?.currentBalance
          },
          period: {
            start: startDate || 'all time',
            end: endDate || 'now'
          },
          summary: {
            totalSales,
            totalPayments,
            balance
          },
          transactions
        }
      });
    } catch (error: any) {
      console.error('Get customer statement error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customer statement'
      });
    }
  }
);

export { router as customerRoutes };
