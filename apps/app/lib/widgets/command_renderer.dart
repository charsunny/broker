import 'package:flutter/material.dart';
import '../models/ui_command.dart';
import 'text_bubble.dart';
import 'choice_chips_widget.dart';
import 'native_input_widget.dart';
import 'commission_card_widget.dart';
import 'comparison_card_widget.dart';

/// Server-Driven UI 多态分发 (需求书 6.1)。按 sealed UiCommand 子类型穷尽路由,
/// UnknownCommand 走降级气泡, 绝不白屏。
class CommandRenderer extends StatelessWidget {
  final UiCommand command;
  final bool active;
  final void Function(String slot, String value, [String? label]) onSlot;
  final void Function(String slot) onEditTag;
  final void Function(String traceId) onFeedback;

  const CommandRenderer({
    super.key,
    required this.command,
    required this.active,
    required this.onSlot,
    required this.onEditTag,
    required this.onFeedback,
  });

  @override
  Widget build(BuildContext context) {
    return switch (command) {
      TextCommand c => TextBubble(content: c.content),
      ChoiceChipsCommand c =>
        ChoiceChipsWidget(command: c, active: active, onSelect: onSlot),
      NativeInputCommand c =>
        NativeInputWidget(command: c, active: active, onSubmit: onSlot),
      CommissionCardCommand c => CommissionCardWidget(
          command: c,
          active: active,
          onEditTag: onEditTag,
          onFeedback: onFeedback,
        ),
      ComparisonCardCommand c => ComparisonCardWidget(command: c),
      UnknownCommand() => const FallbackBubble(),
    };
  }
}
