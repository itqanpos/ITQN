import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sales_rep_app/providers/auth_provider.dart';
import 'package:sales_rep_app/providers/products_provider.dart';
import 'package:sales_rep_app/screens/products_screen.dart';
import 'package:sales_rep_app/screens/orders_screen.dart';
import 'package:sales_rep_app/screens/new_order_screen.dart';
import 'package:sales_rep_app/screens/sync_screen.dart';
import 'package:sales_rep_app/screens/commission_screen.dart';

class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  final List<Widget> _screens = [
    ProductsScreen(),
    OrdersScreen(),
    NewOrderScreen(),
    SyncScreen(),
    CommissionScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final productsProvider = Provider.of<ProductsProvider>(context, listen: false);
    
    if (authProvider.companyId != null) {
      productsProvider.setCompanyId(authProvider.companyId!);
      await productsProvider.syncProducts();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('مندوب المبيعات'),
        actions: [
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await authProvider.logout();
            },
          ),
        ],
      ),
      body: _screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        type: BottomNavigationBarType.fixed,
        items: [
          BottomNavigationBarItem(
            icon: Icon(Icons.inventory),
            label: 'المنتجات',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.list_alt),
            label: 'الطلبات',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.add_shopping_cart),
            label: 'طلب جديد',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.sync),
            label: 'المزامنة',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.attach_money),
            label: 'العمولات',
          ),
        ],
      ),
    );
  }
}
