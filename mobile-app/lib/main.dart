import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:sales_rep_app/providers/auth_provider.dart';
import 'package:sales_rep_app/providers/products_provider.dart';
import 'package:sales_rep_app/providers/orders_provider.dart';
import 'package:sales_rep_app/screens/login_screen.dart';
import 'package:sales_rep_app/screens/home_screen.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ProductsProvider()),
        ChangeNotifierProvider(create: (_) => OrdersProvider()),
      ],
      child: MaterialApp(
        title: 'مندوب المبيعات',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primaryColor: Color(0xFF1976D2),
          fontFamily: 'Cairo',
          appBarTheme: AppBarTheme(
            backgroundColor: Color(0xFF1976D2),
            elevation: 0,
          ),
        ),
        localizationsDelegates: [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: [
          Locale('ar', 'AE'),
        ],
        locale: Locale('ar', 'AE'),
        home: Consumer<AuthProvider>(
          builder: (context, authProvider, _) {
            if (authProvider.isLoading) {
              return Scaffold(
                body: Center(
                  child: CircularProgressIndicator(),
                ),
              );
            }
            return authProvider.isAuthenticated ? HomeScreen() : LoginScreen();
          },
        ),
      ),
    );
  }
}
