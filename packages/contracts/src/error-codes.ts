/**
 * 全局状态码与异常路由规约 (需求书 6.4)。
 * 前端 Axios 拦截器据此统一路由处理, 严禁把底层报错直接抛给业务员。
 */
export const ApiCode = {
  /** 成功 */
  SUCCESS: 200,
  /** 入参/契约校验失败 */
  VALIDATION_ERROR: 400,
  /** 未鉴权 (手机号不在白名单 / 缺 Token) */
  UNAUTHORIZED: 401,
  /** 会话失效: thread_id 失效或 JWT 过期。前端不弹报错, 清屏重渲染欢迎语 (需求书 3.1) */
  SESSION_EXPIRED: 4010,
  /** 产品未入库 / 触发全局拦截。前端展示统一友好兜底话术 (需求书 1.2 / 2.1) */
  FALLBACK_UNHANDLED: 4040,
  /** LLM 配额受限 / 连接池触顶, 触发降级排队 (需求书 7.4) */
  RATE_LIMITED: 4290,
  /** 服务器内部错误 */
  INTERNAL_ERROR: 500,
} as const;

export type ApiCode = (typeof ApiCode)[keyof typeof ApiCode];

/** 兜底友好话术 (需求书 1.2 / 2.1) */
export const FALLBACK_MESSAGE =
  "暂时无法计算，系统已为您记录该需求，后台升级后将第一时间通知您。";

/** 会话过期欢迎语 (需求书 3.1) */
export const SESSION_EXPIRED_MESSAGE =
  "您的会话已过期，已为您开启全新的佣金测算。请问您要查询什么产品？";

/** 前端未知指令降级话术 (需求书 6.1) */
export const UNKNOWN_COMMAND_MESSAGE = "系统正在升级该功能，请稍后再试";
