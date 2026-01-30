import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get all products
router.get('/',
  authenticate,
  authorize('products', 'read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('categoryId').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', 'discontinued', 'out_of_stock']),
    query('lowStock').optional().isBoolean(),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        categoryId,
        status,
        lowStock,
        search,
        branchId
      } = req.query;

      const companyId = (req as any).user.companyId;

      let queryRef: any = db.collection('products')
        .where('companyId', '==', companyId);

      if (branchId) {
        queryRef = queryRef.where('branchId', '==', branchId);
      }

      if (categoryId) {
        queryRef = queryRef.where('categoryId', '==', categoryId);
      }

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      if (lowStock === 'true') {
        queryRef = queryRef.where('quantity', '<=', db.FieldValue.increment(0));
      }

      queryRef = queryRef.orderBy('createdAt', 'desc');

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      let products = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        };
      });

      // Filter by search term
      if (search) {
        const searchLower = (search as string).toLowerCase();
        products = products.filter((p: any) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.barcode?.includes(search as string)
        );
      }

      // Get categories for products
      const categoryIds = [...new Set(products.map((p: any) => p.categoryId).filter(Boolean))];
      const categories: any = {};

      if (categoryIds.length > 0) {
        const categorySnapshots = await Promise.all(
          categoryIds.map(id => db.collection('categories').doc(id).get())
        );

        categorySnapshots.forEach(catDoc => {
          if (catDoc.exists) {
            categories[catDoc.id] = catDoc.data();
          }
        });
      }

      products = products.map((p: any) => ({
        ...p,
        category: categories[p.categoryId] ? {
          id: p.categoryId,
          name: categories[p.categoryId].name
        } : null
      }));

      // Get total count
      const countSnapshot = await db.collection('products')
        .where('companyId', '==', companyId)
        .count().get();

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countSnapshot.data().count,
            pages: Math.ceil(countSnapshot.data().count / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Get products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get products'
      });
    }
  }
);

// Get product by ID
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

      const productDoc = await db.collection('products').doc(id).get();

      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const productData = productDoc.data();

      if (productData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access product from other company'
        });
      }

      // Get category
      let category = null;
      if (productData?.categoryId) {
        const catDoc = await db.collection('categories').doc(productData.categoryId).get();
        if (catDoc.exists) {
          category = {
            id: catDoc.id,
            ...catDoc.data()
          };
        }
      }

      // Get inventory
      const inventorySnapshot = await db.collection('inventory')
        .where('productId', '==', id)
        .where('companyId', '==', companyId)
        .get();

      const inventory = inventorySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        success: true,
        data: {
          id: productDoc.id,
          ...productData,
          category,
          inventory,
          createdAt: productData?.createdAt?.toDate(),
          updatedAt: productData?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get product'
      });
    }
  }
);

// Create product
router.post('/',
  authenticate,
  authorize('products', 'create'),
  [
    body('sku').trim().notEmpty(),
    body('name').trim().notEmpty().isLength({ min: 2 }),
    body('categoryId').notEmpty(),
    body('costPrice').isFloat({ min: 0 }),
    body('sellingPrice').isFloat({ min: 0 }),
    body('unit').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        sku,
        barcode,
        name,
        description,
        categoryId,
        subcategoryId,
        costPrice,
        sellingPrice,
        wholesalePrice,
        specialPrice,
        currency = 'SAR',
        quantity = 0,
        minQuantity = 0,
        maxQuantity,
        reorderPoint,
        unit,
        weight,
        dimensions,
        images = [],
        taxRate = 0,
        isTaxable = true,
        brand,
        manufacturer,
        origin,
        hasVariants = false,
        variants,
        attributes,
        branchId
      } = req.body;

      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // Check if SKU exists
      const existingSku = await db.collection('products')
        .where('companyId', '==', companyId)
        .where('sku', '==', sku)
        .get();

      if (!existingSku.empty) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }

      // Check if barcode exists (if provided)
      if (barcode) {
        const existingBarcode = await db.collection('products')
          .where('companyId', '==', companyId)
          .where('barcode', '==', barcode)
          .get();

        if (!existingBarcode.empty) {
          return res.status(400).json({
            success: false,
            message: 'Barcode already exists'
          });
        }
      }

      const productData: any = {
        sku,
        barcode: barcode || null,
        name,
        description: description || null,
        categoryId,
        subcategoryId: subcategoryId || null,
        companyId,
        branchId: branchId || null,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
        specialPrice: specialPrice ? Number(specialPrice) : null,
        currency,
        quantity: Number(quantity),
        minQuantity: Number(minQuantity),
        maxQuantity: maxQuantity ? Number(maxQuantity) : null,
        reorderPoint: reorderPoint ? Number(reorderPoint) : null,
        unit,
        weight: weight ? Number(weight) : null,
        dimensions: dimensions || null,
        images,
        thumbnail: images.length > 0 ? images[0] : null,
        taxRate: Number(taxRate),
        isTaxable,
        brand: brand || null,
        manufacturer: manufacturer || null,
        origin: origin || null,
        hasVariants,
        variants: variants || [],
        attributes: attributes || [],
        status: quantity > minQuantity ? 'active' : 'out_of_stock',
        isActive: true,
        isFeatured: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId,
        updatedBy: userId
      };

      const docRef = await db.collection('products').add(productData);

      // Create inventory record if quantity > 0
      if (quantity > 0) {
        await db.collection('inventory').add({
          productId: docRef.id,
          productName: name,
          productSku: sku,
          companyId,
          branchId: branchId || 'main',
          quantity: Number(quantity),
          reservedQuantity: 0,
          availableQuantity: Number(quantity),
          minQuantity: Number(minQuantity),
          maxQuantity: maxQuantity ? Number(maxQuantity) : null,
          reorderPoint: reorderPoint ? Number(reorderPoint) : null,
          averageCost: Number(costPrice),
          totalValue: Number(costPrice) * Number(quantity),
          status: quantity <= minQuantity ? 'low_stock' : 'in_stock',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create inventory transaction
        await db.collection('inventoryTransactions').add({
          productId: docRef.id,
          productName: name,
          productSku: sku,
          companyId,
          branchId: branchId || 'main',
          type: 'in',
          quantity: Number(quantity),
          previousQuantity: 0,
          newQuantity: Number(quantity),
          referenceType: 'opening',
          unitCost: Number(costPrice),
          totalCost: Number(costPrice) * Number(quantity),
          notes: 'Initial stock',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
          createdByName: (req as any).user.displayName || (req as any).user.email
        });
      }

      // Create audit log
      await db.collection('auditLogs').add({
        userId,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'CREATE',
        resource: 'products',
        resourceId: docRef.id,
        newData: productData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: {
          id: docRef.id,
          ...productData
        }
      });
    } catch (error: any) {
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create product'
      });
    }
  }
);

// Update product
router.put('/:id',
  authenticate,
  authorize('products', 'update'),
  [
    param('id').notEmpty(),
    body('name').optional().trim().isLength({ min: 2 }),
    body('sellingPrice').optional().isFloat({ min: 0 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      const productDoc = await db.collection('products').doc(id).get();

      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const productData = productDoc.data();

      if (productData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update product from other company'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId
      };

      // Update fields
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryId) updateData.categoryId = updates.categoryId;
      if (updates.subcategoryId !== undefined) updateData.subcategoryId = updates.subcategoryId;
      if (updates.costPrice !== undefined) updateData.costPrice = Number(updates.costPrice);
      if (updates.sellingPrice !== undefined) updateData.sellingPrice = Number(updates.sellingPrice);
      if (updates.wholesalePrice !== undefined) updateData.wholesalePrice = updates.wholesalePrice ? Number(updates.wholesalePrice) : null;
      if (updates.specialPrice !== undefined) updateData.specialPrice = updates.specialPrice ? Number(updates.specialPrice) : null;
      if (updates.minQuantity !== undefined) updateData.minQuantity = Number(updates.minQuantity);
      if (updates.maxQuantity !== undefined) updateData.maxQuantity = updates.maxQuantity ? Number(updates.maxQuantity) : null;
      if (updates.reorderPoint !== undefined) updateData.reorderPoint = updates.reorderPoint ? Number(updates.reorderPoint) : null;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.weight !== undefined) updateData.weight = updates.weight ? Number(updates.weight) : null;
      if (updates.dimensions !== undefined) updateData.dimensions = updates.dimensions;
      if (updates.images) {
        updateData.images = updates.images;
        updateData.thumbnail = updates.images.length > 0 ? updates.images[0] : null;
      }
      if (updates.taxRate !== undefined) updateData.taxRate = Number(updates.taxRate);
      if (updates.isTaxable !== undefined) updateData.isTaxable = updates.isTaxable;
      if (updates.brand !== undefined) updateData.brand = updates.brand;
      if (updates.manufacturer !== undefined) updateData.manufacturer = updates.manufacturer;
      if (updates.origin !== undefined) updateData.origin = updates.origin;
      if (updates.hasVariants !== undefined) updateData.hasVariants = updates.hasVariants;
      if (updates.variants !== undefined) updateData.variants = updates.variants;
      if (updates.attributes !== undefined) updateData.attributes = updates.attributes;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.isFeatured !== undefined) updateData.isFeatured = updates.isFeatured;

      // Update status based on quantity
      if (updates.quantity !== undefined) {
        updateData.quantity = Number(updates.quantity);
        const minQty = updates.minQuantity !== undefined ? Number(updates.minQuantity) : productData?.minQuantity;
        updateData.status = Number(updates.quantity) <= minQty ? 'out_of_stock' : 'active';
      }

      await db.collection('products').doc(id).update(updateData);

      // Update inventory if quantity changed
      if (updates.quantity !== undefined) {
        const inventorySnapshot = await db.collection('inventory')
          .where('productId', '==', id)
          .where('companyId', '==', companyId)
          .limit(1)
          .get();

        if (!inventorySnapshot.empty) {
          const inventoryDoc = inventorySnapshot.docs[0];
          const oldQty = inventoryDoc.data().quantity;
          const newQty = Number(updates.quantity);

          await inventoryDoc.ref.update({
            quantity: newQty,
            availableQuantity: newQty - inventoryDoc.data().reservedQuantity,
            status: newQty <= inventoryDoc.data().minQuantity ? 'low_stock' : 'in_stock',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Create adjustment transaction
          if (oldQty !== newQty) {
            await db.collection('inventoryTransactions').add({
              productId: id,
              productName: productData?.name,
              productSku: productData?.sku,
              companyId,
              branchId: inventoryDoc.data().branchId,
              type: newQty > oldQty ? 'in' : 'out',
              quantity: Math.abs(newQty - oldQty),
              previousQuantity: oldQty,
              newQuantity: newQty,
              referenceType: 'adjustment',
              notes: updates.notes || 'Manual adjustment',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: userId,
              createdByName: (req as any).user.displayName || (req as any).user.email
            });
          }
        }
      }

      // Create audit log
      await db.collection('auditLogs').add({
        userId,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'UPDATE',
        resource: 'products',
        resourceId: id,
        oldData: productData,
        newData: updateData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  }
);

// Delete product
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

      const productDoc = await db.collection('products').doc(id).get();

      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const productData = productDoc.data();

      if (productData?.companyId !== companyId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete product from other company'
        });
      }

      // Check if product has sales
      const salesSnapshot = await db.collection('saleItems')
        .where('productId', '==', id)
        .limit(1)
        .get();

      if (!salesSnapshot.empty) {
        // Soft delete - mark as discontinued
        await db.collection('products').doc(id).update({
          status: 'discontinued',
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          message: 'Product marked as discontinued (has sales history)'
        });
      }

      // Hard delete
      await db.collection('products').doc(id).delete();

      // Delete inventory records
      const inventorySnapshot = await db.collection('inventory')
        .where('productId', '==', id)
        .get();

      const batch = db.batch();
      inventorySnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Create audit log
      await db.collection('auditLogs').add({
        userId: (req as any).user.uid,
        userName: (req as any).user.displayName || (req as any).user.email,
        userEmail: (req as any).user.email,
        action: 'DELETE',
        resource: 'products',
        resourceId: id,
        oldData: productData,
        companyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete product'
      });
    }
  }
);

// Get low stock products
router.get('/alerts/low-stock',
  authenticate,
  authorize('products', 'read'),
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;
      const { branchId } = req.query;

      let queryRef: any = db.collection('inventory')
        .where('companyId', '==', companyId);

      if (branchId) {
        queryRef = queryRef.where('branchId', '==', branchId);
      }

      const snapshot = await queryRef.get();

      const lowStockItems = snapshot.docs
        .map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((item: any) => item.quantity <= item.minQuantity);

      res.json({
        success: true,
        data: {
          items: lowStockItems,
          count: lowStockItems.length
        }
      });
    } catch (error: any) {
      console.error('Get low stock error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get low stock items'
      });
    }
  }
);

// Import products
router.post('/import',
  authenticate,
  authorize('products', 'import'),
  async (req, res) => {
    try {
      const { products } = req.body;
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No products to import'
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[]
      };

      const batch = db.batch();

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
          // Validate required fields
          if (!product.sku || !product.name || !product.categoryId) {
            results.failed++;
            results.errors.push({ index: i, error: 'Missing required fields' });
            continue;
          }

          // Check SKU
          const existingSku = await db.collection('products')
            .where('companyId', '==', companyId)
            .where('sku', '==', product.sku)
            .get();

          if (!existingSku.empty) {
            results.failed++;
            results.errors.push({ index: i, error: `SKU ${product.sku} already exists` });
            continue;
          }

          const productData = {
            sku: product.sku,
            barcode: product.barcode || null,
            name: product.name,
            description: product.description || null,
            categoryId: product.categoryId,
            subcategoryId: product.subcategoryId || null,
            companyId,
            costPrice: Number(product.costPrice) || 0,
            sellingPrice: Number(product.sellingPrice) || 0,
            wholesalePrice: product.wholesalePrice ? Number(product.wholesalePrice) : null,
            quantity: Number(product.quantity) || 0,
            minQuantity: Number(product.minQuantity) || 0,
            unit: product.unit || 'piece',
            images: product.images || [],
            taxRate: Number(product.taxRate) || 0,
            isTaxable: product.isTaxable !== false,
            status: (Number(product.quantity) || 0) > (Number(product.minQuantity) || 0) ? 'active' : 'out_of_stock',
            isActive: true,
            isFeatured: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            updatedBy: userId
          };

          const docRef = db.collection('products').doc();
          batch.set(docRef, productData);

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ index: i, error: error.message });
        }
      }

      await batch.commit();

      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      console.error('Import products error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to import products'
      });
    }
  }
);

export { router as productRoutes };
