import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all expenses
router.get('/',
  authenticate,
  authorize('expenses', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('categoryId').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        categoryId,
        startDate,
        endDate
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('expenses')
        .where('companyId', '==', companyId)
        .orderBy('date', 'desc');

      if (categoryId) {
        queryRef = queryRef.where('categoryId', '==', categoryId);
      }

      if (startDate) {
        queryRef = queryRef.where('date', '>=', new Date(startDate as string));
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      const expenses = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Get total count
      const countSnapshot = await db.collection('expenses')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          expenses,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get expenses error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get expenses'
      });
    }
  }
);

// Get expense categories
router.get('/categories',
  authenticate,
  authorize('expenses', 'read'),
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;

      const snapshot = await db.collection('expenseCategories')
        .where('companyId', 'in', [companyId, 'global'])
        .where('isActive', '==', true)
        .orderBy('name', 'asc')
        .get();

      const categories = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      console.error('Get expense categories error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get expense categories'
      });
    }
  }
);

// Create expense category
router.post('/categories',
  authenticate,
  authorize('expenses', 'create'),
  [
    body('name').trim().notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, description, color, icon, budget } = req.body;
      const companyId = (req as any).user.companyId;

      const categoryData = {
        name,
        description: description || null,
        color: color || null,
        icon: icon || null,
        budget: budget ? Number(budget) : null,
        isActive: true,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('expenseCategories').add(categoryData);

      res.status(201).json({
        success: true,
        message: 'Expense category created successfully',
        data: {
          id: docRef.id,
          ...categoryData
        }
      });
    } catch (error: any) {
      console.error('Create expense category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create expense category'
      });
    }
  }
);

// Create expense
router.post('/',
  authenticate,
  authorize('expenses', 'create'),
  [
    body('categoryId').notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('description').trim().notEmpty(),
    body('date').isISO8601(),
    body('paymentMethod').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        categoryId,
        amount,
        description,
        date,
        paymentMethod,
        reference,
        notes,
        receiptUrl,
        isRecurring,
        recurringFrequency
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      // Get category
      const categoryDoc = await db.collection('expenseCategories').doc(categoryId).get();
      const categoryName = categoryDoc.exists ? categoryDoc.data()?.name : 'Unknown';

      // Generate expense number
      const counterDoc = await db.collection('counters').doc(`expenses_${companyId}`).get();
      const nextNumber = (counterDoc.data()?.value || 0) + 1;
      const expenseNumber = `EXP-${String(nextNumber).padStart(6, '0')}`;

      await db.collection('counters').doc(`expenses_${companyId}`).set(
        { value: nextNumber },
        { merge: true }
      );

      const expenseData = {
        expenseNumber,
        categoryId,
        categoryName,
        amount: Number(amount),
        currency: 'SAR',
        description,
        date: new Date(date),
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
        receiptUrl: receiptUrl || null,
        isRecurring: isRecurring || false,
        recurringFrequency: recurringFrequency || null,
        companyId,
        branchId: (req as any).user.branchId || 'main',
        createdBy: userId,
        createdByName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('expenses').add(expenseData);

      res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        data: {
          id: docRef.id,
          ...expenseData
        }
      });
    } catch (error: any) {
      console.error('Create expense error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create expense'
      });
    }
  }
);

// Update expense
router.put('/:id',
  authenticate,
  authorize('expenses', 'update'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const companyId = (req as any).user.companyId;

      const expenseDoc = await db.collection('expenses').doc(id).get();

      if (!expenseDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
      }

      const expenseData = expenseDoc.data();

      if (expenseData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update expense from other company'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.categoryId) updateData.categoryId = updates.categoryId;
      if (updates.amount !== undefined) updateData.amount = Number(updates.amount);
      if (updates.description) updateData.description = updates.description;
      if (updates.date) updateData.date = new Date(updates.date);
      if (updates.paymentMethod) updateData.paymentMethod = updates.paymentMethod;
      if (updates.reference !== undefined) updateData.reference = updates.reference;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.receiptUrl !== undefined) updateData.receiptUrl = updates.receiptUrl;

      await db.collection('expenses').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Expense updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update expense error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update expense'
      });
    }
  }
);

// Delete expense
router.delete('/:id',
  authenticate,
  authorize('expenses', 'delete'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const expenseDoc = await db.collection('expenses').doc(id).get();

      if (!expenseDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
      }

      const expenseData = expenseDoc.data();

      if (expenseData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete expense from other company'
        });
      }

      await db.collection('expenses').doc(id).delete();

      res.json({
        success: true,
        message: 'Expense deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete expense error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete expense'
      });
    }
  }
);

// Get expense summary
router.get('/reports/summary',
  authenticate,
  authorize('reports', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('expenses')
        .where('companyId', '==', companyId);

      if (startDate) {
        queryRef = queryRef.where('date', '>=', new Date(startDate as string));
      }

      if (endDate) {
        queryRef = queryRef.where('date', '<=', new Date(endDate as string));
      }

      const snapshot = await queryRef.get();

      const expenses = snapshot.docs.map((doc: any) => doc.data());

      const total = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      // Group by category
      const byCategory: any = {};
      expenses.forEach((e: any) => {
        if (!byCategory[e.categoryId]) {
          byCategory[e.categoryId] = {
            categoryId: e.categoryId,
            categoryName: e.categoryName,
            amount: 0
          };
        }
        byCategory[e.categoryId].amount += e.amount;
      });

      res.json({
        success: true,
        data: {
          total,
          count: expenses.length,
          average: expenses.length > 0 ? total / expenses.length : 0,
          byCategory: Object.values(byCategory)
        }
      });
    } catch (error: any) {
      console.error('Get expense summary error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get expense summary'
      });
    }
  }
);

export { router as expenseRoutes };
