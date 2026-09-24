/**
 * @file extensionContext.ts
 * @description 扩展上下文有效性检测与 Background 消息发送封装
 *
 * 扩展重载 / 更新后，页面中旧的 Content Script 与 Background 的连接失效，
 * chrome.runtime.sendMessage 会抛出 "Extension context invalidated"。
 * 统一在此检测并转换为可读的中文提示，引导用户刷新页面。
 */

/** 扩展上下文失效时的用户可读提示 */
export const EXTENSION_RELOADED_MESSAGE = "扩展已更新，请刷新页面后重试";

/**
 * 当前 Content Script 的扩展上下文是否仍有效。
 *
 * 上下文失效后访问 chrome.runtime.id 返回 undefined（部分 API 直接抛错）。
 */
export function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** 判断错误是否为扩展上下文失效 */
export function isExtensionContextError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  );
}

/**
 * 发送消息到 Background；上下文失效时抛出可读的中文错误。
 */
export async function sendMessageToBackground<T>(message: unknown): Promise<T> {
  if (!isExtensionContextValid()) {
    throw new Error(EXTENSION_RELOADED_MESSAGE);
  }

  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw new Error(EXTENSION_RELOADED_MESSAGE);
    }
    throw error;
  }
}
