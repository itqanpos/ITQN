import { createSlice } from '@reduxjs/toolkit';
import { auth, db } from '../../firebase';
import { 
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const initialState = {
  user: null,
  companyId: null,
  role: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.companyId = action.payload.companyId;
      state.role = action.payload.role;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    logout: (state) => {
      state.user = null;
      state.companyId = null;
      state.role = null;
      state.error = null;
    },
  },
});

export const { setUser, setLoading, setError, logout } = authSlice.actions;

export const login = (email, password) => async (dispatch) => {
  try {
    dispatch(setLoading(true));
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // الحصول على الـ custom claims
    const idTokenResult = await user.getIdTokenResult();
    const companyId = idTokenResult.claims.companyId;
    const role = idTokenResult.claims.role;
    
    dispatch(setUser({ user, companyId, role }));
    return { success: true };
  } catch (error) {
    dispatch(setError(error.message));
    return { success: false, error: error.message };
  }
};

export const register = (email, password, displayName) => async (dispatch) => {
  try {
    dispatch(setLoading(true));
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // تحديث الاسم
    await updateProfile(user, { displayName });
    
    // الانتظار حتى يتم إنشاء الشركة عبر Cloud Function
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // إعادة تسجيل الدخول للحصول على الـ custom claims
    await signOut(auth);
    return await dispatch(login(email, password));
  } catch (error) {
    dispatch(setError(error.message));
    return { success: false, error: error.message };
  }
};

export const checkAuth = () => async (dispatch) => {
  try {
    dispatch(setLoading(true));
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        const companyId = idTokenResult.claims.companyId;
        const role = idTokenResult.claims.role;
        
        dispatch(setUser({ user, companyId, role }));
      } else {
        dispatch(logout());
      }
      dispatch(setLoading(false));
    });
  } catch (error) {
    dispatch(setError(error.message));
  }
};

export default authSlice.reducer;
