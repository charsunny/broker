/**
 * 日志入库脱敏 (需求书 7.3): 对连续 8 位以上数字串 (疑似电话 / HKID) 正则掩码。
 * 严防核心敏感信息明文留存。
 */
export function maskSensitive(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text.replace(/\d{8,}/g, "***");
}
