import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/api_models.dart';

/// 唯一的后端交互入口 (需求书 6.3)。前端是纯渲染器, 只调这一个接口。
/// API 基址可通过 --dart-define=API_BASE=... 在构建时覆盖。
class ChatApi {
  static const String base = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  Future<ApiEnvelope> send(BrokerRequest req) async {
    final res = await http
        .post(
          Uri.parse('$base/broker/chat/message'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(req.toJson()),
        )
        .timeout(const Duration(seconds: 15));
    // 用 bodyBytes + utf8 解码, 避免中文乱码
    final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    return ApiEnvelope.fromJson(json);
  }
}
