import type { CEFRLevel } from "../types";

export interface DesktopHandoffEnvelope {
  schemaVersion: number;
  handoffId: string;
  sourceApp: "browserExtension";
  captureType: "page" | "selection";
  preferredSurface: "reader" | "tutor" | "corpus";
  originUrl?: string;
  title?: string;
  text: string;
  readerMode?: "translate" | "paraphrase" | "mixed";
  userLevel?: CEFRLevel;
  contentHash: string;
  createdAt: number;
  expiresAt: number;
  truncated: boolean;
}

const HANDOFF_TTL_MS = 2 * 60 * 1000;
const MAX_CAPTURE_CHARS = 200_000;

function makeHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16).padStart(8, "0");
}

function truncateText(text: string): { text: string; truncated: boolean } {
  const chars = Array.from(text);
  if (chars.length <= MAX_CAPTURE_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: chars.slice(0, MAX_CAPTURE_CHARS).join(""),
    truncated: true,
  };
}

function createHandoffId(contentHash: string, createdAt: number): string {
  return `capture-${createdAt}-${contentHash.slice(0, 8)}`;
}

export function buildDesktopHandoffEnvelope(input: {
  title?: string;
  originUrl?: string;
  text: string;
  readerMode?: "translate" | "paraphrase" | "mixed";
  preferredSurface?: "reader" | "tutor" | "corpus";
  userLevel?: CEFRLevel;
}): DesktopHandoffEnvelope {
  const createdAt = Date.now();
  const normalizedText = input.text.trim();
  const truncatedResult = truncateText(normalizedText);
  const contentHash = makeHash(truncatedResult.text);

  return {
    schemaVersion: 1,
    handoffId: createHandoffId(contentHash, createdAt),
    sourceApp: "browserExtension",
    captureType: "page",
    preferredSurface: input.preferredSurface || "reader",
    originUrl: input.originUrl,
    title: input.title || "Linguride Desktop Handoff",
    text: truncatedResult.text,
    readerMode: input.readerMode,
    userLevel: input.userLevel,
    contentHash,
    createdAt,
    expiresAt: createdAt + HANDOFF_TTL_MS,
    truncated: truncatedResult.truncated,
  };
}

export function buildDesktopHandoffUrl(envelope: DesktopHandoffEnvelope): string {
  const url = new URL(`linguride://handoff/${encodeURIComponent(envelope.handoffId)}`);
  url.searchParams.set("surface", envelope.preferredSurface);
  return url.toString();
}
