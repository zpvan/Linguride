/**
 * @file flashcardState.ts
 * @description 认图卡片当前页面的 reveal 集合；离开页面时整体丢弃，不持久化
 */

export class FlashcardRevealState {
  private readonly revealed = new Set<string>();

  toggle(cardId: string): void {
    if (this.revealed.has(cardId)) {
      this.revealed.delete(cardId);
    } else {
      this.revealed.add(cardId);
    }
  }

  isRevealed(cardId: string): boolean {
    return this.revealed.has(cardId);
  }
}
