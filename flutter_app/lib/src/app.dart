import 'package:flutter/material.dart'
import 'package:provider/provider.dart'

import 'providers/auth_provider.dart'
import 'pages/auth/login_page.dart'
import 'pages/home/home_page.dart'

class App extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context)
    
    if (authProvider.isLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      )
    }
    
    return authProvider.isAuthenticated ? HomePage() : LoginPage()
  }
}
