import 'package:flutter/material.dart';

const kBlue = Color(0xFF3B82F6);
const kInk = Color(0xFF1F2937);
const kMuted = Color(0xFF6B7280);

/// AI 侧气泡容器 (白底, 左上角直角)
class AiBubble extends StatelessWidget {
  final Widget child;
  const AiBubble({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(4),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8),
          ],
        ),
        child: child,
      ),
    );
  }
}
