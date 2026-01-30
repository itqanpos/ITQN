import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all purchase orders
router.get('/',
  authenticate,
  authorize('products', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('supplierId').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        supplierId
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('purchaseOrders')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc');

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      if (supplierId) {
        queryRef = queryRef.where('supplierId', '==', supplierId);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      const orders = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        orderDate: doc.data().orderDate?.toDate(),
        expectedDate: doc.data().expectedDate?.toDate(),
        receivedDate: doc.data().receivedDate?.toDate()
      }));

      // Get total count
      const countSnapshot = await db.collection('purchaseOrders')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get purchase orders error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get purchase orders'
      });
    }
  }
);

// Get purchase order by ID
router.get('/:id',
  authenticate,
  authorize('products', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const orderDoc = await db.collection('purchaseOrders').doc(id).get();

      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        });
      }

      const orderData = orderDoc.data();

      if (orderData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access purchase order from other company'
        });
      }

      res.json({
        success: true,
        data: {
          id: orderDoc.id,
          ...orderData,
          createdAt: orderData?.createdAt?.toDate(),
          updatedAt: orderData?.updatedAt?.toDate(),
          orderDate: orderData?.orderDate?.toDate(),
          expectedDate: orderData?.expectedDate?.toDate(),
          receivedDate: orderData?.receivedDate?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get purchase order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get purchase order'
      });
    }
  }
);

// Create purchase order
router.post('/',
  authenticate,
  authorize('products', 'create'),
  [
    body('supplierId').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.productName').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        supplierId,
        items,
        discountAmount = 0,
        taxAmount = 0,
        shippingCost = 0,
        expectedDate,
        notes
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      // Get supplier
      const supplierDoc = await db.collection('suppliers').doc(supplierId).get();

      if (!supplierDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      const supplierData = supplierDoc.data();

      // Generate order number
      const counterDoc = await db.collection('counters').doc(`purchase_orders_${companyId}`).get();
      const nextNumber = (counterDoc.data()?.value || 0) + 1;
      const orderNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

      await db.collection('counters').doc(`purchase_orders_${companyId}`).set(
        { value: nextNumber },
        { merge: true }
      );

      // Calculate totals
      let subtotal = 0;
      const orderItems = items.map((item: any) => {
        const total = item.quantity * item.unitPrice;
        subtotal += total;

        return {
          id: db.collection('_').doc().id,
          productId: item.productId || null,
          productName: item.productName,
          description: item.description || null,
          quantity: item.quantity,
          receivedQuantity: 0,
          unitPrice: item.unitPrice,
          total,
          notes: item.notes || null
        };
      });

      const total = subtotal - discountAmount + taxAmount + shippingCost;

      const orderData: any = {
        orderNumber,
        companyId,
        branchId: (req as any).user.branchId || 'main',
        supplierId,
        supplierName: supplierData?.name,
        items: orderItems,
        subtotal,
        discountAmount,
        taxAmount,
        shippingCost,
        total,
        status: 'draft',
        orderDate: admin.firestore.FieldValue.serverTimestamp(),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes || null,
        createdBy: userId,
        createdByName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('purchaseOrders').add(orderData);

      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully',
        data: {
          id: docRef.id,
          ...orderData
        }
      });
    } catch (error: any) {
      console.error('Create purchase order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create purchase order'
      });
    }
  }
);

// Update purchase order status
router.patch('/:id/status',
  authenticate,
  authorize('products', 'update'),
  [
    param('id').notEmpty(),
    body('status').isIn(['draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const companyId = (req as any).user.companyId;

      const orderDoc = await db.collection('purchaseOrders').doc(id).get();

      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        });
      }

      const orderData = orderDoc.data();

      if (orderData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access purchase order from other company'
        });
      }

      await orderDoc.ref.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Purchase order status updated',
        data: { id, status }
      });
    } catch (error: any) {
      console.error('Update status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update status'
      });
    }
  }
);

// Receive purchase order
router.post('/:id/receive',
  authenticate,
  authorize('products', 'update'),
  [
    param('id').notEmpty(),
    body('items').isArray({ min: 1 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      const orderDoc = await db.collection('purchaseOrders').doc(id).get();

      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        });
      }

      const orderData = orderDoc.data();

      if (orderData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access purchase order from other company'
        });
      }

      // Update items
      const updatedItems = orderData?.items.map((item: any) => {
        const receivedItem = items.find((i: any) => i.itemId === item.id);
        if (receivedItem) {
          return {
            ...item,
            receivedQuantity: (item.receivedQuantity || 0) + receivedItem.quantity
          };
        }
        return item;
      });

      // Check if fully received
      const allReceived = updatedItems.every((item: any) => 
        item.receivedQuantity >= item.quantity
      );

      const partialReceived = updatedItems.some((item: any) => 
        item.receivedQuantity > 0 && item.receivedQuantity < item.quantity
      );

      let status = orderData?.status;
      if (allReceived) {
        status = 'received';
      } else if (partialReceived) {
        status = 'partial';
      }

      await orderDoc.ref.update({
        items: updatedItems,
        status,
        receivedDate: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update inventory for received items
      for (const item of items) {
        const orderItem = orderData?.items.find((i: any) => i.id === item.itemId);
        if (orderItem && orderItem.productId) {
          const inventorySnapshot = await db.collection('inventory')
            .where('productId', '==', orderItem.productId)
            .where('companyId', '==', companyId)
            .limit(1)
            .get();

          if (!inventorySnapshot.empty) {
            const inventoryDoc = inventorySnapshot.docs[0];
            const currentQty = inventoryDoc.data().quantity;
            const newQty = currentQty + item.quantity;

            await inventoryDoc.ref.update({
              quantity: newQty,
              availableQuantity: newQty - inventoryDoc.data().reservedQuantity,
              status: newQty <= inventoryDoc.data().minQuantity ? 'low_stock' : 'in_stock',
              lastMovementAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Create inventory transaction
            await db.collection('inventoryTransactions').add({
              productId: orderItem.productId,
              productName: orderItem.productName,
              productSku: orderItem.productSku,
              companyId,
              branchId: orderData?.branchId || 'main',
              type: 'in',
              quantity: item.quantity,
              previousQuantity: currentQty,
              newQuantity: newQty,
              referenceType: 'purchase',
              referenceId: orderData?.orderNumber,
              unitCost: orderItem.unitPrice,
              totalCost: orderItem.unitPrice * item.quantity,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: userId,
              createdByName: userName
            });
          }

          // Update product quantity
          await db.collection('products').doc(orderItem.productId).update({
            quantity: admin.firestore.FieldValue.increment(item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      res.json({
        success: true,
        message: 'Purchase order received successfully',
        data: { id, status }
      });
    } catch (error: any) {
      console.error('Receive order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to receive order'
      });
    }
  }
);

export { router as purchaseOrderRoutes };
