import type { ReactNode } from "react";

import { SidebarNav } from "./SidebarNav";
import { StatusBanner } from "./StatusBanner";
import type { CaptureRecord, CefrLevel } from "../types/rustCore";
import type {
  DesktopCapabilities,
  DesktopView,
  StatusBannerState,
  WorkspaceStatus,
} from "../types/ui";

interface AppShellProps {
  activeView: DesktopView;
  captures: CaptureRecord[];
  selectedCaptureId?: string;
  currentLevel: CefrLevel;
  capabilities: DesktopCapabilities;
  workspaceStatus: WorkspaceStatus;
  sessionCount: number;
  title: string;
  subtitle: string;
  banner: StatusBannerState | null;
  onSelectView: (view: DesktopView) => void;
  onSelectCapture: (capture: CaptureRecord) => void;
  main: ReactNode;
  context: ReactNode;
}

export function AppShell({
  activeView,
  captures,
  selectedCaptureId,
  currentLevel,
  capabilities,
  workspaceStatus,
  sessionCount,
  title,
  subtitle,
  banner,
  onSelectView,
  onSelectCapture,
  main,
  context,
}: AppShellProps) {
  return (
    <main className="desktop-root">
      <div className="app-shell">
        <SidebarNav
          activeView={activeView}
          captures={captures}
          selectedCaptureId={selectedCaptureId}
          currentLevel={currentLevel}
          capabilities={capabilities}
          workspaceStatus={workspaceStatus}
          sessionCount={sessionCount}
          onSelectView={onSelectView}
          onSelectCapture={onSelectCapture}
        />

        <div className="shell-body">
          <header className="topbar">
            <div>
              <p className="section-label">Learning Workspace</p>
              <h2>{title}</h2>
              <p className="topbar-copy">{subtitle}</p>
            </div>
            <div className="topbar-meta">
              <span className="level-badge">CEFR {currentLevel}</span>
              <span className={`workspace-status-badge ${workspaceStatus}`}>
                {statusLabel(workspaceStatus)}
              </span>
            </div>
          </header>

          <StatusBanner banner={banner} />

          <div className="content-grid">
            <section className="main-panel">{main}</section>
            <aside className="context-panel">{context}</aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function statusLabel(status: WorkspaceStatus): string {
  switch (status) {
    case "loading":
      return "加载中";
    case "empty":
      return "空";
    case "unavailable":
      return "稍后开放";
    case "ready":
    default:
      return "就绪";
  }
}
