import 'package:flutter/material.dart';
import '../models/ui_command.dart';
import 'common.dart';

/// 双产品横向对比卡片 (需求书 6.1)
class ComparisonCardWidget extends StatelessWidget {
  final ComparisonCardCommand command;
  const ComparisonCardWidget({super.key, required this.command});

  @override
  Widget build(BuildContext context) {
    final c = command;
    Widget cell(String s, {bool head = false, bool strong = false}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(s,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13,
                    color: head ? const Color(0xFF9CA3AF) : kInk,
                    fontWeight: (head || strong)
                        ? FontWeight.w700
                        : FontWeight.w400)),
          ),
        );

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 380),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 16),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(c.header,
                style: const TextStyle(
                    fontSize: 13, color: kMuted, fontWeight: FontWeight.w500)),
            const SizedBox(height: 12),
            Row(children: [cell('指标', head: true), cell('A', head: true), cell('B', head: true)]),
            ...c.comparisonData.map((r) => Row(children: [
                  cell(r.metricName),
                  cell(r.productAValue, strong: r.highlight == 'A'),
                  cell(r.productBValue, strong: r.highlight == 'B'),
                ])),
          ],
        ),
      ),
    );
  }
}
