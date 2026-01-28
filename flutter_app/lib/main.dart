import 'package:flutter/material.dart'
import 'package:firebase_core/firebase_core.dart'
import 'package:provider/provider.dart'

import 'src/app.dart'
import 'src/providers/auth_provider.dart'
import 'src/providers/company_provider.dart'

void main() async {
  WidgetsFlutterBinding.ensureInitialized()
  await Firebase.initializeApp()
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CompanyProvider()),
      ],
      child: MyApp(),
    ),
  )
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'مندوب المبيعات',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Cairo',
        primarySwatch: Colors.blue,
      ),
      home: App(),
    )
  }
}
