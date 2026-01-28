class PendingOrder {
  String id
  String companyId
  String userId
  String userName
  String customerId
  String customerName
  String customerPhone
  List<OrderItem> items
  double subtotal
  double discount
  double tax
  double total
  String paymentMethod
  String status
  String notes
  DateTime createdAt
  
  PendingOrder({
    required this.id,
    required this.companyId,
    required this.userId,
    required this.userName,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.items,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
    required this.paymentMethod,
    required this.status,
    required this.notes,
    required this.createdAt,
  })
  
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'companyId': companyId,
      'userId': userId,
      'userName': userName,
      'customerId': customerId,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'items': items.map((item) => item.toMap()).toList(),
      'subtotal': subtotal,
      'discount': discount,
      'tax': tax,
      'total': total,
      'paymentMethod': paymentMethod,
      'status': status,
      'notes': notes,
      'createdAt': createdAt.toIso8601String(),
    }
  }
  
  factory PendingOrder.fromMap(Map<String, dynamic> map) {
    return PendingOrder(
      id: map['id'],
      companyId: map['companyId'],
      userId: map['userId'],
      userName: map['userName'],
      customerId: map['customerId'],
      customerName: map['customerName'],
      customerPhone: map['customerPhone'],
      items: List<OrderItem>.from(
        (map['items'] as List).map((item) => OrderItem.fromMap(item))
      ),
      subtotal: map['subtotal'].toDouble(),
      discount: map['discount'].toDouble(),
      tax: map['tax'].toDouble(),
      total: map['total'].toDouble(),
      paymentMethod: map['paymentMethod'],
      status: map['status'],
      notes: map['notes'],
      createdAt: DateTime.parse(map['createdAt']),
    )
  }
}

class OrderItem {
  String productId
  String productName
  double quantity
  double unitPrice
  double subtotal
  
  OrderItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
  })
  
  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productName': productName,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'subtotal': subtotal,
    }
  }
  
  factory OrderItem.fromMap(Map<String, dynamic> map) {
    return OrderItem(
      productId: map['productId'],
      productName: map['productName'],
      quantity: map['quantity'].toDouble(),
      unitPrice: map['unitPrice'].toDouble(),
      subtotal: map['subtotal'].toDouble(),
    )
  }
}
