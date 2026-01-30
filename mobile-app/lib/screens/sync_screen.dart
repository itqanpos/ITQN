import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sales_rep_app/providers/products_provider.dart';

class SyncScreen extends StatefulWidget {
  @override
  _SyncScreenState createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  bool _isSyncing = false;
  String _syncStatus = '';

  Future<void> _syncAllData() async {
    setState(() {
      _isSyncing = true;
      _syncStatus = 'جاري مزامنة المنتجات...';
    });

    final productsProvider = Provider.of<ProductsProvider>(context, listen: false);

    try {
      // مزامنة المنتجات
      await productsProvider.syncProducts();
      
      setState(() => _syncStatus = 'جاري مزامنة الطلبات...');
      
      // مزامنة الطلبات
      await productsProvider.syncOrders();
      
      setState(() {
        _syncStatus = 'تمت المزامنة بنجاح!';
        _isSyncing = false;
      });
      
      // إخفاء الرسالة بعد 3 ثواني
      Future.delayed(Duration(seconds: 3), () {
        if (mounted) {
          setState(() => _syncStatus = '');
        }
      });
    } catch (e) {
      setState(() {
        _syncStatus = 'خطأ في المزامنة: $e';
        _isSyncing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.sync,
              size: 100,
              color: _isSyncing ? Colors.blue : Colors.grey,
            ),
            SizedBox(height: 20),
            if (_syncStatus.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Text(
                  _syncStatus,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18),
                ),
              ),
            SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _isSyncing ? null : _syncAllData,
              icon: Icon(Icons.sync),
              label: Text(_isSyncing ? 'جاري المزامنة...' : 'مزامنة البيانات'),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 30, vertical: 15),
              ),
            ),
            SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => PendingOrdersScreen(),
                  ),
                );
              },
              icon: Icon(Icons.list),
              label: Text('عرض الطلبات المعلقة'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PendingOrdersScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final productsProvider = Provider.of<ProductsProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('الطلبات المعلقة'),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: productsProvider.getPendingOrders(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }
          
          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(child: Text('لا توجد طلبات معلقة'));
          }
          
          final orders = snapshot.data!;
          
          return ListView.builder(
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              return Card(
                margin: EdgeInsets.all(8),
                child: ListTile(
                  title: Text(order['customerName'] ?? ''),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('الهاتف: ${order['customerPhone'] ?? ''}'),
                      Text('الإجمالي: ${order['total']} ج.م'),
                      Text('الحالة: غير مزامن'),
                    ],
                  ),
                  trailing: Icon(Icons.sync_disabled, color: Colors.orange),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
