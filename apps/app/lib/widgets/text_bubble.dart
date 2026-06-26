import 'package:flutter/material.dart';
import 'common.dart';

class TextBubble extends StatelessWidget {
  final String content;
  const TextBubble({super.key, required this.content});

  @override
  Widget build(BuildContext context) {
    return AiBubble(
      child: Text(
        content,
        style: const TextStyle(fontSize: 15, height: 1.5, color: kInk),
      ),
    );
  }
}

class FallbackBubble extends StatelessWidget {
  const FallbackBubble({super.key});
  @override
  Widget build(BuildContext context) {
    // 未知指令降级 (需求书 6.1): 绝不白屏
    return const AiBubble(
      child: Text(
        '系统正在升级该功能，请稍后再试',
        style: TextStyle(fontSize: 15, height: 1.5, color: kInk),
      ),
    );
  }
}
