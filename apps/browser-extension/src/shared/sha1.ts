/**
 * @file sha1.ts
 * @description 基于 WebCrypto 的 sha1 十六进制摘要（Node 20+ / Service Worker / 页面均可用）
 */

/** 计算字符串的 sha1，返回小写十六进制 */
export async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
