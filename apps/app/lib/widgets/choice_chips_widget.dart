import 'package:flutter/material.dart';
import '../models/ui_command.dart';
import 'common.dart';

/// 模式 A: 枚举型反问 (需求书 2.2)。无脑点击, 历史轮置灰。
class ChoiceChipsWidget extends StatelessWidget {
  final ChoiceChipsCommand command;
  final bool active;
  final void Function(String slot, String value, [String? label]) onSelect;
  const ChoiceChipsWidget({
    super.key,
    required this.command,
    required this.active,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return AiBubble(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(command.content,
              style: const TextStyle(fontSize: 15, height: 1.5, color: kInk)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: command.options.map((o) {
              return Opacity(
                opacity: active ? 1 : 0.4,
                child: InkWell(
                  onTap: active
                      ? () => onSelect(command.targetSlot, o.value, o.label)
                      : null,
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(o.label,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF2563EB))),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
