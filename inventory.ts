import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all inventory
router.get('/',
  authenticate,
  authorize('inventory', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('productId').optional().isString(),
    query('branchId').optional().isString(),
    query('lowStock').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        productId,
        branchId,
        lowStock,
        search
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('inventory')
        .where('companyId', '==', companyId);

      if (productId) {
        queryRef = queryRef.where('productId', '==', productId);
      }

      if (branchId) {
        queryRef = queryRef.where('branchId', '==', branchId);
      }

      queryRef = queryRef.orderBy('updatedAt', 'desc');

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let inventory = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Filter low stock
      if (lowStock === 'true') {
        inventory = inventory.filter((item: any) => item.quantity <= item.minQuantity);
      }

      // Filter by search
      if (search) {
        const searchLower = (search as string).toLowerCase();
        inventory = inventory.filter((item: any) =>
          item.productName?.toLowerCase().includes(searchLower) ||
          item.productSku?.toLowerCase().includes(searchLower)
        );
      }

      // Get total count
      const countSnapshot = await db.collection('inventory')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          inventory,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get inventory error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get inventory'
      });
    }
  }
);

// Get inventory by ID
router.get('/:id',
  authenticate,
  authorize('inventory', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const inventoryDoc = await db.collection('inventory').doc(id).get();

      if (!inventoryDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Inventory record not found'
        });
      }

      const inventoryData = inventoryDoc.data();

      if (inventoryData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access inventory from other company'
        });
      }

      // Get recent transactions
      const transactionsSnapshot = await db.collection('inventoryTransactions')
        .where('productId', '==', inventoryData?.productId)
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const transactions = transactionsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: {
          id: inventoryDoc.id,
          ...inventoryData,
          transactions,
          createdAt: inventoryData?.createdAt?.toDate(),
          updatedAt: inventoryData?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get inventory error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get inventory'
      });
    }
  }
);

// Adjust stock
router.post('/adjust',
  authenticate,
  authorize('inventory', 'update'),
  [
    body('productId').notEmpty(),
    body('branchId').notEmpty(),
    body('quantity').isInt(),
    body('reason').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        productId,
        branchId,
        quantity,
        reason,
        notes,
        reference
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      // Get product
      const productDoc = await db.collection('products').doc(productId).get();

      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const productData = productDoc.data();

      // Get or create inventory record
      const inventorySnapshot = await db.collection('inventory')
        .where('productId', '==', productId)
        .where('companyId', '==', companyId)
        .where('branchId', '==', branchId)
        .limit(1)
        .get();

      let inventoryRef;
      let currentQuantity = 0;

      if (inventorySnapshot.empty) {
        // Create new inventory record
        inventoryRef = db.collection('inventory').doc();
        await inventoryRef.set({
          productId,
          productName: productData?.name,
          productSku: productData?.sku,
          companyId,
          branchId,
          quantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          minQuantity: productData?.minQuantity || 0,
          averageCost: productData?.costPrice || 0,
          totalValue: 0,
          status: 'out_of_stock',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        inventoryRef = inventorySnapshot.docs[0].ref;
        currentQuantity = inventorySnapshot.docs[0].data().quantity;
      }

      const newQuantity = currentQuantity + quantity;

      // Update inventory
      await inventoryRef.update({
        quantity: newQuantity,
        availableQuantity: newQuantity,
        totalValue: newQuantity * (productData?.costPrice || 0),
        status: newQuantity <= (productData?.minQuantity || 0) ? 'low_stock' : 'in_stock',
        lastMovementAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update product quantity
      await productDoc.ref.update({
        quantity: newQuantity,
        status: newQuantity <= (productData?.minQuantity || 0) ? 'out_of_stock' : 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create transaction
      const transactionRef = await db.collection('inventoryTransactions').add({
        productId,
        productName: productData?.name,
        productSku: productData?.sku,
        companyId,
        branchId,
        type: quantity > 0 ? 'in' : 'out',
        quantity: Math.abs(quantity),
        previousQuantity: currentQuantity,
        newQuantity,
        referenceType: 'adjustment',
        referenceId: reference || null,
        notes: `${reason}${notes ? ` - ${notes}` : ''}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId,
        createdByName: userName
      });

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          previousQuantity: currentQuantity,
          newQuantity,
          adjustment: quantity,
          transactionId: transactionRef.id
        }
      });
    } catch (error: any) {
      console.error('Adjust stock error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to adjust stock'
      });
    }
  }
);

// Get inventory transactions
router.get('/transactions',
  authenticate,
  authorize('inventory', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('productId').optional().isString(),
    query('type').optional().isIn(['in', 'out', 'adjustment', 'transfer_in', 'transfer_out']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        productId,
        type,
        startDate,
        endDate
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('inventoryTransactions')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc');

      if (productId) {
        queryRef = queryRef.where('productId', '==', productId);
      }

      if (type) {
        queryRef = queryRef.where('type', '==', type);
      }

      if (startDate) {
        queryRef = queryRef.where('createdAt', '>=', new Date(startDate as string));
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      const transactions = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: transactions.length
          }
        }
      });
    } catch (error: any) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get transactions'
      });
    }
  }
);

// Get inventory valuation
router.get('/reports/valuation',
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

      const totalValue = inventory.reduce((sum: number, item: any) => sum + (item.totalValue || 0), 0);
      const totalQuantity = inventory.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

      res.json({
        success: true,
        data: {
          totalValue,
          totalQuantity,
          averageCost,
          itemCount: inventory.length
        }
      });
    } catch (error: any) {
      console.error('Get valuation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get valuation'
      });
    }
  }
);

export { router as inventoryRoutes };
