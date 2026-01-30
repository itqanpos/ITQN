import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all categories
router.get('/',
  authenticate,
  authorize('products', 'read'),
  async (req, res) => {
    try {
      const { parentId, includeInactive } = req.query;
      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('categories')
        .where('companyId', 'in', [companyId, 'global']);

      if (parentId) {
        queryRef = queryRef.where('parentId', '==', parentId);
      } else {
        queryRef = queryRef.where('parentId', '==', null);
      }

      queryRef = queryRef.orderBy('sortOrder', 'asc');

      const snapshot = await queryRef.get();

      let categories = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      if (includeInactive !== 'true') {
        categories = categories.filter((c: any) => c.isActive);
      }

      // Get product count for each category
      const categoriesWithCount = await Promise.all(
        categories.map(async (cat: any) => {
          const countSnapshot = await db.collection('products')
            .where('categoryId', '==', cat.id)
            .where('companyId', '==', companyId)
            .count()
            .get();

          return {
            ...cat,
            productCount: countSnapshot.data().count
          };
        })
      );

      res.json({
        success: true,
        data: categoriesWithCount
      });
    } catch (error: any) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get categories'
      });
    }
  }
);

// Get category by ID
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

      const categoryDoc = await db.collection('categories').doc(id).get();

      if (!categoryDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Get subcategories
      const subcategoriesSnapshot = await db.collection('categories')
        .where('parentId', '==', id)
        .orderBy('sortOrder', 'asc')
        .get();

      const subcategories = subcategoriesSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        success: true,
        data: {
          id: categoryDoc.id,
          ...categoryDoc.data(),
          subcategories,
          createdAt: categoryDoc.data()?.createdAt?.toDate(),
          updatedAt: categoryDoc.data()?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get category'
      });
    }
  }
);

// Create category
router.post('/',
  authenticate,
  authorize('products', 'create'),
  [
    body('name').trim().notEmpty().isLength({ min: 2 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        name,
        description,
        parentId,
        image,
        sortOrder = 0
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const categoryData: any = {
        name,
        description: description || null,
        parentId: parentId || null,
        image: image || null,
        sortOrder: Number(sortOrder),
        isActive: true,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('categories').add(categoryData);

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: {
          id: docRef.id,
          ...categoryData
        }
      });
    } catch (error: any) {
      console.error('Create category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create category'
      });
    }
  }
);

// Update category
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

      const categoryDoc = await db.collection('categories').doc(id).get();

      if (!categoryDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.parentId !== undefined) updateData.parentId = updates.parentId;
      if (updates.image !== undefined) updateData.image = updates.image;
      if (updates.sortOrder !== undefined) updateData.sortOrder = Number(updates.sortOrder);
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      await db.collection('categories').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update category'
      });
    }
  }
);

// Delete category
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

      // Check if category has products
      const productsSnapshot = await db.collection('products')
        .where('categoryId', '==', id)
        .limit(1)
        .get();

      if (!productsSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category with products'
        });
      }

      // Check if category has subcategories
      const subcategoriesSnapshot = await db.collection('categories')
        .where('parentId', '==', id)
        .limit(1)
        .get();

      if (!subcategoriesSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category with subcategories'
        });
      }

      await db.collection('categories').doc(id).delete();

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete category'
      });
    }
  }
);

export { router as categoryRoutes };
