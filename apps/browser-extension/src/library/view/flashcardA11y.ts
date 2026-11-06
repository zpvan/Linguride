/**
 * @file flashcardA11y.ts
 * @description 认图卡片 reveal 按钮的可访问名称、按下状态与单词描述关联
 */

export interface FlashcardRevealA11y {
  label: "显示单词" | "隐藏单词";
  pressed: "true" | "false";
  describedBy: string | null;
  wordId: string;
}

export function getFlashcardRevealA11y(
  cardId: string,
  revealed: boolean
): FlashcardRevealA11y {
  const wordId = `${cardId}-word`;
  return {
    label: revealed ? "隐藏单词" : "显示单词",
    pressed: revealed ? "true" : "false",
    describedBy: revealed ? wordId : null,
    wordId,
  };
}
