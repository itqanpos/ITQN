import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _companyId;
  String? _role;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  String? get companyId => _companyId;
  String? get role => _role;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;

  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    FirebaseAuth.instance.authStateChanges().listen((User? user) async {
      _user = user;
      if (user != null) {
        await _loadUserData(user);
      }
      _isLoading = false;
      notifyListeners();
    });

    // Check cached auth
    final prefs = await SharedPreferences.getInstance();
    final cachedUid = prefs.getString('uid');
    if (cachedUid != null && _user == null) {
      await FirebaseAuth.instance.signInAnonymously();
    }
  }

  Future<void> _loadUserData(User user) async {
    try {
      final idToken = await user.getIdTokenResult();
      _companyId = idToken.claims?['companyId'];
      _role = idToken.claims?['role'];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('uid', user.uid);
    } catch (e) {
      _error = e.toString();
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final userCredential = await FirebaseAuth.instance
          .signInWithEmailAndPassword(email: email, password: password);

      await _loadUserData(userCredential.user!);

      return {'success': true};
    } on FirebaseAuthException catch (e) {
      _error = _getAuthErrorMessage(e.code);
      return {'success': false, 'error': _error};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await FirebaseAuth.instance.signOut();
    _user = null;
    _companyId = null;
    _role = null;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('uid');
    
    notifyListeners();
  }

  String _getAuthErrorMessage(String code) {
    switch (code) {
      case 'user-not-found':
        return 'المستخدم غير موجود';
      case 'wrong-password':
        return 'كلمة المرور غير صحيحة';
      case 'too-many-requests':
        return 'تم تجاوز عدد المحاولات المسموح بها';
      default:
        return 'حدث خطأ أثناء تسجيل الدخول';
    }
  }
}
