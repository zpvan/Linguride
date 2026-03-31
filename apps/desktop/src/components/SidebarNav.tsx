import { CaptureList } from "./CaptureList";
import type { CaptureRecord, CefrLevel } from "../types/rustCore";
import type { DesktopCapabilities, DesktopView } from "../types/ui";

interface SidebarNavProps {
  activeView: DesktopView;
  captures: CaptureRecord[];
  selectedCaptureId?: string;
  currentLevel: CefrLevel;
  capabilities: DesktopCapabilities;
  onSelectView: (view: DesktopView) => void;
  onSelectCapture: (capture: CaptureRecord) => void;
}

const NAV_ITEMS: Array<{
  view: DesktopView;
  label: string;
  detail: string;
}> = [
  { view: "inbox", label: "Inbox", detail: "导入与 handoff" },
  { view: "reader", label: "Reader", detail: "阅读与难度" },
  { view: "tutor", label: "Tutor", detail: "翻译与跟读" },
  { view: "corpus", label: "Corpus", detail: "语料与听力" },
  { view: "settings", label: "Settings", detail: "连接与偏好" },
];

export function SidebarNav({
  activeView,
  captures,
  selectedCaptureId,
  currentLevel,
  capabilities,
  onSelectView,
  onSelectCapture,
}: SidebarNavProps) {
  return (
    <aside className="sidebar-nav">
      <div className="sidebar-brand">
        <div>
          <p className="section-label">Linguride</p>
          <h1>Desktop</h1>
        </div>
        <span className="level-badge">Lv.{currentLevel}</span>
      </div>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        {NAV_ITEMS.map((item) => {
          const unavailable =
            (item.view === "tutor" && !capabilities.tutor) ||
            (item.view === "corpus" && !capabilities.corpus);

          return (
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
              {unavailable ? <span className="mini-badge subtle">Soon</span> : null}
            </button>
          );
        })}
      </nav>

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
    </aside>
  );
}
