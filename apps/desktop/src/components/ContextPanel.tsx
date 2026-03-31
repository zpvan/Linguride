import { SegmentedModeControl } from "./SegmentedModeControl";
import type { ReaderMode, ReaderResult, WorkspaceSnapshot } from "../types/rustCore";
import type { DesktopCapabilities, DesktopView, WorkspaceStatus } from "../types/ui";

interface ContextPanelProps {
  activeView: DesktopView;
  workspace: WorkspaceSnapshot | null;
  readerResult: ReaderResult | null;
  mode: ReaderMode;
  isRunningReader: boolean;
  workspaceStatus: WorkspaceStatus;
  capabilities: DesktopCapabilities;
  onModeChange: (nextMode: ReaderMode) => void;
  onSelectView: (view: DesktopView) => void;
}

export function ContextPanel({
  activeView,
  workspace,
  readerResult,
  mode,
  isRunningReader,
  workspaceStatus,
  capabilities,
  onModeChange,
  onSelectView,
}: ContextPanelProps) {
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
          <p className="section-label">Difficulty</p>
          <h3>{readerResult ? "难度速览" : "等待内容"}</h3>
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
            <p className="muted-copy">先在 Inbox 导入文本，或从左侧选择一条 capture。</p>
          )}
        </section>

        <section className="context-card">
          <p className="section-label">Highlights</p>
          <h3>学习建议</h3>
          {readerResult ? (
            <ul className="stacked-list">
              {readerResult.difficulty.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {readerResult.summary.highlights.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong> {item.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">Reader 运行后会在这里显示建议与重点。</p>
          )}
        </section>
      </div>
    );
  }

  if (activeView === "inbox") {
    return (
      <div className="context-stack">
        <section className="context-card">
          <p className="section-label">导入说明</p>
          <h3>当前支持</h3>
          <ul className="stacked-list">
            <li>粘贴文本后直接导入本地工作区。</li>
            <li>Chrome 扩展 handoff 会把 capture 写入同一个本地工作区。</li>
            <li>文件导入入口会保留，但当前明确标记为未接通。</li>
          </ul>
        </section>

        <section className="context-card">
          <p className="section-label">Workspace</p>
          <h3>当前状态</h3>
          <div className="metric-grid compact">
            <MetricCard label="Captures" value={String(workspace?.captures.length ?? 0)} />
            <MetricCard label="Sessions" value={String(workspace?.sessions.length ?? 0)} />
            <MetricCard
              label="Handoff"
              value={capabilities.handoff ? "Enabled" : "Off"}
            />
            <MetricCard label="状态" value={statusLabel(workspaceStatus)} />
          </div>
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
          <p className="section-label">高级项</p>
          <h3>当前策略</h3>
          <p className="muted-copy">
            ASR、TTS、Prompt 和调试项本轮只展示为说明区，不渲染可编辑假配置。
          </p>
        </section>
      </div>
    );
  }

  const targetLabel = activeView === "tutor" ? "Tutor" : "Corpus";

  return (
    <div className="context-stack">
      <section className="context-card">
        <p className="section-label">能力状态</p>
        <h3>{targetLabel} 暂未接通</h3>
        <p className="muted-copy">
          {activeView === "tutor" && !capabilities.tutor
            ? "翻译、句法分析、发音与跟读的桌面调用面还未接到 Rust core。"
            : "语料切分和听力分析的桌面调用面还未接到 Rust core。"}
        </p>
      </section>

      <section className="context-card">
        <p className="section-label">下一步</p>
        <h3>继续当前工作</h3>
        <div className="action-stack">
          <button
            type="button"
            className="tinted-button"
            onClick={() => {
              onSelectView("reader");
            }}
          >
            去 Reader
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onSelectView("inbox");
            }}
          >
            回 Inbox
          </button>
        </div>
      </section>
    </div>
  );
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
      return "未接通";
    case "ready":
    default:
      return "就绪";
  }
}
