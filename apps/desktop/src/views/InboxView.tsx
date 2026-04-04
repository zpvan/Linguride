import { CaptureList } from "../components/CaptureList";
import type { CaptureRecord } from "../types/rustCore";

interface InboxViewProps {
  titleDraft: string;
  captureDraft: string;
  isSavingCapture: boolean;
  fileImportEnabled: boolean;
  captures: CaptureRecord[];
  selectedCaptureId?: string;
  onTitleChange: (value: string) => void;
  onCaptureChange: (value: string) => void;
  onCreateCapture: () => void;
  onLoadSample: () => void;
  onSelectCapture: (capture: CaptureRecord) => void;
}

export function InboxView({
  titleDraft,
  captureDraft,
  isSavingCapture,
  fileImportEnabled,
  captures,
  selectedCaptureId,
  onTitleChange,
  onCaptureChange,
  onCreateCapture,
  onLoadSample,
  onSelectCapture,
}: InboxViewProps) {
  return (
    <div className="view-stack">
      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">导入文本</p>
            <h3>创建新的 Capture</h3>
          </div>
          <span className="info-pill">{isSavingCapture ? "保存中" : "Ready"}</span>
        </div>

        <input
          className="settings-input"
          value={titleDraft}
          onChange={(event) => {
            onTitleChange(event.currentTarget.value);
          }}
          placeholder="标题，例如：NYT - Rust Core"
        />

        <textarea
          className="capture-editor"
          value={captureDraft}
          onChange={(event) => {
            onCaptureChange(event.currentTarget.value);
          }}
          placeholder="粘贴文章、段落或扩展 handoff 的正文。"
        />

        <div className="action-row">
          <button
            type="button"
            className="primary-button"
            disabled={isSavingCapture}
            onClick={onCreateCapture}
          >
            {isSavingCapture ? "正在导入..." : "导入到 Reader"}
          </button>
          <button type="button" className="tinted-button" onClick={onLoadSample}>
            载入示例
          </button>
          <button type="button" className="ghost-button" disabled={!fileImportEnabled}>
            文件导入
          </button>
        </div>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">最近导入</p>
            <h3>继续阅读</h3>
          </div>
          <span className="counter-badge">{captures.length}</span>
        </div>

        <CaptureList
          captures={captures}
          selectedCaptureId={selectedCaptureId}
          emptyLabel="还没有本地 capture，先在上方粘贴一段文本。"
          onSelect={onSelectCapture}
          limit={3}
        />
      </section>
    </div>
  );
}
