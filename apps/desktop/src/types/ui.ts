export type DesktopView =
  | "inbox"
  | "reader"
  | "tutor"
  | "corpus"
  | "settings";

export type WorkspaceStatus = "ready" | "empty" | "loading" | "unavailable";

export type StatusTone = "info" | "success" | "error" | "warning";

export interface StatusBannerState {
  tone: StatusTone;
  title: string;
  message: string;
}

export interface DesktopCapabilities {
  reader: boolean;
  tutor: boolean;
  corpus: boolean;
  handoff: boolean;
  fileImport: boolean;
}
