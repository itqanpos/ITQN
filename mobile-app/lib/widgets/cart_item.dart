import 'package:flutter/material.dart';

class CartItem extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onRemove;
  final Function(int) onQuantityChanged;

  CartItem({
    required this.item,
    required this.onRemove,
    required this.onQuantityChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: ListTile(
        leading: CircleAvatar(
          child: Text(
            item['quantity'].toString(),
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(item['name']),
        subtitle: Text('${item['price']} ج.م × ${item['quantity']} = ${item['total']} ج.م'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: Icon(Icons.remove, size: 20),
              onPressed: () {
                final newQuantity = item['quantity'] - 1;
                if (newQuantity > 0) {
                  onQuantityChanged(newQuantity);
                }
              },
            ),
            SizedBox(width: 4),
            IconButton(
              icon: Icon(Icons.add, size: 20),
              onPressed: () {
                onQuantityChanged(item['quantity'] + 1);
              },
            ),
            SizedBox(width: 8),
            IconButton(
              icon: Icon(Icons.delete, color: Colors.red),
              onPressed: onRemove,
            ),
          ],
        ),
      ),
    );
  }
}
