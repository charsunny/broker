import 'package:flutter/material.dart';
import '../models/ui_command.dart';
import 'common.dart';

/// 结构化佣金账单卡片, 5 个逻辑分区 (需求书 2.3)。
class CommissionCardWidget extends StatefulWidget {
  final CommissionCardCommand command;
  final bool active;
  final void Function(String slot) onEditTag;
  final void Function(String traceId) onFeedback;
  const CommissionCardWidget({
    super.key,
    required this.command,
    required this.active,
    required this.onEditTag,
    required this.onFeedback,
  });

  @override
  State<CommissionCardWidget> createState() => _CommissionCardWidgetState();
}

class _CommissionCardWidgetState extends State<CommissionCardWidget> {
  bool open = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.command;
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
            // 1. 头部
            Text(c.header,
                style: const TextStyle(
                    fontSize: 13, color: kMuted, fontWeight: FontWeight.w500)),
            const SizedBox(height: 12),
            // 2. 上下文微调区
            Wrap(spacing: 8, runSpacing: 8, children: c.contextTags.map(_tag).toList()),
            const SizedBox(height: 12),
            const Divider(height: 1),
            // 3. 核心数字区
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Center(
                child: Text(c.heroNumber,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827))),
              ),
            ),
            const Divider(height: 1),
            // 4. 折叠明细表
            InkWell(
              onTap: () => setState(() => open = !open),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Center(
                  child: Text(open ? '▲ 收起各保单年度明细' : '▼ 展开各保单年度明细',
                      style: const TextStyle(fontSize: 13, color: kBlue)),
                ),
              ),
            ),
            if (open) _accordion(c),
            // 5. 风险横幅
            if (c.riskBanner != null) _banner(c.riskBanner!),
            // 反馈纠错 (HITL)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => widget.onFeedback(c.traceId),
                child: const Text('🚩 报错 / 踩',
                    style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tag(ContextTag t) {
    final editable = t.editable && widget.active;
    return InkWell(
      onTap: editable ? () => widget.onEditTag(t.slotKey) : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: editable ? const Color(0xFFFEF3C7) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text('${t.label}${t.editable ? " ✎" : ""}',
            style: TextStyle(
                fontSize: 12,
                color: editable
                    ? const Color(0xFF92400E)
                    : const Color(0xFF374151))),
      ),
    );
  }

  Widget _cell(String s, {bool head = false, bool strong = false}) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(s,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  color: head ? const Color(0xFF9CA3AF) : const Color(0xFF374151),
                  fontWeight:
                      (head || strong) ? FontWeight.w700 : FontWeight.w400)),
        ),
      );

  Widget _accordion(CommissionCardCommand c) {
    return Column(
      children: [
        Row(children: [
          _cell('年度', head: true),
          _cell('基础', head: true),
          _cell('津贴', head: true),
          _cell('合计', head: true),
        ]),
        ...c.accordionData.map((r) => Row(children: [
              _cell(r.year),
              _cell(r.basic),
              _cell(r.allowance),
              _cell(r.total, strong: true),
            ])),
      ],
    );
  }

  Widget _banner(RiskBanner b) {
    const palette = {
      'info': [Color(0xFFEFF6FF), Color(0xFF1E40AF)],
      'warning': [Color(0xFFFFF7ED), Color(0xFF9A3412)],
      'danger': [Color(0xFFFEF2F2), Color(0xFFB91C1C)],
    };
    final pair = palette[b.level] ?? palette['info']!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: pair[0],
        borderRadius: BorderRadius.circular(12),
        border: b.level == 'danger'
            ? Border.all(color: const Color(0xFFFCA5A5))
            : null,
      ),
      child: Text(b.text,
          style: TextStyle(fontSize: 12.5, height: 1.5, color: pair[1])),
    );
  }
}
