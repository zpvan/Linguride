/**
 * @file tts.ts
 * @description Web Speech TTS 语速相关类型定义
 */

/**
 * 全局 TTS 语速选项
 *
 * 当前产品仅支持四档：
 * - 1.0x：自然语速
 * - 0.9x：稍慢
 * - 0.8x：慢速学习
 * - 0.7x：更慢速学习
 */
export const TTS_SPEED_OPTIONS = [1.0, 0.9, 0.8, 0.7] as const;

/**
 * TTS 语速类型
 */
export type TTSSpeed = (typeof TTS_SPEED_OPTIONS)[number];

/**
 * 默认 TTS 语速
 */
export const DEFAULT_TTS_SPEED: TTSSpeed = 1.0;

/**
 * 判断数值是否为受支持的 TTS 语速
 */
export function isTTSSpeed(value: number): value is TTSSpeed {
  return TTS_SPEED_OPTIONS.includes(value as TTSSpeed);
}
