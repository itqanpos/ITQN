import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sales_rep_app/providers/products_provider.dart';
import 'package:sales_rep_app/models/product.dart';
import 'package:sales_rep_app/widgets/cart_item.dart';

class NewOrderScreen extends StatefulWidget {
  @override
  _NewOrderScreenState createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _customerNameController = TextEditingController();
  final TextEditingController _customerPhoneController = TextEditingController();
  List<Product> _filteredProducts = [];
  List<Map<String, dynamic>> _cartItems = [];
  double _subtotal = 0;
  double _tax = 0;
  double _total = 0;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    final query = _searchController.text;
    if (query.isEmpty) {
      setState(() => _filteredProducts = []);
      return;
    }

    Provider.of<ProductsProvider>(context, listen: false)
        .searchProducts(query)
        .then((products) {
      setState(() => _filteredProducts = products);
    });
  }

  void _addToCart(Product product) {
    final existingItem = _cartItems.firstWhere(
      (item) => item['productId'] == product.id,
      orElse: () => {},
    );

    if (existingItem.isNotEmpty) {
      existingItem['quantity'] += 1;
      existingItem['total'] = existingItem['quantity'] * product.salePrice;
    } else {
      _cartItems.add({
        'productId': product.id,
        'name': product.name,
        'price': product.salePrice,
        'quantity': 1,
        'total': product.salePrice,
        'unit': product.unit,
      });
    }

    _calculateTotals();
    setState(() {});
  }

  void _removeFromCart(int index) {
    _cartItems.removeAt(index);
    _calculateTotals();
    setState(() {});
  }

  void _updateQuantity(int index, int quantity) {
    if (quantity > 0) {
      _cartItems[index]['quantity'] = quantity;
      _cartItems[index]['total'] = quantity * _cartItems[index]['price'];
      _calculateTotals();
      setState(() {});
    }
  }

  void _calculateTotals() {
    _subtotal = _cartItems.fold(0, (sum, item) => sum + item['total']);
    _tax = _subtotal * 0.14; // 14% ضريبة
    _total = _subtotal + _tax;
  }

  Future<void> _createOrder() async {
    if (_customerNameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('يرجى إدخال اسم العميل')),
      );
      return;
    }

    if (_cartItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('السلة فارغة')),
      );
      return;
    }

    final orderData = {
      'customerName': _customerNameController.text,
      'customerPhone': _customerPhoneController.text,
      'items': _cartItems,
      'subtotal': _subtotal,
      'tax': _tax,
      'total': _total,
    };

    try {
      final productsProvider = Provider.of<ProductsProvider>(context, listen: false);
      final orderId = await productsProvider.createOfflineOrder(orderData);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('تم حفظ الطلب رقم #$orderId')),
      );

      // تفريغ النموذج
      _cartItems.clear();
      _customerNameController.clear();
      _customerPhoneController.clear();
      _calculateTotals();
      setState(() {});
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('حدث خطأ: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // شريط البحث
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'ابحث عن منتج...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),

          // بيانات العميل
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  children: [
                    TextField(
                      controller: _customerNameController,
                      decoration: InputDecoration(
                        labelText: 'اسم العميل',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    SizedBox(height: 8),
                    TextField(
                      controller: _customerPhoneController,
                      decoration: InputDecoration(
                        labelText: 'رقم الهاتف',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                  ],
                ),
              ),
            ),
          ),

          Expanded(
            child: Row(
              children: [
                // قائمة المنتجات
                Expanded(
                  flex: 2,
                  child: _filteredProducts.isEmpty
                      ? Center(child: Text('اكتب للبحث عن منتجات'))
                      : ListView.builder(
                          itemCount: _filteredProducts.length,
                          itemBuilder: (context, index) {
                            final product = _filteredProducts[index];
                            return ListTile(
                              title: Text(product.name),
                              subtitle: Text('${product.salePrice} ج.م - ${product.stock} ${product.unit}'),
                              trailing: IconButton(
                                icon: Icon(Icons.add),
                                onPressed: () => _addToCart(product),
                              ),
                            );
                          },
                        ),
                ),

                // السلة
                Expanded(
                  flex: 3,
                  child: Card(
                    margin: EdgeInsets.all(8),
                    child: Column(
                      children: [
                        Expanded(
                          child: _cartItems.isEmpty
                              ? Center(child: Text('السلة فارغة'))
                              : ListView.builder(
                                  itemCount: _cartItems.length,
                                  itemBuilder: (context, index) {
                                    final item = _cartItems[index];
                                    return CartItem(
                                      item: item,
                                      onRemove: () => _removeFromCart(index),
                                      onQuantityChanged: (quantity) =>
                                          _updateQuantity(index, quantity),
                                    );
                                  },
                                ),
                        ),
                        Divider(),
                        Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('المجموع الفرعي:'),
                                  Text('${_subtotal.toStringAsFixed(2)} ج.م'),
                                ],
                              ),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('الضريبة (14%):'),
                                  Text('${_tax.toStringAsFixed(2)} ج.م'),
                                ],
                              ),
                              Divider(),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'الإجمالي:',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    '${_total.toStringAsFixed(2)} ج.م',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green,
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: _createOrder,
                                icon: Icon(Icons.check),
                                label: Text('إنشاء الطلب'),
                                style: ElevatedButton.styleFrom(
                                  minimumSize: Size(double.infinity, 50),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    super.dispose();
  }
}
