import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all sales
router.get('/',
  authenticate,
  authorize('sales', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('customerId').optional().isString(),
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
        customerId,
        salesRepId,
        paymentStatus,
        startDate,
        endDate,
        isPosSale,
        search
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('sales')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc');

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      if (customerId) {
        queryRef = queryRef.where('customerId', '==', customerId);
      }

      if (salesRepId) {
        queryRef = queryRef.where('salesRepId', '==', salesRepId);
      }

      if (paymentStatus) {
        queryRef = queryRef.where('paymentStatus', '==', paymentStatus);
      }

      if (isPosSale !== undefined) {
        queryRef = queryRef.where('isPosSale', '==', isPosSale === 'true');
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let sales = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          completedAt: data.completedAt?.toDate()
        };
      });

      // Filter by date range (client-side for now)
      if (startDate) {
        const start = new Date(startDate as string);
        sales = sales.filter((s: any) => s.createdAt >= start);
      }

      if (endDate) {
        const end = new Date(endDate as string);
        sales = sales.filter((s: any) => s.createdAt <= end);
      }

      // Filter by search
      if (search) {
        const searchLower = (search as string).toLowerCase();
        sales = sales.filter((s: any) =>
          s.invoiceNumber?.toLowerCase().includes(searchLower) ||
          s.customerName?.toLowerCase().includes(searchLower)
        );
      }

      // Get total count
      const countSnapshot = await db.collection('sales')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          sales,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get sales error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales'
      });
    }
  }
);

// Get sale by ID
router.get('/:id',
  authenticate,
  authorize('sales', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const saleDoc = await db.collection('sales').doc(id).get();

      if (!saleDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const saleData = saleDoc.data();

      if (saleData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access sale from other company'
        });
      }

      // Get customer details
      let customer = null;
      if (saleData?.customerId) {
        const customerDoc = await db.collection('customers').doc(saleData.customerId).get();
        if (customerDoc.exists) {
          customer = {
            id: customerDoc.id,
            ...customerDoc.data()
          };
        }
      }

      // Get payments
      const paymentsSnapshot = await db.collection('payments')
        .where('saleId', '==', id)
        .orderBy('createdAt', 'desc')
        .get();

      const payments = paymentsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: {
          id: saleDoc.id,
          ...saleData,
          customer,
          payments,
          createdAt: saleData?.createdAt?.toDate(),
          updatedAt: saleData?.updatedAt?.toDate(),
          completedAt: saleData?.completedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get sale error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sale'
      });
    }
  }
);

// Create sale
router.post('/',
  authenticate,
  authorize('sales', 'create'),
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'installment', 'credit', 'other'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        items,
        discountAmount = 0,
        discountPercentage = 0,
        taxRate = 0,
        shippingCost = 0,
        paymentMethod,
        paidAmount = 0,
        notes,
        internalNotes,
        deliveryAddress,
        isPosSale = false,
        posSessionId,
        source = 'manual'
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      // Get company settings for invoice number
      const companyDoc = await db.collection('companies').doc(companyId).get();
      const companyData = companyDoc.data();
      const invoicePrefix = companyData?.settings?.invoicePrefix || 'INV';

      // Generate invoice number
      const invoiceCounter = await db.collection('counters').doc(`invoices_${companyId}`).get();
      const nextNumber = (invoiceCounter.data()?.value || 0) + 1;
      const invoiceNumber = `${invoicePrefix}-${String(nextNumber).padStart(6, '0')}`;

      // Update counter
      await db.collection('counters').doc(`invoices_${companyId}`).set(
        { value: nextNumber },
        { merge: true }
      );

      // Process items and calculate totals
      let subtotal = 0;
      let totalItems = 0;
      const saleItems: any[] = [];

      for (const item of items) {
        const productDoc = await db.collection('products').doc(item.productId).get();

        if (!productDoc.exists) {
          return res.status(400).json({
            success: false,
            message: `Product ${item.productId} not found`
          });
        }

        const productData = productDoc.data();

        if (productData?.companyId !== companyId) {
          return res.status(403).json({
            success: false,
            message: `Product ${item.productId} not accessible`
          });
        }

        const unitPrice = item.unitPrice || productData?.sellingPrice || 0;
        const quantity = Number(item.quantity);
        const itemDiscountAmount = item.discountAmount || 0;
        const itemDiscountPercentage = item.discountPercentage || 0;

        let itemTotal = unitPrice * quantity;
        
        // Apply discounts
        if (itemDiscountPercentage > 0) {
          itemTotal -= itemTotal * (itemDiscountPercentage / 100);
        }
        if (itemDiscountAmount > 0) {
          itemTotal -= itemDiscountAmount;
        }

        const itemTaxAmount = itemTotal * (taxRate / 100);

        saleItems.push({
          id: db.collection('_').doc().id,
          productId: item.productId,
          productName: productData?.name,
          productSku: productData?.sku,
          variantId: item.variantId || null,
          variantName: item.variantName || null,
          quantity,
          unitPrice,
          costPrice: productData?.costPrice || 0,
          discountAmount: itemDiscountAmount,
          discountPercentage: itemDiscountPercentage,
          taxRate,
          taxAmount: itemTaxAmount,
          total: itemTotal + itemTaxAmount,
          isReturned: false
        });

        subtotal += itemTotal;
        totalItems += quantity;

        // Update inventory
        const inventorySnapshot = await db.collection('inventory')
          .where('productId', '==', item.productId)
          .where('companyId', '==', companyId)
          .limit(1)
          .get();

        if (!inventorySnapshot.empty) {
          const inventoryDoc = inventorySnapshot.docs[0];
          const currentQty = inventoryDoc.data().quantity;
          const newQty = currentQty - quantity;

          await inventoryDoc.ref.update({
            quantity: newQty,
            availableQuantity: newQty - inventoryDoc.data().reservedQuantity,
            status: newQty <= inventoryDoc.data().minQuantity ? 'low_stock' : 'in_stock',
            lastMovementAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Create inventory transaction
          await db.collection('inventoryTransactions').add({
            productId: item.productId,
            productName: productData?.name,
            productSku: productData?.sku,
            companyId,
            branchId: inventoryDoc.data().branchId,
            type: 'out',
            quantity,
            previousQuantity: currentQty,
            newQuantity: newQty,
            referenceType: 'sale',
            referenceId: invoiceNumber,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            createdByName: userName
          });
        }

        // Update product quantity
        await productDoc.ref.update({
          quantity: admin.firestore.FieldValue.increment(-quantity),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Calculate totals
      const discountTotal = subtotal * (discountPercentage / 100) + discountAmount;
      const discountedSubtotal = subtotal - discountTotal;
      const taxAmount = discountedSubtotal * (taxRate / 100);
      const total = discountedSubtotal + taxAmount + shippingCost;

      // Determine payment status
      let paymentStatus: string;
      if (paidAmount >= total) {
        paymentStatus = 'paid';
      } else if (paidAmount > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'pending';
      }

      const saleData: any = {
        invoiceNumber,
        companyId,
        branchId: (req as any).user.branchId || 'main',
        customerId: customerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        salesRepId: userId,
        salesRepName: userName,
        items: saleItems,
        subtotal,
        discountAmount,
        discountPercentage,
        taxAmount,
        taxRate,
        shippingCost,
        total,
        currency: companyData?.defaultCurrency || 'SAR',
        paymentStatus,
        paymentMethod,
        paidAmount,
        remainingAmount: total - paidAmount,
        payments: paidAmount > 0 ? [{
          id: db.collection('_').doc().id,
          amount: paidAmount,
          method: paymentMethod,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId
        }] : [],
        status: 'completed',
        isPosSale,
        posSessionId: posSessionId || null,
        source,
        notes: notes || null,
        internalNotes: internalNotes || null,
        deliveryAddress: deliveryAddress || null,
        isRefunded: false,
        totalItems,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const saleRef = await db.collection('sales').add(saleData);

      // Update customer stats
      if (customerId) {
        await db.collection('customers').doc(customerId).update({
          totalOrders: admin.firestore.FieldValue.increment(1),
          totalSpent: admin.firestore.FieldValue.increment(total),
          lastOrderDate: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Create notification
      await db.collection('notifications').add({
        userId,
        companyId,
        type: 'sale',
        title: 'New Sale',
        message: `Sale ${invoiceNumber} created for ${total.toFixed(2)}`,
        data: { saleId: saleRef.id, invoiceNumber, total },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create audit log
      await db.collection('auditLogs').add({
        userId,
        userName,
        userEmail: (req as any).user.email,
        action: 'CREATE',
        resource: 'sales',
        resourceId: saleRef.id,
        newData: saleData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        message: 'Sale created successfully',
        data: {
          id: saleRef.id,
          invoiceNumber,
          total,
          paymentStatus,
          ...saleData
        }
      });
    } catch (error: any) {
      console.error('Create sale error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sale'
      });
    }
  }
);

// Update sale
router.put('/:id',
  authenticate,
  authorize('sales', 'update'),
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

      const saleDoc = await db.collection('sales').doc(id).get();

      if (!saleDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const saleData = saleDoc.data();

      if (saleData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update sale from other company'
        });
      }

      // Only allow certain updates for completed sales
      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId
      };

      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.internalNotes !== undefined) updateData.internalNotes = updates.internalNotes;
      if (updates.status) updateData.status = updates.status;
      if (updates.deliveryStatus) updateData.deliveryStatus = updates.deliveryStatus;
      if (updates.deliveryDate) updateData.deliveryDate = new Date(updates.deliveryDate);

      await db.collection('sales').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Sale updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update sale error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update sale'
      });
    }
  }
);

// Add payment to sale
router.post('/:id/payments',
  authenticate,
  authorize('sales', 'update'),
  [
    param('id').notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('method').isIn(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'other'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, method, reference, notes } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      const saleDoc = await db.collection('sales').doc(id).get();

      if (!saleDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const saleData = saleDoc.data();

      if (saleData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access sale from other company'
        });
      }

      const newPaidAmount = saleData?.paidAmount + amount;
      const remainingAmount = saleData?.total - newPaidAmount;

      let paymentStatus: string;
      if (remainingAmount <= 0) {
        paymentStatus = 'paid';
      } else {
        paymentStatus = 'partial';
      }

      const payment = {
        id: db.collection('_').doc().id,
        amount,
        method,
        reference: reference || null,
        notes: notes || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId
      };

      await db.collection('sales').doc(id).update({
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, remainingAmount),
        paymentStatus,
        payments: admin.firestore.FieldValue.arrayUnion(payment),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create payment record
      await db.collection('payments').add({
        saleId: id,
        invoiceNumber: saleData?.invoiceNumber,
        customerId: saleData?.customerId,
        customerName: saleData?.customerName,
        amount,
        method,
        reference: reference || null,
        notes: notes || null,
        companyId,
        branchId: saleData?.branchId,
        createdBy: userId,
        createdByName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Payment added successfully',
        data: {
          payment,
          paidAmount: newPaidAmount,
          remainingAmount: Math.max(0, remainingAmount),
          paymentStatus
        }
      });
    } catch (error: any) {
      console.error('Add payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add payment'
      });
    }
  }
);

// Process refund
router.post('/:id/refund',
  authenticate,
  authorize('sales', 'update'),
  [
    param('id').notEmpty(),
    body('reason').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { items, amount, reason, notes } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const userName = (req as any).user.displayName || (req as any).user.email;

      const saleDoc = await db.collection('sales').doc(id).get();

      if (!saleDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const saleData = saleDoc.data();

      if (saleData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access sale from other company'
        });
      }

      if (saleData?.isRefunded) {
        return res.status(400).json({
          success: false,
          message: 'Sale already refunded'
        });
      }

      const refundAmount = amount || saleData?.total;

      // Process item returns
      if (items && items.length > 0) {
        for (const item of items) {
          const saleItem = saleData?.items.find((i: any) => i.id === item.itemId);
          if (saleItem) {
            // Update inventory
            const inventorySnapshot = await db.collection('inventory')
              .where('productId', '==', saleItem.productId)
              .where('companyId', '==', companyId)
              .limit(1)
              .get();

            if (!inventorySnapshot.empty) {
              const inventoryDoc = inventorySnapshot.docs[0];
              await inventoryDoc.ref.update({
                quantity: admin.firestore.FieldValue.increment(item.quantity),
                availableQuantity: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }

            // Update product quantity
            await db.collection('products').doc(saleItem.productId).update({
              quantity: admin.firestore.FieldValue.increment(item.quantity),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      await db.collection('sales').doc(id).update({
        isRefunded: true,
        refundAmount,
        refundReason: reason,
        refundNotes: notes || null,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'refunded',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create refund record
      await db.collection('refunds').add({
        saleId: id,
        invoiceNumber: saleData?.invoiceNumber,
        customerId: saleData?.customerId,
        customerName: saleData?.customerName,
        amount: refundAmount,
        reason,
        notes: notes || null,
        items: items || [],
        companyId,
        createdBy: userId,
        createdByName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refundAmount,
          reason
        }
      });
    } catch (error: any) {
      console.error('Process refund error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process refund'
      });
    }
  }
);

// Get sales summary
router.get('/reports/summary',
  authenticate,
  authorize('reports', 'read'),
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

      const summary = {
        totalSales: sales.length,
        totalAmount: sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
        totalPaid: sales.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0),
        totalPending: sales.reduce((sum: number, s: any) => sum + (s.remainingAmount || 0), 0),
        totalItems: sales.reduce((sum: number, s: any) => sum + (s.totalItems || 0), 0),
        averageOrderValue: sales.length > 0 ? sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0) / sales.length : 0
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      console.error('Get sales summary error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sales summary'
      });
    }
  }
);

export { router as saleRoutes };
