import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Box,
  Chip,
  Card,
  CardContent,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { db } from '../firebase';
import { addItem, removeItem, updateQuantity, setCustomer, setPaymentMethod, clearCart } from '../store/slices/cartSlice';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const POS = () => {
  const dispatch = useDispatch();
  const { companyId, role } = useSelector((state) => state.auth);
  const cart = useSelector((state) => state.cart);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [customerDialog, setCustomerDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [companyId]);

  const loadProducts = async () => {
    try {
      const productsRef = collection(db, 'companies', companyId, 'products');
      const q = query(productsRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersRef = collection(db, 'companies', companyId, 'customers');
      const snapshot = await getDocs(customersRef);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleAddCustomer = async () => {
    try {
      const customersRef = collection(db, 'companies', companyId, 'customers');
      const docRef = await addDoc(customersRef, {
        ...newCustomer,
        createdAt: new Date(),
        totalPurchases: 0,
        lastPurchase: null
      });
      
      setCustomers([...customers, { id: docRef.id, ...newCustomer }]);
      setSelectedCustomer(docRef.id);
      dispatch(setCustomer({ id: docRef.id, ...newCustomer }));
      setCustomerDialog(false);
      setNewCustomer({ name: '', phone: '', email: '' });
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleAddToCart = (product) => {
    if (product.stock > 0) {
      dispatch(addItem({
        productId: product.id,
        name: product.name,
        price: product.salePrice,
        quantity: 1,
        stock: product.stock,
        unit: product.unit
      }));
    }
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      alert('السلة فارغة');
      return;
    }

    try {
      // توليد رقم الفاتورة
      const generateInvoice = httpsCallable(functions, 'generateInvoiceNumber');
      const result = await generateInvoice();
      const invoiceNumber = result.data.invoiceNumber;

      // إنشاء الطلب
      const ordersRef = collection(db, 'companies', companyId, 'orders');
      const orderData = {
        items: cart.items,
        customerId: cart.customer?.id,
        customerName: cart.customer?.name,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        total: cart.total,
        paymentMethod: cart.paymentMethod,
        paymentStatus: cart.paymentStatus,
        status: 'pending',
        createdAt: new Date(),
        invoiceNumber: invoiceNumber
      };

      const orderRef = await addDoc(ordersRef, orderData);

      // إذا كان الدفع نقدي وكامل، إنشاء الفاتورة مباشرة
      if (cart.paymentMethod === 'cash' && cart.paymentStatus === 'paid') {
        const invoiceRef = collection(db, 'companies', companyId, 'invoices');
        const invoiceData = {
          ...orderData,
          orderId: orderRef.id,
          invoiceNumber: invoiceNumber,
          status: 'completed'
        };

        await addDoc(invoiceRef, invoiceData);

        // تحديث المخزون
        const batch = [];
        cart.items.forEach(item => {
          const productRef = doc(db, 'companies', companyId, 'products', item.productId);
          batch.push(updateDoc(productRef, {
            stock: item.stock - item.quantity
          }));
        });

        await Promise.all(batch);
      }

      // تفريغ السلة
      dispatch(clearCart());
      setPaymentDialog(false);
      
      alert(`تم إنشاء الطلب بنجاح! رقم الفاتورة: ${invoiceNumber}`);
    } catch (error) {
      console.error('Error during checkout:', error);
      alert('حدث خطأ أثناء إنشاء الطلب');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.includes(searchTerm) ||
    product.barcode?.includes(searchTerm) ||
    product.code?.includes(searchTerm)
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* شريط البحث وإضافة العميل */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="ابحث عن منتج بالاسم أو الباركود"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setCustomerDialog(true)}
            >
              {cart.customer ? cart.customer.name : 'إضافة عميل'}
            </Button>
          </Paper>
        </Grid>

        {/* قائمة المنتجات */}
        <Grid item xs={8}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Grid container spacing={2}>
              {filteredProducts.map((product) => (
                <Grid item xs={3} key={product.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      opacity: product.stock > 0 ? 1 : 0.5,
                      '&:hover': { boxShadow: 6 }
                    }}
                    onClick={() => product.stock > 0 && handleAddToCart(product)}
                  >
                    <CardContent>
                      <Typography variant="h6" noWrap>
                        {product.name}
                      </Typography>
                      <Typography color="textSecondary">
                        {product.salePrice} ج.م
                      </Typography>
                      <Chip 
                        label={`المخزون: ${product.stock} ${product.unit}`}
                        size="small"
                        color={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'error'}
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* سلة المشتريات */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              سلة المشتريات
            </Typography>
            
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>المنتج</TableCell>
                    <TableCell align="center">الكمية</TableCell>
                    <TableCell align="right">السعر</TableCell>
                    <TableCell align="right">المجموع</TableCell>
                    <TableCell align="center"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => dispatch(updateQuantity({ 
                            productId: item.productId, 
                            quantity: item.quantity - 1 
                          }))}
                        >
                          <RemoveIcon />
                        </IconButton>
                        {item.quantity}
                        <IconButton 
                          size="small" 
                          onClick={() => dispatch(updateQuantity({ 
                            productId: item.productId, 
                            quantity: item.quantity + 1 
                          }))}
                          disabled={item.quantity >= item.stock}
                        >
                          <AddIcon />
                        </IconButton>
                      </TableCell>
                      <TableCell align="right">{item.price} ج.م</TableCell>
                      <TableCell align="right">{item.total} ج.م</TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => dispatch(removeItem(item.productId))}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* الإجماليات */}
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography>المجموع الفرعي:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography align="right">{cart.subtotal} ج.م</Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography>الضريبة (14%):</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography align="right">{cart.tax} ج.م</Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography>الخصم:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography align="right">{cart.discount} ج.م</Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="h6">الإجمالي:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6" align="right" color="primary">
                    {cart.total} ج.م
                  </Typography>
                </Grid>
              </Grid>
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<ReceiptIcon />}
                onClick={() => setPaymentDialog(true)}
                disabled={cart.items.length === 0}
                sx={{ mt: 2 }}
              >
                إتمام البيع ({cart.total} ج.م)
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* نافذة إضافة عميل */}
      <Dialog open={customerDialog} onClose={() => setCustomerDialog(false)}>
        <DialogTitle>إضافة عميل جديد</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="اسم العميل"
            fullWidth
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
          />
          <TextField
            margin="dense"
            label="رقم الهاتف"
            fullWidth
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
          />
          <TextField
            margin="dense"
            label="البريد الإلكتروني"
            fullWidth
            type="email"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialog(false)}>إلغاء</Button>
          <Button onClick={handleAddCustomer} variant="contained">حفظ</Button>
        </DialogActions>
      </Dialog>

      {/* نافذة الدفع */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)}>
        <DialogTitle>إتمام عملية الدفع</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="طريقة الدفع"
            value={cart.paymentMethod}
            onChange={(e) => dispatch(setPaymentMethod(e.target.value))}
            sx={{ mt: 2 }}
          >
            <MenuItem value="cash">نقدي</MenuItem>
            <MenuItem value="transfer">تحويل بنكي</MenuItem>
            <MenuItem value="credit">آجل</MenuItem>
          </TextField>
          
          <TextField
            select
            fullWidth
            label="حالة الدفع"
            value={cart.paymentStatus}
            onChange={(e) => dispatch({ type: 'cart/setPaymentStatus', payload: e.target.value })}
            sx={{ mt: 2 }}
          >
            <MenuItem value="paid">مدفوع</MenuItem>
            <MenuItem value="partial">مدفوع جزئي</MenuItem>
            <MenuItem value="pending">معلق</MenuItem>
          </TextField>
          
          {cart.paymentStatus === 'partial' && (
            <TextField
              fullWidth
              label="المبلغ المدفوع"
              type="number"
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>إلغاء</Button>
          <Button onClick={handleCheckout} variant="contained" color="primary">
            تأكيد الدفع
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default POS;
