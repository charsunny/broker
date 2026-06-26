import 'package:flutter/material.dart';
import 'screens/chat_screen.dart';

void main() => runApp(const BrokerApp());

class BrokerApp extends StatelessWidget {
  const BrokerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '佣金测算',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF3B82F6),
        scaffoldBackgroundColor: const Color(0xFFF4F5F7),
        useMaterial3: true,
      ),
      home: const ChatScreen(),
    );
  }
}
