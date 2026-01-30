import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get POS registers
router.get('/registers',
  authenticate,
  authorize('pos', 'read'),
  async (req, res) => {
    try {
      const { branchId } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('posRegisters')
        .where('companyId', '==', companyId);

      if (branchId) {
        queryRef = queryRef.where('branchId', '==', branchId);
      }

      queryRef = queryRef.where('isActive', '==', true);

      const snapshot = await queryRef.get();

      const registers = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      res.json({
        success: true,
        data: registers
      });
    } catch (error: any) {
      console.error('Get registers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get registers'
      });
    }
  }
);

// Create POS register
router.post('/registers',
  authenticate,
  authorize('pos', 'create'),
  [
    body('name').trim().notEmpty(),
    body('code').trim().notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        name,
        code,
        branchId,
        receiptPrinter,
        settings
      } = req.body;

      const companyId = (req as any).user.companyId;

      const registerData = {
        name,
        code,
        companyId,
        branchId: branchId || 'main',
        receiptPrinter: receiptPrinter || null,
        settings: {
          printReceiptAutomatically: true,
          openCashDrawerOnSale: true,
          requireCustomerForSale: false,
          allowCreditSales: false,
          allowReturns: true,
          receiptTemplate: 'default',
          barcodeScannerEnabled: true,
          scaleEnabled: false,
          ...settings
        },
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('posRegisters').add(registerData);

      res.status(201).json({
        success: true,
        message: 'Register created successfully',
        data: {
          id: docRef.id,
          ...registerData
        }
      });
    } catch (error: any) {
      console.error('Create register error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create register'
      });
    }
  }
);

// Open session
router.post('/sessions/open',
  authenticate,
  authorize('pos', 'create'),
  [
    body('registerId').notEmpty(),
    body('openingCash').isFloat({ min: 0 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { registerId, openingCash, openingNotes } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      // Check if register exists
      const registerDoc = await db.collection('posRegisters').doc(registerId).get();

      if (!registerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Register not found'
        });
      }

      const registerData = registerDoc.data();

      // Check if there's already an open session
      const existingSession = await db.collection('posSessions')
        .where('registerId', '==', registerId)
        .where('status', '==', 'open')
        .limit(1)
        .get();

      if (!existingSession.empty) {
        return res.status(400).json({
          success: false,
          message: 'There is already an open session for this register'
        });
      }

      const sessionData = {
        companyId,
        branchId: registerData?.branchId || 'main',
        cashierId: userId,
        cashierName: userName,
        registerId,
        registerName: registerData?.name,
        openedAt: admin.firestore.FieldValue.serverTimestamp(),
        openingCash: Number(openingCash),
        openingNotes: openingNotes || null,
        totalSales: 0,
        totalTransactions: 0,
        totalRefunds: 0,
        totalDiscounts: 0,
        paymentsByMethod: [],
        status: 'open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const sessionRef = await db.collection('posSessions').add(sessionData);

      // Update register with current session
      await registerDoc.ref.update({
        currentSessionId: sessionRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        message: 'Session opened successfully',
        data: {
          id: sessionRef.id,
          ...sessionData
        }
      });
    } catch (error: any) {
      console.error('Open session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to open session'
      });
    }
  }
);

// Close session
router.post('/sessions/:id/close',
  authenticate,
  authorize('pos', 'update'),
  [
    param('id').notEmpty(),
    body('closingCash').isFloat({ min: 0 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { closingCash, closingNotes } = req.body;

      const companyId = (req as any).user.companyId;

      const sessionDoc = await db.collection('posSessions').doc(id).get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const sessionData = sessionDoc.data();

      if (sessionData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access session from other company'
        });
      }

      if (sessionData?.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: 'Session is not open'
        });
      }

      const expectedCash = sessionData?.openingCash + (sessionData?.paymentsByMethod?.find((p: any) => p.method === 'cash')?.amount || 0);
      const cashDifference = Number(closingCash) - expectedCash;

      await sessionDoc.ref.update({
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        closingCash: Number(closingCash),
        expectedCash,
        cashDifference,
        closingNotes: closingNotes || null,
        status: 'closed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Clear register session
      await db.collection('posRegisters').doc(sessionData?.registerId).update({
        currentSessionId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Session closed successfully',
        data: {
          id,
          closingCash: Number(closingCash),
          expectedCash,
          cashDifference
        }
      });
    } catch (error: any) {
      console.error('Close session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to close session'
      });
    }
  }
);

// Get current session
router.get('/sessions/current',
  authenticate,
  authorize('pos', 'read'),
  async (req, res) => {
    try {
      const { registerId } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('posSessions')
        .where('companyId', '==', companyId)
        .where('status', '==', 'open');

      if (registerId) {
        queryRef = queryRef.where('registerId', '==', registerId);
      }

      queryRef = queryRef.orderBy('openedAt', 'desc').limit(1);

      const snapshot = await queryRef.get();

      if (snapshot.empty) {
        return res.json({
          success: true,
          data: null
        });
      }

      const sessionData = snapshot.docs[0].data();

      res.json({
        success: true,
        data: {
          id: snapshot.docs[0].id,
          ...sessionData,
          openedAt: sessionData.openedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get current session error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get current session'
      });
    }
  }
);

// Get session report
router.get('/sessions/:id/report',
  authenticate,
  authorize('pos', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const sessionDoc = await db.collection('posSessions').doc(id).get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const sessionData = sessionDoc.data();

      if (sessionData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access session from other company'
        });
      }

      // Get sales for this session
      const salesSnapshot = await db.collection('sales')
        .where('posSessionId', '==', id)
        .where('companyId', '==', companyId)
        .get();

      const sales = salesSnapshot.docs.map((doc: any) => doc.data());

      const report = {
        sessionId: id,
        cashierName: sessionData?.cashierName,
        registerName: sessionData?.registerName,
        openedAt: sessionData?.openedAt?.toDate(),
        closedAt: sessionData?.closedAt?.toDate(),
        duration: sessionData?.closedAt ? 
          (sessionData.closedAt.toMillis() - sessionData.openedAt.toMillis()) / 1000 / 60 : null,
        
        cash: {
          opening: sessionData?.openingCash,
          closing: sessionData?.closingCash,
          expected: sessionData?.expectedCash,
          difference: sessionData?.cashDifference
        },
        
        sales: {
          totalSales: sales.length,
          totalAmount: sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
          totalItems: sales.reduce((sum: number, s: any) => sum + (s.totalItems || 0), 0),
          totalDiscounts: sales.reduce((sum: number, s: any) => sum + ((s.discountAmount || 0) + (s.discountPercentage ? s.subtotal * s.discountPercentage / 100 : 0)), 0),
          totalTax: sales.reduce((sum: number, s: any) => sum + (s.taxAmount || 0), 0),
          averageOrderValue: sales.length > 0 ? sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0) / sales.length : 0
        },
        
        refunds: {
          count: sales.filter((s: any) => s.isRefunded).length,
          amount: sales.filter((s: any) => s.isRefunded).reduce((sum: number, s: any) => sum + (s.refundAmount || 0), 0)
        },
        
        paymentsByMethod: sessionData?.paymentsByMethod || []
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Get session report error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get session report'
      });
    }
  }
);

// Get quick products
router.get('/quick-products',
  authenticate,
  authorize('pos', 'read'),
  async (req, res) => {
    try {
      const { categoryId } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('quickProducts')
        .where('companyId', '==', companyId);

      if (categoryId) {
        queryRef = queryRef.where('categoryId', '==', categoryId);
      }

      queryRef = queryRef.orderBy('sortOrder', 'asc');

      const snapshot = await queryRef.get();

      const quickProducts = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        success: true,
        data: quickProducts
      });
    } catch (error: any) {
      console.error('Get quick products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get quick products'
      });
    }
  }
);

// Add quick product
router.post('/quick-products',
  authenticate,
  authorize('pos', 'create'),
  [
    body('productId').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { productId, sortOrder = 0 } = req.body;
      const companyId = (req as any).user.companyId;

      // Get product details
      const productDoc = await db.collection('products').doc(productId).get();

      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const productData = productDoc.data();

      const quickProductData = {
        productId,
        productName: productData?.name,
        productSku: productData?.sku,
        sellingPrice: productData?.sellingPrice,
        image: productData?.thumbnail || (productData?.images?.length > 0 ? productData.images[0] : null),
        categoryId: productData?.categoryId,
        sortOrder: Number(sortOrder),
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('quickProducts').add(quickProductData);

      res.status(201).json({
        success: true,
        message: 'Quick product added successfully',
        data: {
          id: docRef.id,
          ...quickProductData
        }
      });
    } catch (error: any) {
      console.error('Add quick product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add quick product'
      });
    }
  }
);

export { router as posRoutes };
