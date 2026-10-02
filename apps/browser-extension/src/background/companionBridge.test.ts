import { describe, expect, it } from "vitest";

import { CompanionChatTurn } from "../types/companion";
import { normalizeChatTurns } from "./companionBridge";

describe("normalizeChatTurns", () => {
  it("合并连续同 role 轮次（流式失败后用户直接再发消息的场景）", () => {
    const turns: CompanionChatTurn[] = [
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u3" },
    ];
    expect(normalizeChatTurns(turns)).toEqual([
      { role: "user", content: "u1\nu2" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u3" },
    ]);
  });

  it("丢弃窗口前导 assistant 轮次（Anthropic 首条须为 user）", () => {
    const turns: CompanionChatTurn[] = [
      { role: "assistant", content: "a0" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u1" },
    ];
    expect(normalizeChatTurns(turns)).toEqual([{ role: "user", content: "u1" }]);
  });

  it("保留 hidden 轮次（OOC 开场指令仍是对话上下文）并参与合并", () => {
    const turns: CompanionChatTurn[] = [
      { role: "user", content: "(OOC)", hidden: true },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u1" },
    ];
    const result = normalizeChatTurns(turns);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "user", content: "(OOC)", hidden: true });
  });

  it("空历史与已全部交替时原样返回", () => {
    expect(normalizeChatTurns([])).toEqual([]);
    const turns: CompanionChatTurn[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ];
    expect(normalizeChatTurns(turns)).toEqual(turns);
  });

  it("连续三条同 role 合并为一条", () => {
    const turns: CompanionChatTurn[] = [
      { role: "assistant", content: "a1" },
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
      { role: "user", content: "u3" },
    ];
    expect(normalizeChatTurns(turns)).toEqual([
      { role: "user", content: "u1\nu2\nu3" },
    ]);
  });
});
