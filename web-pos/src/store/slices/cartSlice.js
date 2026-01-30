import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  customer: null,
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  subtotal: 0,
  tax: 0,
  total: 0,
  discount: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      const existingItem = state.items.find(item => item.productId === action.payload.productId);
      
      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
        existingItem.total = existingItem.price * existingItem.quantity;
      } else {
        state.items.push({
          ...action.payload,
          total: action.payload.price * action.payload.quantity
        });
      }
      
      state.subtotal = state.items.reduce((sum, item) => sum + item.total, 0);
      state.tax = state.subtotal * 0.14; // 14% ضريبة
      state.total = state.subtotal + state.tax - state.discount;
    },
    
    removeItem: (state, action) => {
      state.items = state.items.filter(item => item.productId !== action.payload);
      state.subtotal = state.items.reduce((sum, item) => sum + item.total, 0);
      state.tax = state.subtotal * 0.14;
      state.total = state.subtotal + state.tax - state.discount;
    },
    
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find(item => item.productId === productId);
      
      if (item) {
        item.quantity = quantity;
        item.total = item.price * quantity;
        
        state.subtotal = state.items.reduce((sum, item) => sum + item.total, 0);
        state.tax = state.subtotal * 0.14;
        state.total = state.subtotal + state.tax - state.discount;
      }
    },
    
    setCustomer: (state, action) => {
      state.customer = action.payload;
    },
    
    setPaymentMethod: (state, action) => {
      state.paymentMethod = action.payload;
    },
    
    setDiscount: (state, action) => {
      state.discount = action.payload;
      state.total = state.subtotal + state.tax - state.discount;
    },
    
    clearCart: (state) => {
      state.items = [];
      state.customer = null;
      state.subtotal = 0;
      state.tax = 0;
      state.total = 0;
      state.discount = 0;
      state.paymentMethod = 'cash';
      state.paymentStatus = 'pending';
    },
  },
});

export const {
  addItem,
  removeItem,
  updateQuantity,
  setCustomer,
  setPaymentMethod,
  setDiscount,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
