import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();
const auth = admin.auth();

// Get all users
router.get('/',
  authenticate,
  authorize('users', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isString(),
    query('status').optional().isString(),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        status, 
        search,
        companyId 
      } = req.query;

      const userCompanyId = (req as any).user.companyId;
      const targetCompanyId = companyId || userCompanyId;

      // Check permissions
      if (companyId && companyId !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot access users from other companies'
        });
      }

      let queryRef: any = db.collection('users')
        .where('companyId', '==', targetCompanyId)
        .orderBy('createdAt', 'desc');

      if (role) {
        queryRef = queryRef.where('role', '==', role);
      }

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let users = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          displayName: data.displayName,
          phoneNumber: data.phoneNumber,
          photoURL: data.photoURL,
          role: data.role,
          status: data.status,
          companyId: data.companyId,
          branchId: data.branchId,
          lastLoginAt: data.lastLoginAt?.toDate(),
          createdAt: data.createdAt?.toDate()
        };
      });

      // Filter by search term if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        users = users.filter((user: any) =>
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phoneNumber?.includes(search as string)
        );
      }

      // Get total count
      const countSnapshot = await db.collection('users')
        .where('companyId', '==', targetCompanyId)
        .count().get();

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get users'
      });
    }
  }
);

// Get user by ID
router.get('/:id',
  authenticate,
  authorize('users', 'read'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userCompanyId = (req as any).user.companyId;

      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userData = userDoc.data();

      // Check permissions
      if (userData?.companyId !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot access user from other company'
        });
      }

      res.json({
        success: true,
        data: {
          id: userDoc.id,
          ...userData,
          createdAt: userData?.createdAt?.toDate(),
          updatedAt: userData?.updatedAt?.toDate(),
          lastLoginAt: userData?.lastLoginAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user'
      });
    }
  }
);

// Create user
router.post('/',
  authenticate,
  authorize('users', 'create'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('displayName').trim().isLength({ min: 2 }),
    body('role').isIn(['admin', 'manager', 'sales_rep', 'cashier', 'accountant', 'inventory_manager', 'viewer']),
    body('companyId').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        email,
        password,
        displayName,
        phoneNumber,
        role,
        branchId,
        permissions,
        companyId
      } = req.body;

      const userCompanyId = (req as any).user.companyId;
      const targetCompanyId = companyId || userCompanyId;

      // Check permissions for creating in other company
      if (companyId && companyId !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot create user for other company'
        });
      }

      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        phoneNumber
      });

      // Create user document
      const userData: any = {
        id: userRecord.uid,
        email,
        displayName,
        phoneNumber: phoneNumber || null,
        role,
        status: 'active',
        companyId: targetCompanyId,
        branchId: branchId || null,
        permissions: permissions || [],
        emailVerified: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: (req as any).user.uid
      };

      await db.collection('users').doc(userRecord.uid).set(userData);

      // Set custom claims
      await auth.setCustomUserClaims(userRecord.uid, {
        role,
        companyId: targetCompanyId,
        branchId: branchId || null
      });

      // Create audit log
      await db.collection('auditLogs').add({
        userId: (req as any).user.uid,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'CREATE',
        resource: 'users',
        resourceId: userRecord.uid,
        newData: userData,
        companyId: targetCompanyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: userRecord.uid,
          ...userData
        }
      });
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create user'
      });
    }
  }
);

// Update user
router.put('/:id',
  authenticate,
  authorize('users', 'update'),
  [
    param('id').notEmpty(),
    body('displayName').optional().trim().isLength({ min: 2 }),
    body('role').optional().isIn(['admin', 'manager', 'sales_rep', 'cashier', 'accountant', 'inventory_manager', 'viewer']),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userCompanyId = (req as any).user.companyId;

      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userData = userDoc.data();

      // Check permissions
      if (userData?.companyId !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot update user from other company'
        });
      }

      // Cannot update own role if admin
      if (id === (req as any).user.uid && updates.role && updates.role !== userData?.role) {
        return res.status(403).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: (req as any).user.uid
      };

      // Update Firebase Auth if needed
      const authUpdates: any = {};

      if (updates.displayName) {
        updateData.displayName = updates.displayName;
        authUpdates.displayName = updates.displayName;
      }

      if (updates.phoneNumber) {
        updateData.phoneNumber = updates.phoneNumber;
        authUpdates.phoneNumber = updates.phoneNumber;
      }

      if (updates.role) {
        updateData.role = updates.role;
      }

      if (updates.status) {
        updateData.status = updates.status;
      }

      if (updates.branchId !== undefined) {
        updateData.branchId = updates.branchId;
      }

      if (updates.permissions) {
        updateData.permissions = updates.permissions;
      }

      if (updates.preferences) {
        updateData.preferences = {
          ...userData?.preferences,
          ...updates.preferences
        };
      }

      // Update Firestore
      await db.collection('users').doc(id).update(updateData);

      // Update Firebase Auth
      if (Object.keys(authUpdates).length > 0) {
        await auth.updateUser(id, authUpdates);
      }

      // Update custom claims
      if (updates.role || updates.branchId !== undefined) {
        await auth.setCustomUserClaims(id, {
          role: updates.role || userData?.role,
          companyId: userData?.companyId,
          branchId: updates.branchId !== undefined ? updates.branchId : userData?.branchId
        });
      }

      // Create audit log
      await db.collection('auditLogs').add({
        userId: (req as any).user.uid,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'UPDATE',
        resource: 'users',
        resourceId: id,
        oldData: userData,
        newData: updateData,
        companyId: userData?.companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  }
);

// Delete user
router.delete('/:id',
  authenticate,
  authorize('users', 'delete'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userCompanyId = (req as any).user.companyId;

      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userData = userDoc.data();

      // Check permissions
      if (userData?.companyId !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete user from other company'
        });
      }

      // Cannot delete yourself
      if (id === (req as any).user.uid) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Delete from Firebase Auth
      await auth.deleteUser(id);

      // Delete from Firestore
      await db.collection('users').doc(id).delete();

      // Create audit log
      await db.collection('auditLogs').add({
        userId: (req as any).user.uid,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'DELETE',
        resource: 'users',
        resourceId: id,
        oldData: userData,
        companyId: userData?.companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete user'
      });
    }
  }
);

// Get current user profile
router.get('/me/profile',
  authenticate,
  async (req, res) => {
    try {
      const userId = (req as any).user.uid;

      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      res.json({
        success: true,
        data: {
          id: userDoc.id,
          ...userData,
          createdAt: userData?.createdAt?.toDate(),
          updatedAt: userData?.updatedAt?.toDate(),
          lastLoginAt: userData?.lastLoginAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get profile'
      });
    }
  }
);

// Update current user profile
router.put('/me/profile',
  authenticate,
  [
    body('displayName').optional().trim().isLength({ min: 2 }),
    body('phoneNumber').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = (req as any).user.uid;
      const { displayName, phoneNumber, preferences } = req.body;

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const authUpdates: any = {};

      if (displayName) {
        updateData.displayName = displayName;
        authUpdates.displayName = displayName;
      }

      if (phoneNumber) {
        updateData.phoneNumber = phoneNumber;
        authUpdates.phoneNumber = phoneNumber;
      }

      if (preferences) {
        updateData.preferences = preferences;
      }

      await db.collection('users').doc(userId).update(updateData);

      if (Object.keys(authUpdates).length > 0) {
        await auth.updateUser(userId, authUpdates);
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updateData
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update profile'
      });
    }
  }
);

export { router as userRoutes };
