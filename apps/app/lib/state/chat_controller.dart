import 'package:flutter/foundation.dart';
import '../api/chat_api.dart';
import '../models/api_models.dart';
import '../models/ui_command.dart';

class ChatMessage {
  final bool isUser;
  final String? text;
  final List<UiCommand> commands;
  const ChatMessage.user(this.text)
      : isUser = true,
        commands = const [];
  const ChatMessage.ai(this.commands)
      : isUser = false,
        text = null;
}

/// 会话状态机 (前端侧)。统一出口 [_dispatch] 负责 UI Lock + 调后端 + 落指令。
class ChatController extends ChangeNotifier {
  final ChatApi _api = ChatApi();
  final List<ChatMessage> messages = [];
  String? threadId;
  bool locked = false;
  String? editingSlot;

  /// 一键新测算 / 首次进入 (需求书 2.1)
  Future<void> start() async {
    messages.clear();
    threadId = null;
    editingSlot = null;
    notifyListeners();
    await _dispatch(const BrokerRequest(messageType: 'reset'));
  }

  Future<void> sendText(String content) async {
    final t = content.trim();
    if (t.isEmpty || locked) return;
    messages.add(ChatMessage.user(t));
    await _dispatch(
      BrokerRequest(messageType: 'text', threadId: threadId, content: t),
    );
  }

  Future<void> sendSlot(String slot, String value, [String? label]) async {
    if (locked) return;
    messages.add(ChatMessage.user(label ?? value));
    await _dispatch(BrokerRequest(
      messageType: 'slot_update',
      threadId: threadId,
      targetSlot: slot,
      slotValue: value,
    ));
  }

  Future<void> sendFeedback(String traceId) async {
    await _dispatch(BrokerRequest(
      messageType: 'feedback',
      threadId: threadId,
      traceId: traceId,
      content: '经纪人标记此账单存疑',
    ));
  }

  void startEditing(String slot) {
    editingSlot = slot;
    notifyListeners();
  }

  void cancelEditing() {
    editingSlot = null;
    notifyListeners();
  }

  Future<void> _dispatch(BrokerRequest req) async {
    locked = true;
    editingSlot = null;
    notifyListeners();
    try {
      final env = await _api.send(req);
      threadId = env.threadId;
      messages.add(ChatMessage.ai(env.data));
    } catch (_) {
      messages.add(const ChatMessage.ai([TextCommand('网络开小差了，请稍后再试。')]));
    } finally {
      locked = false;
      notifyListeners();
    }
  }
}
