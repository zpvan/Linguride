import { CaptureList } from "./CaptureList";
import type { CaptureRecord, CefrLevel } from "../types/rustCore";
import type {
  DesktopCapabilities,
  DesktopView,
  WorkspaceStatus,
} from "../types/ui";

interface SidebarNavProps {
  activeView: DesktopView;
  captures: CaptureRecord[];
  selectedCaptureId?: string;
  currentLevel: CefrLevel;
  capabilities: DesktopCapabilities;
  workspaceStatus: WorkspaceStatus;
  sessionCount: number;
  onSelectView: (view: DesktopView) => void;
  onSelectCapture: (capture: CaptureRecord) => void;
}

const NAV_ITEMS: Array<{
  view: DesktopView;
  label: string;
  detail: string;
}> = [
  { view: "home", label: "Today", detail: "导入、继续与安排" },
  { view: "reader", label: "Reader", detail: "并排阅读与输出" },
  { view: "review", label: "Review", detail: "难点、亮点与复盘" },
  { view: "settings", label: "Preferences", detail: "连接与偏好" },
];

export function SidebarNav({
  activeView,
  captures,
  selectedCaptureId,
  currentLevel,
  capabilities,
  workspaceStatus,
  sessionCount,
  onSelectView,
  onSelectCapture,
}: SidebarNavProps) {
  return (
    <aside className="sidebar-nav">
      <div className="sidebar-brand">
        <div className="brand-mark">L</div>
        <div>
          <p className="section-label">Linguride</p>
          <h1>Desktop Preview</h1>
        </div>
      </div>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`workspace-link ${activeView === item.view ? "active" : ""}`}
            onClick={() => {
              onSelectView(item.view);
            }}
          >
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </button>
        ))}
      </nav>

      <section className="sidebar-note workspace-pulse">
        <p className="section-label">Workspace Pulse</p>
        <h3>{statusCopy(workspaceStatus)}</h3>
        <div className="sidebar-metrics">
          <div>
            <span>Level</span>
            <strong>{currentLevel}</strong>
          </div>
          <div>
            <span>Sessions</span>
            <strong>{sessionCount}</strong>
          </div>
          <div>
            <span>Handoff</span>
            <strong>{capabilities.handoff ? "On" : "Off"}</strong>
          </div>
        </div>
      </section>

      <section className="sidebar-section">
        <div className="sidebar-section-head">
          <p className="section-label">Recent Captures</p>
          <span className="counter-badge">{captures.length}</span>
        </div>

        <CaptureList
          captures={captures}
          selectedCaptureId={selectedCaptureId}
          emptyLabel="导入后的文本会显示在这里。"
          onSelect={onSelectCapture}
          limit={5}
          compact
        />
      </section>

      <section className="sidebar-note">
        <p className="section-label">Roadmap</p>
        <h3>留在侧栏，但不再占主流程</h3>
        <ul className="stacked-list roadmap-list">
          <li>{capabilities.tutor ? "Tutor 已可用" : "Tutor 会在桌面端补齐发音与跟读。"}</li>
          <li>{capabilities.corpus ? "Corpus 已可用" : "Corpus 会承接语料沉淀与听力分析。"}</li>
        </ul>
      </section>
    </aside>
  );
}

function statusCopy(status: WorkspaceStatus): string {
  switch (status) {
    case "loading":
      return "正在同步本地材料";
    case "empty":
      return "准备导入第一段材料";
    case "unavailable":
      return "部分能力稍后开放";
    case "ready":
    default:
      return "可以开始今天的阅读循环";
  }
}
