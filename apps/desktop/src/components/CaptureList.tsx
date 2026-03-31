import type { CaptureRecord } from "../types/rustCore";

interface CaptureListProps {
  captures: CaptureRecord[];
  selectedCaptureId?: string;
  emptyLabel: string;
  onSelect: (capture: CaptureRecord) => void;
  limit?: number;
  compact?: boolean;
}

const SOURCE_LABELS: Record<CaptureRecord["sourceApp"], string> = {
  browserExtension: "扩展",
  desktopApp: "桌面",
  manualInput: "手动",
};

const TYPE_LABELS: Record<CaptureRecord["captureType"], string> = {
  page: "整页",
  selection: "选中",
  clipboard: "剪贴板",
  manual: "粘贴",
  fileImport: "文件",
};

export function CaptureList({
  captures,
  selectedCaptureId,
  emptyLabel,
  onSelect,
  limit,
  compact = false,
}: CaptureListProps) {
  const visibleCaptures = typeof limit === "number" ? captures.slice(0, limit) : captures;

  if (!visibleCaptures.length) {
    return <p className="empty-copy">{emptyLabel}</p>;
  }

  return (
    <div className={`capture-list ${compact ? "compact" : ""}`}>
      {visibleCaptures.map((capture) => (
        <button
          key={capture.id}
          type="button"
          className={`capture-card ${
            capture.id === selectedCaptureId ? "active" : ""
          }`}
          onClick={() => {
            onSelect(capture);
          }}
        >
          <div className="capture-card-header">
            <strong>{capture.title}</strong>
            <span className="capture-time">{formatRelativeTime(capture.createdAt)}</span>
          </div>
          <p className="capture-preview">{capture.preview}</p>
          <div className="capture-card-meta">
            <span className="mini-badge">{SOURCE_LABELS[capture.sourceApp]}</span>
            <span className="mini-badge subtle">{TYPE_LABELS[capture.captureType]}</span>
            {capture.truncated ? (
              <span className="mini-badge warning">已截断</span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

function formatRelativeTime(createdAt: number): string {
  const delta = Date.now() - createdAt;

  if (delta < 60_000) {
    return "刚刚";
  }

  if (delta < 3_600_000) {
    return `${Math.max(1, Math.round(delta / 60_000))} 分钟前`;
  }

  if (delta < 86_400_000) {
    return `${Math.max(1, Math.round(delta / 3_600_000))} 小时前`;
  }

  return `${Math.max(1, Math.round(delta / 86_400_000))} 天前`;
}
