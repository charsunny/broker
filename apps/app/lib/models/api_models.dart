import 'ui_command.dart';

/// 标准响应外壳 (需求书 6.3)。data 是指令数组, 支持 "一句话 + 一张卡片" 组合。
class ApiEnvelope {
  final int code;
  final String msg;
  final String threadId;
  final List<UiCommand> data;
  const ApiEnvelope({
    required this.code,
    required this.msg,
    required this.threadId,
    required this.data,
  });
  factory ApiEnvelope.fromJson(Map<String, dynamic> j) => ApiEnvelope(
        code: j['code'] as int? ?? 0,
        msg: j['msg'] as String? ?? '',
        threadId: j['threadId'] as String? ?? '',
        data: ((j['data'] as List?) ?? const [])
            .map((e) => UiCommand.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// 上行请求 (需求书 6.2)。messageType: text | slot_update | feedback | reset。
class BrokerRequest {
  final String? threadId;
  final String messageType;
  final String? content;
  final String? targetSlot;
  final String? slotValue;
  final String? traceId;
  const BrokerRequest({
    this.threadId,
    required this.messageType,
    this.content,
    this.targetSlot,
    this.slotValue,
    this.traceId,
  });
  Map<String, dynamic> toJson() => {
        if (threadId != null) 'threadId': threadId,
        'messageType': messageType,
        if (content != null) 'content': content,
        if (targetSlot != null) 'targetSlot': targetSlot,
        if (slotValue != null) 'slotValue': slotValue,
        if (traceId != null) 'traceId': traceId,
      };
}
