import 'package:flutter/material.dart';
import '../constants/slot_meta.dart';
import '../state/chat_controller.dart';
import '../widgets/command_renderer.dart';
import '../widgets/common.dart';

const _quickPrompts = ['永明产品佣金测算', '高龄储蓄险佣金测算'];

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ChatController _c = ChatController();
  final TextEditingController _input = TextEditingController();
  final TextEditingController _editInput = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _c.addListener(_onChange);
    _c.start();
  }

  void _onChange() {
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _c.removeListener(_onChange);
    _c.dispose();
    _input.dispose();
    _editInput.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send() {
    final t = _input.text;
    _input.clear();
    _c.sendText(t);
  }

  @override
  Widget build(BuildContext context) {
    final msgs = _c.messages;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F5F7),
      appBar: AppBar(
        title: const Text('佣金测算'),
        backgroundColor: Colors.white,
        foregroundColor: kInk,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(14),
                itemCount: msgs.length + (_c.locked ? 1 : 0),
                itemBuilder: (ctx, i) {
                  if (i >= msgs.length) return _loading();
                  final m = msgs[i];
                  if (m.isUser) return _userBubble(m.text ?? '');
                  final isLast = i == msgs.length - 1;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: m.commands
                        .map((cmd) => CommandRenderer(
                              command: cmd,
                              active:
                                  isLast && !_c.locked && _c.editingSlot == null,
                              onSlot: (s, v, [l]) => _c.sendSlot(s, v, l),
                              onEditTag: (s) => _c.startEditing(s),
                              onFeedback: (tid) {
                                _c.sendFeedback(tid);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('已提交反馈'),
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              },
                            ))
                        .toList(),
                  );
                },
              ),
            ),
            if (_c.editingSlot != null) _editor(_c.editingSlot!),
            _quickRow(),
            _privacy(),
            _composer(),
          ],
        ),
      ),
    );
  }

  Widget _userBubble(String text) => Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 320),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            color: kBlue,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(4),
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
            ),
          ),
          child: Text(text,
              style: const TextStyle(
                  color: Colors.white, fontSize: 15, height: 1.5)),
        ),
      );

  Widget _loading() => const AiBubble(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 8),
            Text('AI 正在核算规则…',
                style: TextStyle(
                    fontSize: 15,
                    color: kMuted,
                    fontStyle: FontStyle.italic)),
          ],
        ),
      );

  Widget _editor(String slot) {
    final meta = slotPromptMeta[slot];
    if (meta == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: const Color(0xFFFFFBEB),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(meta.question,
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF92400E))),
              ),
              InkWell(
                onTap: _c.cancelEditing,
                child: const Text('✕', style: TextStyle(color: Color(0xFF9CA3AF))),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (meta.render == 'choice_chips')
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: meta.options
                  .map((o) => InkWell(
                        onTap: () => _c.sendSlot(slot, o.value, o.label),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border:
                                Border.all(color: const Color(0xFFBFDBFE)),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(o.label,
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF2563EB))),
                        ),
                      ))
                  .toList(),
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _editInput,
                    keyboardType: meta.inputType == 'number'
                        ? TextInputType.number
                        : TextInputType.text,
                    decoration: InputDecoration(
                      hintText: meta.placeholder ?? '',
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    final v = _editInput.text.trim();
                    if (v.isNotEmpty) {
                      _editInput.clear();
                      _c.sendSlot(slot, v);
                    }
                  },
                  child: const Text('确定'),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _quickRow() => SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: _quickPrompts
              .map((p) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Center(
                      child: InkWell(
                        onTap: _c.locked ? null : () => _c.sendText(p),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(p,
                              style: const TextStyle(
                                  fontSize: 13, color: Color(0xFF374151))),
                        ),
                      ),
                    ),
                  ))
              .toList(),
        ),
      );

  Widget _privacy() => const Padding(
        padding: EdgeInsets.fromLTRB(14, 4, 14, 4),
        child: Text(
          '⚠️ 内部沙盒测算工具，请勿输入客户真实姓名、HKID 等敏感信息',
          style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
        ),
      );

  Widget _composer() => Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        color: Colors.white,
        child: Row(
          children: [
            InkWell(
              onTap: _c.locked ? null : _c.start,
              customBorder: const CircleBorder(),
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                    color: Color(0xFFF3F4F6), shape: BoxShape.circle),
                child: const Icon(Icons.refresh, size: 20, color: kMuted),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _input,
                enabled: !_c.locked,
                decoration: InputDecoration(
                  hintText: '输入产品或测算条件…',
                  isDense: true,
                  filled: true,
                  fillColor: const Color(0xFFF3F4F6),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(999),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (_) => _send(),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _c.locked ? null : _send,
              style: FilledButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999)),
              ),
              child: const Text('发送'),
            ),
          ],
        ),
      );
}
