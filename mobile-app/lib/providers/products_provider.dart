import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:sales_rep_app/models/product.dart';

class ProductsProvider with ChangeNotifier {
  List<Product> _products = [];
  List<Product> _offlineProducts = [];
  bool _isLoading = false;
  String? _companyId;
  Database? _database;

  List<Product> get products => _products;
  List<Product> get offlineProducts => _offlineProducts;
  bool get isLoading => _isLoading;

  void setCompanyId(String companyId) {
    _companyId = companyId;
    _initDatabase();
  }

  Future<void> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, 'sales_rep.db');

    _database = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT,
            code TEXT,
            barcode TEXT,
            purchasePrice REAL,
            salePrice REAL,
            stock REAL,
            unit TEXT,
            category TEXT,
            lastUpdated INTEGER
          )
        ''');
        
        await db.execute('''
          CREATE TABLE offline_orders (
            id TEXT PRIMARY KEY,
            customerName TEXT,
            customerPhone TEXT,
            items TEXT,
            subtotal REAL,
            tax REAL,
            total REAL,
            status TEXT,
            createdAt INTEGER,
            synced INTEGER DEFAULT 0
          )
        ''');
      },
    );
    
    await _loadOfflineProducts();
  }

  Future<void> syncProducts() async {
    if (_companyId == null) return;

    try {
      _isLoading = true;
      notifyListeners();

      final snapshot = await FirebaseFirestore.instance
          .collection('companies')
          .doc(_companyId)
          .collection('products')
          .where('isActive', isEqualTo: true)
          .get();

      _products = snapshot.docs.map((doc) {
        final data = doc.data();
        return Product(
          id: doc.id,
          name: data['name'] ?? '',
          code: data['code'] ?? '',
          barcode: data['barcode'] ?? '',
          purchasePrice: data['purchasePrice']?.toDouble() ?? 0,
          salePrice: data['salePrice']?.toDouble() ?? 0,
          stock: data['stock']?.toDouble() ?? 0,
          unit: data['unit'] ?? 'قطعة',
          category: data['category'] ?? '',
          lastUpdated: DateTime.now().millisecondsSinceEpoch,
        );
      }).toList();

      // حفظ في قاعدة البيانات المحلية
      await _saveProductsToLocal();
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _saveProductsToLocal() async {
    if (_database == null) return;

    final batch = _database!.batch();
    
    for (final product in _products) {
      batch.insert(
        'products',
        product.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    
    await batch.commit();
    await _loadOfflineProducts();
  }

  Future<void> _loadOfflineProducts() async {
    if (_database == null) return;

    final products = await _database!.query('products');
    _offlineProducts = products.map((map) => Product.fromMap(map)).toList();
    notifyListeners();
  }

  Future<List<Product>> searchProducts(String query) async {
    if (_offlineProducts.isEmpty && _database != null) {
      await _loadOfflineProducts();
    }

    if (query.isEmpty) return _offlineProducts;

    return _offlineProducts.where((product) {
      return product.name.contains(query) ||
          product.code.contains(query) ||
          (product.barcode?.contains(query) ?? false);
    }).toList();
  }

  Future<void> updateProductStock(String productId, double quantity) async {
    final product = _offlineProducts.firstWhere((p) => p.id == productId);
    final newStock = product.stock - quantity;
    
    if (_database != null) {
      await _database!.update(
        'products',
        {'stock': newStock},
        where: 'id = ?',
        whereArgs: [productId],
      );
      
      await _loadOfflineProducts();
    }
  }

  Future<void> syncOrders() async {
    if (_database == null || _companyId == null) return;

    final orders = await _database!.query(
      'offline_orders',
      where: 'synced = ?',
      whereArgs: [0],
    );

    for (final order in orders) {
      try {
        await FirebaseFirestore.instance
            .collection('companies')
            .doc(_companyId)
            .collection('orders')
            .add({
          'customerName': order['customerName'],
          'customerPhone': order['customerPhone'],
          'items': order['items'],
          'subtotal': order['subtotal'],
          'tax': order['tax'],
          'total': order['total'],
          'status': 'pending',
          'createdAt': Timestamp.fromMillisecondsSinceEpoch(order['createdAt'] as int),
          'salesRepId': FirebaseAuth.instance.currentUser?.uid,
          'synced': true,
        });

        await _database!.update(
          'offline_orders',
          {'synced': 1},
          where: 'id = ?',
          whereArgs: [order['id']],
        );
      } catch (e) {
        print('Error syncing order: $e');
      }
    }
  }

  Future<String> createOfflineOrder(Map<String, dynamic> orderData) async {
    if (_database == null) return '';

    final id = DateTime.now().millisecondsSinceEpoch.toString();
    
    await _database!.insert('offline_orders', {
      'id': id,
      'customerName': orderData['customerName'],
      'customerPhone': orderData['customerPhone'],
      'items': orderData['items'],
      'subtotal': orderData['subtotal'],
      'tax': orderData['tax'],
      'total': orderData['total'],
      'status': 'pending',
      'createdAt': DateTime.now().millisecondsSinceEpoch,
      'synced': 0,
    });

    // تحديث المخزون المحلي
    final items = List<Map<String, dynamic>>.from(orderData['items']);
    for (final item in items) {
      await updateProductStock(item['productId'], item['quantity']);
    }

    return id;
  }

  Future<List<Map<String, dynamic>>> getPendingOrders() async {
    if (_database == null) return [];

    return await _database!.query(
      'offline_orders',
      where: 'synced = ?',
      whereArgs: [0],
    );
  }
}
