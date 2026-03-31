import { invoke } from "@tauri-apps/api/core";

import type {
  CaptureRecord,
  LingurideConfig,
  ManualCaptureInput,
  ReaderMode,
  ReaderResult,
  WorkspaceSnapshot,
} from "../types/rustCore";

export function loadWorkspaceSnapshot() {
  return invoke<WorkspaceSnapshot>("load_workspace_snapshot");
}

export function ingestManualCapture(input: ManualCaptureInput) {
  return invoke<CaptureRecord>("ingest_manual_capture", { input });
}

export function runReaderCapture(captureId: string, mode?: ReaderMode) {
  return invoke<ReaderResult>("run_reader_capture", {
    captureId,
    mode,
  });
}

export function saveWorkspaceConfig(nextConfig: LingurideConfig) {
  return invoke<LingurideConfig>("save_workspace_config", { nextConfig });
}
