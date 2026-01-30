import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all branches
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;

      const snapshot = await db.collection('branches')
        .where('companyId', '==', companyId)
        .orderBy('isMainBranch', 'desc')
        .orderBy('name', 'asc')
        .get();

      const branches = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      res.json({
        success: true,
        data: branches
      });
    } catch (error: any) {
      console.error('Get branches error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get branches'
      });
    }
  }
);

// Get branch by ID
router.get('/:id',
  authenticate,
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req as any).user.companyId;

      const branchDoc = await db.collection('branches').doc(id).get();

      if (!branchDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }

      const branchData = branchDoc.data();

      if (branchData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access branch from other company'
        });
      }

      res.json({
        success: true,
        data: {
          id: branchDoc.id,
          ...branchData,
          createdAt: branchData?.createdAt?.toDate(),
          updatedAt: branchData?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get branch error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get branch'
      });
    }
  }
);

// Create branch
router.post('/',
  authenticate,
  authorize('products', 'create'),
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
        email,
        phone,
        address,
        location,
        isMainBranch,
        receiptPrefix
      } = req.body;

      const companyId = (req as any).user.companyId;

      // Check if code exists
      const existingCode = await db.collection('branches')
        .where('companyId', '==', companyId)
        .where('code', '==', code)
        .get();

      if (!existingCode.empty) {
        return res.status(400).json({
          success: false,
          message: 'Branch code already exists'
        });
      }

      const branchData: any = {
        name,
        code,
        email: email || null,
        phone: phone || null,
        address: address || null,
        location: location || null,
        isMainBranch: isMainBranch || false,
        isActive: true,
        receiptPrefix: receiptPrefix || null,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('branches').add(branchData);

      res.status(201).json({
        success: true,
        message: 'Branch created successfully',
        data: {
          id: docRef.id,
          ...branchData
        }
      });
    } catch (error: any) {
      console.error('Create branch error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create branch'
      });
    }
  }
);

// Update branch
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

      const branchDoc = await db.collection('branches').doc(id).get();

      if (!branchDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }

      const branchData = branchDoc.data();

      if (branchData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update branch from other company'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.code) updateData.code = updates.code;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.receiptPrefix !== undefined) updateData.receiptPrefix = updates.receiptPrefix;

      await db.collection('branches').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Branch updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update branch error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update branch'
      });
    }
  }
);

// Delete branch
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

      const branchDoc = await db.collection('branches').doc(id).get();

      if (!branchDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }

      const branchData = branchDoc.data();

      if (branchData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete branch from other company'
        });
      }

      if (branchData?.isMainBranch) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete main branch'
        });
      }

      await db.collection('branches').doc(id).delete();

      res.json({
        success: true,
        message: 'Branch deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete branch error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete branch'
      });
    }
  }
);

export { router as branchRoutes };
