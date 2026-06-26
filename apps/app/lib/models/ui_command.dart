import 'package:flutter/foundation.dart';

/// UI 渲染指令 (镜像后端 @insurance/contracts 的 UIRenderCommand 判别联合)。
///
/// 后端 Zod 契约是线上协议的单一事实源; 本文件是 Dart 侧的等价镜像。
/// 解析未知 type 时降级为 [UnknownCommand], 前端绝不白屏 (需求书 6.1)。
@immutable
sealed class UiCommand {
  const UiCommand();

  factory UiCommand.fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'text':
        return TextCommand.fromJson(json);
      case 'choice_chips':
        return ChoiceChipsCommand.fromJson(json);
      case 'native_input':
        return NativeInputCommand.fromJson(json);
      case 'commission_card':
        return CommissionCardCommand.fromJson(json);
      case 'comparison_card':
        return ComparisonCardCommand.fromJson(json);
      default:
        return const UnknownCommand();
    }
  }
}

class UnknownCommand extends UiCommand {
  const UnknownCommand();
}

class TextCommand extends UiCommand {
  final String content;
  const TextCommand(this.content);
  factory TextCommand.fromJson(Map<String, dynamic> j) =>
      TextCommand(j['content'] as String? ?? '');
}

class OptionItem {
  final String label;
  final String value;
  const OptionItem(this.label, this.value);
  factory OptionItem.fromJson(Map<String, dynamic> j) =>
      OptionItem(j['label'] as String? ?? '', j['value'] as String? ?? '');
}

class ChoiceChipsCommand extends UiCommand {
  final String content;
  final List<OptionItem> options;
  final String targetSlot;
  const ChoiceChipsCommand({
    required this.content,
    required this.options,
    required this.targetSlot,
  });
  factory ChoiceChipsCommand.fromJson(Map<String, dynamic> j) =>
      ChoiceChipsCommand(
        content: j['content'] as String? ?? '',
        options: ((j['options'] as List?) ?? const [])
            .map((e) => OptionItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        targetSlot: j['targetSlot'] as String? ?? '',
      );
}

class NativeInputCommand extends UiCommand {
  final String content;
  final String inputType; // 'text' | 'number'
  final String? placeholder;
  final String targetSlot;
  const NativeInputCommand({
    required this.content,
    required this.inputType,
    required this.placeholder,
    required this.targetSlot,
  });
  factory NativeInputCommand.fromJson(Map<String, dynamic> j) =>
      NativeInputCommand(
        content: j['content'] as String? ?? '',
        inputType: j['inputType'] as String? ?? 'text',
        placeholder: j['placeholder'] as String?,
        targetSlot: j['targetSlot'] as String? ?? '',
      );
}

class ContextTag {
  final String label;
  final String slotKey;
  final String value;
  final bool editable;
  const ContextTag({
    required this.label,
    required this.slotKey,
    required this.value,
    required this.editable,
  });
  factory ContextTag.fromJson(Map<String, dynamic> j) => ContextTag(
        label: j['label'] as String? ?? '',
        slotKey: j['slotKey'] as String? ?? '',
        value: j['value'] as String? ?? '',
        editable: j['editable'] as bool? ?? true,
      );
}

class RiskBanner {
  final String level; // 'info' | 'warning' | 'danger'
  final String text;
  const RiskBanner(this.level, this.text);
  static RiskBanner? fromJson(Map<String, dynamic>? j) => j == null
      ? null
      : RiskBanner(j['level'] as String? ?? 'info', j['text'] as String? ?? '');
}

class AccordionRow {
  final String year;
  final String basic;
  final String allowance;
  final String total;
  final String? tooltip;
  const AccordionRow({
    required this.year,
    required this.basic,
    required this.allowance,
    required this.total,
    required this.tooltip,
  });
  factory AccordionRow.fromJson(Map<String, dynamic> j) => AccordionRow(
        year: j['year'] as String? ?? '',
        basic: j['basic'] as String? ?? '',
        allowance: j['allowance'] as String? ?? '',
        total: j['total'] as String? ?? '',
        tooltip: j['tooltip'] as String?,
      );
}

class CommissionCardCommand extends UiCommand {
  final String traceId;
  final String header;
  final String heroNumber;
  final List<ContextTag> contextTags;
  final List<AccordionRow> accordionData;
  final RiskBanner? riskBanner;
  const CommissionCardCommand({
    required this.traceId,
    required this.header,
    required this.heroNumber,
    required this.contextTags,
    required this.accordionData,
    required this.riskBanner,
  });
  factory CommissionCardCommand.fromJson(Map<String, dynamic> j) =>
      CommissionCardCommand(
        traceId: j['traceId'] as String? ?? '',
        header: j['header'] as String? ?? '',
        heroNumber: j['heroNumber'] as String? ?? '',
        contextTags: ((j['contextTags'] as List?) ?? const [])
            .map((e) => ContextTag.fromJson(e as Map<String, dynamic>))
            .toList(),
        accordionData: ((j['accordionData'] as List?) ?? const [])
            .map((e) => AccordionRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        riskBanner: RiskBanner.fromJson(j['riskBanner'] as Map<String, dynamic>?),
      );
}

class ComparisonRow {
  final String metricName;
  final String productAValue;
  final String productBValue;
  final String highlight; // 'A' | 'B' | 'None'
  const ComparisonRow({
    required this.metricName,
    required this.productAValue,
    required this.productBValue,
    required this.highlight,
  });
  factory ComparisonRow.fromJson(Map<String, dynamic> j) => ComparisonRow(
        metricName: j['metricName'] as String? ?? '',
        productAValue: j['productAValue'] as String? ?? '',
        productBValue: j['productBValue'] as String? ?? '',
        highlight: j['highlight'] as String? ?? 'None',
      );
}

class ComparisonCardCommand extends UiCommand {
  final String traceId;
  final String header;
  final List<ContextTag> contextTags;
  final List<ComparisonRow> comparisonData;
  final RiskBanner? riskBanner;
  const ComparisonCardCommand({
    required this.traceId,
    required this.header,
    required this.contextTags,
    required this.comparisonData,
    required this.riskBanner,
  });
  factory ComparisonCardCommand.fromJson(Map<String, dynamic> j) =>
      ComparisonCardCommand(
        traceId: j['traceId'] as String? ?? '',
        header: j['header'] as String? ?? '',
        contextTags: ((j['contextTags'] as List?) ?? const [])
            .map((e) => ContextTag.fromJson(e as Map<String, dynamic>))
            .toList(),
        comparisonData: ((j['comparisonData'] as List?) ?? const [])
            .map((e) => ComparisonRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        riskBanner: RiskBanner.fromJson(j['riskBanner'] as Map<String, dynamic>?),
      );
}
