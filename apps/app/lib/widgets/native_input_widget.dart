import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/ui_command.dart';
import 'common.dart';

/// 模式 B: 连续/数值型反问 (需求书 2.2)。number 唤起数字键盘。
class NativeInputWidget extends StatefulWidget {
  final NativeInputCommand command;
  final bool active;
  final void Function(String slot, String value, [String? label]) onSubmit;
  const NativeInputWidget({
    super.key,
    required this.command,
    required this.active,
    required this.onSubmit,
  });

  @override
  State<NativeInputWidget> createState() => _NativeInputWidgetState();
}

class _NativeInputWidgetState extends State<NativeInputWidget> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final v = _ctrl.text.trim();
    if (v.isEmpty) return;
    widget.onSubmit(widget.command.targetSlot, v);
  }

  @override
  Widget build(BuildContext context) {
    final isNumber = widget.command.inputType == 'number';
    return AiBubble(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.command.content,
              style: const TextStyle(fontSize: 15, height: 1.5, color: kInk)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  enabled: widget.active,
                  keyboardType:
                      isNumber ? TextInputType.number : TextInputType.text,
                  inputFormatters: isNumber
                      ? [FilteringTextInputFormatter.digitsOnly]
                      : null,
                  decoration: InputDecoration(
                    hintText: widget.command.placeholder ?? '',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  onSubmitted: (_) => _submit(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: widget.active ? _submit : null,
                child: const Text('发送'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
