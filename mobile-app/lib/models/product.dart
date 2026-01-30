class Product {
  final String id;
  final String name;
  final String code;
  final String? barcode;
  final double purchasePrice;
  final double salePrice;
  final double stock;
  final String unit;
  final String category;
  final int lastUpdated;

  Product({
    required this.id,
    required this.name,
    required this.code,
    this.barcode,
    required this.purchasePrice,
    required this.salePrice,
    required this.stock,
    required this.unit,
    required this.category,
    required this.lastUpdated,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'barcode': barcode,
      'purchasePrice': purchasePrice,
      'salePrice': salePrice,
      'stock': stock,
      'unit': unit,
      'category': category,
      'lastUpdated': lastUpdated,
    };
  }

  factory Product.fromMap(Map<String, dynamic> map) {
    return Product(
      id: map['id'],
      name: map['name'],
      code: map['code'],
      barcode: map['barcode'],
      purchasePrice: map['purchasePrice']?.toDouble() ?? 0.0,
      salePrice: map['salePrice']?.toDouble() ?? 0.0,
      stock: map['stock']?.toDouble() ?? 0.0,
      unit: map['unit'],
      category: map['category'],
      lastUpdated: map['lastUpdated']?.toInt() ?? 0,
    );
  }
}
