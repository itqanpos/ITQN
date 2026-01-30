import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all sales visits
router.get('/',
  authenticate,
  authorize('salesVisits', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']),
    query('salesRepId').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        salesRepId,
        customerId,
        startDate,
        endDate
      } = req.query;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userRole = (req as any).user.role;

      let queryRef: any = db.collection('salesVisits')
        .where('companyId', '==', companyId)
        .orderBy('visitDate', 'desc');

      // Sales reps can only see their own visits
      if (userRole === 'sales_rep') {
        queryRef = queryRef.where('salesRepId', '==', userId);
      } else if (salesRepId) {
        queryRef = queryRef.where('salesRepId', '==', salesRepId);
      }

      if (customerId) {
        queryRef = queryRef.where('customerId', '==', customerId);
      }

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let visits = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        visitDate: doc.data().visitDate?.toDate(),
        checkInAt: doc.data().checkInAt?.toDate(),
        checkOutAt: doc.data().checkOutAt?.toDate(),
        reminderDate: doc.data().reminderDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Filter by date range
      if (startDate) {
        const start = new Date(startDate as string);
        visits = visits.filter((v: any) => v.visitDate >= start);
      }

      if (endDate) {
        const end = new Date(endDate as string);
        visits = visits.filter((v: any) => v.visitDate <= end);
      }

      res.json({
        success: true,
        data: {
          visits,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: visits.length
          }
        }
      });
    } catch (error: any) {
      console.error('Get sales visits error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales visits'
      });
    }
  }
);

// Get sales visit by ID
router.get('/:id',
  authenticate,
  authorize('salesVisits', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userRole = (req as any).user.role;

      const visitDoc = await db.collection('salesVisits').doc(id).get();

      if (!visitDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sales visit not found'
        });
      }

      const visitData = visitDoc.data();

      if (visitData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access visit from other company'
        });
      }

      // Sales reps can only see their own visits
      if (userRole === 'sales_rep' && visitData?.salesRepId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access other sales rep visits'
        });
      }

      res.json({
        success: true,
        data: {
          id: visitDoc.id,
          ...visitData,
          visitDate: visitData?.visitDate?.toDate(),
          checkInAt: visitData?.checkInAt?.toDate(),
          checkOutAt: visitData?.checkOutAt?.toDate(),
          reminderDate: visitData?.reminderDate?.toDate(),
          createdAt: visitData?.createdAt?.toDate(),
          updatedAt: visitData?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get sales visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales visit'
      });
    }
  }
);

// Create sales visit
router.post('/',
  authenticate,
  authorize('salesVisits', 'create'),
  [
    body('visitDate').isISO8601(),
    body('visitType').isIn(['scheduled', 'unscheduled', 'follow_up', 'demo', 'delivery', 'collection']),
    body('purpose').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        customerId,
        customerName,
        customerPhone,
        visitDate,
        visitType,
        purpose,
        notes,
        location,
        reminderDate
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      const visitData: any = {
        companyId,
        salesRepId: userId,
        salesRepName: userName,
        customerId: customerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        visitDate: new Date(visitDate),
        visitType,
        purpose: purpose || null,
        notes: notes || null,
        location: location || null,
        status: 'scheduled',
        orderCreated: false,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('salesVisits').add(visitData);

      res.status(201).json({
        success: true,
        message: 'Sales visit scheduled successfully',
        data: {
          id: docRef.id,
          ...visitData
        }
      });
    } catch (error: any) {
      console.error('Create sales visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sales visit'
      });
    }
  }
);

// Update sales visit
router.put('/:id',
  authenticate,
  authorize('salesVisits', 'update'),
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
      const userRole = (req as any).user.role;

      const visitDoc = await db.collection('salesVisits').doc(id).get();

      if (!visitDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sales visit not found'
        });
      }

      const visitData = visitDoc.data();

      if (visitData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update visit from other company'
        });
      }

      // Sales reps can only update their own visits
      if (userRole === 'sales_rep' && visitData?.salesRepId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update other sales rep visits'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.visitDate) updateData.visitDate = new Date(updates.visitDate);
      if (updates.visitType) updateData.visitType = updates.visitType;
      if (updates.status) updateData.status = updates.status;
      if (updates.purpose !== undefined) updateData.purpose = updates.purpose;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.outcome !== undefined) updateData.outcome = updates.outcome;
      if (updates.orderCreated !== undefined) updateData.orderCreated = updates.orderCreated;
      if (updates.orderId !== undefined) updateData.orderId = updates.orderId;
      if (updates.orderAmount !== undefined) updateData.orderAmount = updates.orderAmount;
      if (updates.reminderDate !== undefined) updateData.reminderDate = updates.reminderDate ? new Date(updates.reminderDate) : null;

      await db.collection('salesVisits').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Sales visit updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update sales visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update sales visit'
      });
    }
  }
);

// Check in
router.post('/:id/check-in',
  authenticate,
  authorize('salesVisits', 'update'),
  [
    param('id').notEmpty(),
    body('location.lat').isFloat(),
    body('location.lng').isFloat()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { location, notes } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const visitDoc = await db.collection('salesVisits').doc(id).get();

      if (!visitDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sales visit not found'
        });
      }

      const visitData = visitDoc.data();

      if (visitData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access visit from other company'
        });
      }

      if (visitData?.salesRepId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot check in for other sales rep'
        });
      }

      await visitDoc.ref.update({
        status: 'in_progress',
        checkInAt: admin.firestore.FieldValue.serverTimestamp(),
        checkInLocation: location,
        notes: notes || visitData?.notes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Checked in successfully',
        data: {
          id,
          checkInAt: new Date(),
          location
        }
      });
    } catch (error: any) {
      console.error('Check in error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check in'
      });
    }
  }
);

// Check out
router.post('/:id/check-out',
  authenticate,
  authorize('salesVisits', 'update'),
  [
    param('id').notEmpty(),
    body('location.lat').isFloat(),
    body('location.lng').isFloat()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { location, outcome, notes, orderId, orderAmount } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const visitDoc = await db.collection('salesVisits').doc(id).get();

      if (!visitDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sales visit not found'
        });
      }

      const visitData = visitDoc.data();

      if (visitData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access visit from other company'
        });
      }

      if (visitData?.salesRepId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot check out for other sales rep'
        });
      }

      const checkInAt = visitData?.checkInAt?.toDate();
      const checkOutAt = new Date();
      const duration = checkInAt ? Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 1000 / 60) : null;

      await visitDoc.ref.update({
        status: 'completed',
        checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
        checkOutLocation: location,
        duration,
        outcome: outcome || null,
        notes: notes || visitData?.notes,
        orderCreated: !!orderId,
        orderId: orderId || null,
        orderAmount: orderAmount || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Checked out successfully',
        data: {
          id,
          checkOutAt,
          duration,
          location
        }
      });
    } catch (error: any) {
      console.error('Check out error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check out'
      });
    }
  }
);

// Delete sales visit
router.delete('/:id',
  authenticate,
  authorize('salesVisits', 'delete'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const visitDoc = await db.collection('salesVisits').doc(id).get();

      if (!visitDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sales visit not found'
        });
      }

      const visitData = visitDoc.data();

      if (visitData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete visit from other company'
        });
      }

      await db.collection('salesVisits').doc(id).delete();

      res.json({
        success: true,
        message: 'Sales visit deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete sales visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete sales visit'
      });
    }
  }
);

// Get sales routes
router.get('/routes/list',
  authenticate,
  authorize('salesVisits', 'read'),
  async (req, res) => {
    try {
      const { salesRepId } = req.query;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userRole = (req as any).user.role;

      let queryRef: any = db.collection('salesRoutes')
        .where('companyId', '==', companyId);

      if (userRole === 'sales_rep') {
        queryRef = queryRef.where('salesRepId', '==', userId);
      } else if (salesRepId) {
        queryRef = queryRef.where('salesRepId', '==', salesRepId);
      }

      queryRef = queryRef.where('isActive', '==', true);

      const snapshot = await queryRef.get();

      const routes = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      res.json({
        success: true,
        data: routes
      });
    } catch (error: any) {
      console.error('Get sales routes error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales routes'
      });
    }
  }
);

// Create sales route
router.post('/routes',
  authenticate,
  authorize('salesVisits', 'create'),
  [
    body('name').trim().notEmpty(),
    body('dayOfWeek').isInt({ min: 0, max: 6 }),
    body('customers').isArray({ min: 1 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        name,
        description,
        dayOfWeek,
        startTime,
        endTime,
        customers,
        salesRepId
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // Get sales rep name
      let salesRepName = '';
      if (salesRepId) {
        const userDoc = await db.collection('users').doc(salesRepId).get();
        if (userDoc.exists) {
          salesRepName = userDoc.data()?.displayName || '';
        }
      }

      const routeData = {
        name,
        description: description || null,
        companyId,
        salesRepId: salesRepId || userId,
        salesRepName,
        dayOfWeek: Number(dayOfWeek),
        startTime: startTime || null,
        endTime: endTime || null,
        customers: customers.map((c: any, index: number) => ({
          customerId: c.customerId,
          customerName: c.customerName,
          address: c.address || null,
          location: c.location || null,
          sortOrder: index,
          estimatedDuration: c.estimatedDuration || 30
        })),
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('salesRoutes').add(routeData);

      res.status(201).json({
        success: true,
        message: 'Sales route created successfully',
        data: {
          id: docRef.id,
          ...routeData
        }
      });
    } catch (error: any) {
      console.error('Create sales route error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sales route'
      });
    }
  }
);

// Get performance report
router.get('/reports/performance',
  authenticate,
  authorize('reports', 'read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('salesRepId').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { startDate, endDate, salesRepId } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('salesVisits')
        .where('companyId', '==', companyId);

      if (salesRepId) {
        queryRef = queryRef.where('salesRepId', '==', salesRepId);
      }

      if (startDate) {
        queryRef = queryRef.where('visitDate', '>=', new Date(startDate as string));
      }

      if (endDate) {
        queryRef = queryRef.where('visitDate', '<=', new Date(endDate as string));
      }

      const snapshot = await queryRef.get();

      const visits = snapshot.docs.map((doc: any) => doc.data());

      const performance = {
        totalVisits: visits.length,
        completed: visits.filter((v: any) => v.status === 'completed').length,
        cancelled: visits.filter((v: any) => v.status === 'cancelled').length,
        averageDuration: visits.filter((v: any) => v.duration).reduce((sum: number, v: any) => sum + v.duration, 0) / visits.filter((v: any) => v.duration).length || 0,
        ordersCreated: visits.filter((v: any) => v.orderCreated).length,
        totalOrderAmount: visits.filter((v: any) => v.orderCreated).reduce((sum: number, v: any) => sum + (v.orderAmount || 0), 0),
        conversionRate: visits.length > 0 ? (visits.filter((v: any) => v.orderCreated).length / visits.length) * 100 : 0
      };

      res.json({
        success: true,
        data: performance
      });
    } catch (error: any) {
      console.error('Get performance report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get performance report'
      });
    }
  }
);

export { router as salesVisitRoutes };
