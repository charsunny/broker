import '../models/ui_command.dart';

/// 槽位反问元数据 (镜像后端 SLOT_PROMPT_META 中 Tag 可微调的几个槽位)。
/// 点击佣金卡片上的 Tag 原地修改时, 用它本地渲染编辑器 (需求书 2.3)。
class SlotPromptMeta {
  final String render; // 'choice_chips' | 'native_input'
  final String question;
  final List<OptionItem> options;
  final String inputType;
  final String? placeholder;
  const SlotPromptMeta({
    required this.render,
    required this.question,
    this.options = const [],
    this.inputType = 'text',
    this.placeholder,
  });
}

const Map<String, SlotPromptMeta> slotPromptMeta = {
  'premiumTerm': SlotPromptMeta(
    render: 'choice_chips',
    question: '请问该保单的缴费年期是？',
    options: [
      OptionItem('2年', '2'),
      OptionItem('5年', '5'),
      OptionItem('10年', '10'),
      OptionItem('Single (趸交)', 'Single'),
    ],
  ),
  'investorStatus': SlotPromptMeta(
    render: 'choice_chips',
    question: '请问该客户的投资者身份是？',
    options: [
      OptionItem('PI (专业投资者)', 'PI'),
      OptionItem('Non-PI (普通客户)', 'Non-PI'),
    ],
  ),
  'premiumAmount': SlotPromptMeta(
    render: 'native_input',
    question: '请问首年总保费金额是多少？',
    inputType: 'number',
    placeholder: '请输入金额，如 350000',
  ),
};
