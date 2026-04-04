import { CaptureList } from "./CaptureList";
import { SegmentedModeControl } from "./SegmentedModeControl";
import type {
  CaptureRecord,
  ReaderMode,
  ReaderResult,
  WorkspaceSnapshot,
} from "../types/rustCore";
import type { DesktopCapabilities, DesktopView, WorkspaceStatus } from "../types/ui";

interface ContextPanelProps {
  activeView: DesktopView;
  workspace: WorkspaceSnapshot | null;
  readerResult: ReaderResult | null;
  mode: ReaderMode;
  isRunningReader: boolean;
  workspaceStatus: WorkspaceStatus;
  capabilities: DesktopCapabilities;
  selectedCaptureId?: string;
  onModeChange: (nextMode: ReaderMode) => void;
  onSelectView: (view: DesktopView) => void;
  onSelectCapture: (capture: CaptureRecord) => void;
}

export function ContextPanel({
  activeView,
  workspace,
  readerResult,
  mode,
  isRunningReader,
  workspaceStatus,
  capabilities,
  selectedCaptureId,
  onModeChange,
  onSelectView,
  onSelectCapture,
}: ContextPanelProps) {
  const captures = workspace?.captures ?? [];

  if (activeView === "reader") {
    return (
      <div className="context-stack">
        <section className="context-card">
          <p className="section-label">阅读模式</p>
          <h3>切换输出</h3>
          <SegmentedModeControl
            mode={mode}
            disabled={isRunningReader || !readerResult}
            onChange={onModeChange}
          />
        </section>

        <section className="context-card">
          <p className="section-label">Quick Read</p>
          <h3>{readerResult ? "当前材料强度" : "等待内容"}</h3>
          {readerResult ? (
            <div className="metric-grid compact">
              <MetricCard label="Tier" value={readerResult.difficulty.tier} />
              <MetricCard label="CEFR" value={readerResult.difficulty.cefrLevel} />
              <MetricCard label="Score" value={String(readerResult.difficulty.score)} />
              <MetricCard
                label="Read Time"
                value={`${readerResult.difficulty.readingTimeMinutes.toFixed(1)} min`}
              />
            </div>
          ) : (
            <p className="muted-copy">先在 Today 导入文本，或从侧栏选择一条材料。</p>
          )}
        </section>

        <section className="context-card">
          <p className="section-label">Capture Queue</p>
          <h3>切换到其他材料</h3>
          <CaptureList
            captures={captures}
            selectedCaptureId={selectedCaptureId}
            emptyLabel="导入后的材料会显示在这里。"
            onSelect={onSelectCapture}
            limit={3}
            compact
          />
        </section>
      </div>
    );
  }

  if (activeView === "home") {
    return (
      <div className="context-stack">
        <section className="context-card">
          <p className="section-label">Today At A Glance</p>
          <h3>桌面端已经能稳定承接的流程</h3>
          <div className="metric-grid compact">
            <MetricCard label="Captures" value={String(captures.length)} />
            <MetricCard label="Sessions" value={String(workspace?.sessions.length ?? 0)} />
            <MetricCard
              label="Handoff"
              value={capabilities.handoff ? "Enabled" : "Off"}
            />
            <MetricCard label="状态" value={statusLabel(workspaceStatus)} />
          </div>
        </section>

        <section className="context-card">
          <p className="section-label">Input Notes</p>
          <h3>建议这样使用当前版本</h3>
          <ul className="stacked-list">
            <li>先导入一段短而真实的英文，再让 Reader 跑第一遍。</li>
            <li>用 Review 收拢难点，不要在一屏里塞太多操作。</li>
            <li>扩展 handoff 已接通，文件导入会在后续补上。</li>
          </ul>
        </section>
      </div>
    );
  }

  if (activeView === "review") {
    return (
      <div className="context-stack">
        <section className="context-card">
          <p className="section-label">Next Move</p>
          <h3>把复盘接回主流程</h3>
          <div className="action-stack">
            <button
              type="button"
              className="tinted-button"
              onClick={() => {
                onSelectView("reader");
              }}
            >
              回 Reader
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onSelectView("home");
              }}
            >
              回 Today
            </button>
          </div>
        </section>

        <section className="context-card">
          <p className="section-label">Review Status</p>
          <h3>{readerResult ? "已生成复盘信息" : "等待阅读结果"}</h3>
          {readerResult ? (
            <ul className="stacked-list">
              {readerResult.difficulty.suggestions.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">先运行一次 Reader，这里才会出现复盘重点。</p>
          )}
        </section>
      </div>
    );
  }

  if (activeView === "settings") {
    return (
      <div className="context-stack">
        <section className="context-card">
          <p className="section-label">当前配置</p>
          <h3>连接概览</h3>
          <div className="stacked-kv">
            <div>
              <span>Provider</span>
              <strong>{workspace?.config.provider ?? "-"}</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{workspace?.config.model ?? "-"}</strong>
            </div>
            <div>
              <span>Level</span>
              <strong>{workspace?.config.userLevel ?? "-"}</strong>
            </div>
            <div>
              <span>Reader</span>
              <strong>{workspace?.config.readerMode ?? "-"}</strong>
            </div>
          </div>
        </section>

        <section className="context-card">
          <p className="section-label">Workspace</p>
          <h3>当前工作区规模</h3>
          <div className="metric-grid compact">
            <MetricCard label="Captures" value={String(captures.length)} />
            <MetricCard label="Sessions" value={String(workspace?.sessions.length ?? 0)} />
            <MetricCard
              label="Handoff"
              value={capabilities.handoff ? "Enabled" : "Off"}
            />
            <MetricCard label="状态" value={statusLabel(workspaceStatus)} />
          </div>
        </section>

        <section className="context-card">
          <p className="section-label">Advanced</p>
          <h3>本轮保持克制</h3>
          <p className="muted-copy">
            ASR、TTS、Prompt 和调试项本轮只展示为说明区，不渲染可编辑假配置。
          </p>
        </section>
      </div>
    );
  }

  return null;
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
