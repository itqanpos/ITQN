import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all suppliers
router.get('/',
  authenticate,
  authorize('products', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('suppliers')
        .where('companyId', '==', companyId)
        .orderBy('name', 'asc');

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let suppliers = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Filter by search
      if (search) {
        const searchLower = (search as string).toLowerCase();
        suppliers = suppliers.filter((s: any) =>
          s.name?.toLowerCase().includes(searchLower) ||
          s.contactName?.toLowerCase().includes(searchLower) ||
          s.email?.toLowerCase().includes(searchLower) ||
          s.phone?.includes(search as string)
        );
      }

      // Get total count
      const countSnapshot = await db.collection('suppliers')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          suppliers,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get suppliers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get suppliers'
      });
    }
  }
);

// Get supplier by ID
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

      const supplierDoc = await db.collection('suppliers').doc(id).get();

      if (!supplierDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      const supplierData = supplierDoc.data();

      if (supplierData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access supplier from other company'
        });
      }

      // Get purchase orders
      const ordersSnapshot = await db.collection('purchaseOrders')
        .where('supplierId', '==', id)
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const purchaseOrders = ordersSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      res.json({
        success: true,
        data: {
          id: supplierDoc.id,
          ...supplierData,
          purchaseOrders,
          createdAt: supplierData?.createdAt?.toDate(),
          updatedAt: supplierData?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get supplier error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get supplier'
      });
    }
  }
);

// Create supplier
router.post('/',
  authenticate,
  authorize('products', 'create'),
  [
    body('name').trim().notEmpty(),
    body('phone').trim().notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        name,
        contactName,
        email,
        phone,
        phone2,
        fax,
        address,
        taxNumber,
        commercialRegistration,
        paymentTerms,
        creditLimit,
        categories,
        notes
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const supplierData: any = {
        name,
        contactName: contactName || null,
        email: email || null,
        phone,
        phone2: phone2 || null,
        fax: fax || null,
        address: address || null,
        taxNumber: taxNumber || null,
        commercialRegistration: commercialRegistration || null,
        paymentTerms: paymentTerms || null,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        currentBalance: 0,
        categories: categories || [],
        notes: notes || null,
        isActive: true,
        totalOrders: 0,
        totalPurchases: 0,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId
      };

      const docRef = await db.collection('suppliers').add(supplierData);

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: {
          id: docRef.id,
          ...supplierData
        }
      });
    } catch (error: any) {
      console.error('Create supplier error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create supplier'
      });
    }
  }
);

// Update supplier
router.put('/:id',
  authenticate,
  authorize('products', 'update'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const companyId = (req as any).user.companyId;

      const supplierDoc = await db.collection('suppliers').doc(id).get();

      if (!supplierDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      const supplierData = supplierDoc.data();

      if (supplierData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update supplier from other company'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.contactName !== undefined) updateData.contactName = updates.contactName;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone) updateData.phone = updates.phone;
      if (updates.phone2 !== undefined) updateData.phone2 = updates.phone2;
      if (updates.fax !== undefined) updateData.fax = updates.fax;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.taxNumber !== undefined) updateData.taxNumber = updates.taxNumber;
      if (updates.commercialRegistration !== undefined) updateData.commercialRegistration = updates.commercialRegistration;
      if (updates.paymentTerms !== undefined) updateData.paymentTerms = updates.paymentTerms;
      if (updates.creditLimit !== undefined) updateData.creditLimit = Number(updates.creditLimit);
      if (updates.categories !== undefined) updateData.categories = updates.categories;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      await db.collection('suppliers').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Supplier updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update supplier error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update supplier'
      });
    }
  }
);

// Delete supplier
router.delete('/:id',
  authenticate,
  authorize('products', 'delete'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const supplierDoc = await db.collection('suppliers').doc(id).get();

      if (!supplierDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      const supplierData = supplierDoc.data();

      if (supplierData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete supplier from other company'
        });
      }

      // Check if supplier has purchase orders
      const ordersSnapshot = await db.collection('purchaseOrders')
        .where('supplierId', '==', id)
        .limit(1)
        .get();

      if (!ordersSnapshot.empty) {
        // Soft delete
        await db.collection('suppliers').doc(id).update({
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          message: 'Supplier deactivated (has purchase orders)'
        });
      }

      await db.collection('suppliers').doc(id).delete();

      res.json({
        success: true,
        message: 'Supplier deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete supplier error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete supplier'
      });
    }
  }
);

export { router as supplierRoutes };
