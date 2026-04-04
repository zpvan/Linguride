import { CaptureList } from "../components/CaptureList";
import type {
  CaptureRecord,
  CefrLevel,
  ReaderMode,
  SessionRecord,
} from "../types/rustCore";

interface HomeViewProps {
  titleDraft: string;
  captureDraft: string;
  isSavingCapture: boolean;
  fileImportEnabled: boolean;
  captures: CaptureRecord[];
  sessions: SessionRecord[];
  selectedCaptureId?: string;
  currentLevel: CefrLevel;
  defaultMode: ReaderMode;
  onTitleChange: (value: string) => void;
  onCaptureChange: (value: string) => void;
  onCreateCapture: () => void;
  onLoadSample: () => void;
  onSelectCapture: (capture: CaptureRecord) => void;
}

const MODE_LABELS: Record<ReaderMode, string> = {
  translate: "对照阅读",
  paraphrase: "英文释义",
  mixed: "双语混排",
};

export function HomeView({
  titleDraft,
  captureDraft,
  isSavingCapture,
  fileImportEnabled,
  captures,
  sessions,
  selectedCaptureId,
  currentLevel,
  defaultMode,
  onTitleChange,
  onCaptureChange,
  onCreateCapture,
  onLoadSample,
  onSelectCapture,
}: HomeViewProps) {
  const featuredCapture =
    captures.find((capture) => capture.id === selectedCaptureId) ?? captures[0];

  return (
    <div className="view-stack">
      <section className="content-card hero-card">
        <div className="hero-copy">
          <p className="section-label">Daily Ride</p>
          <h3>
            {featuredCapture
              ? "继续一段真实文本，把输入变成可复用的表达。"
              : "先带一段真实英语进来，再开始今天这一轮输入。"}
          </h3>
          <p className="muted-copy hero-body">
            Linguride 现在最适合做两件事：快速导入材料，和把一段文本读透。先让
            Reader 跑起来，再去 Review 收拢重点、难点和下一步练习。
          </p>
        </div>

        <div className="glance-grid">
          <GlanceCard
            label="Current Level"
            value={currentLevel}
            detail="当前学习级别"
          />
          <GlanceCard
            label="Default Mode"
            value={MODE_LABELS[defaultMode]}
            detail="新材料默认输出"
          />
          <GlanceCard
            label="Capture Library"
            value={String(captures.length)}
            detail="已进入本地工作区"
          />
          <GlanceCard
            label="Review Sessions"
            value={String(sessions.length)}
            detail="累计学习记录"
          />
        </div>

        {featuredCapture ? (
          <div className="spotlight-card">
            <div>
              <p className="section-label">Pick Up Where You Left Off</p>
              <h4>{featuredCapture.title}</h4>
              <p className="muted-copy">{featuredCapture.preview}</p>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onSelectCapture(featuredCapture);
                }}
              >
                继续阅读
              </button>
              <button type="button" className="ghost-button" onClick={onLoadSample}>
                换一段示例
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="dashboard-grid">
        <section className="content-card editor-card">
          <div className="card-head">
            <div>
              <p className="section-label">Bring Text In</p>
              <h3>导入一段新材料</h3>
            </div>
            <span className="info-pill">{isSavingCapture ? "导入中" : "Ready"}</span>
          </div>

          <input
            className="settings-input"
            value={titleDraft}
            onChange={(event) => {
              onTitleChange(event.currentTarget.value);
            }}
            placeholder="标题，例如：The Atlantic - Why Reading Still Matters"
          />

          <textarea
            className="capture-editor"
            value={captureDraft}
            onChange={(event) => {
              onCaptureChange(event.currentTarget.value);
            }}
            placeholder="粘贴文章、段落或你刚刚从浏览器 handoff 过来的正文。"
          />

          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              disabled={isSavingCapture}
              onClick={onCreateCapture}
            >
              {isSavingCapture ? "正在导入..." : "导入并打开 Reader"}
            </button>
            <button type="button" className="tinted-button" onClick={onLoadSample}>
              载入示例
            </button>
            <button type="button" className="ghost-button" disabled={!fileImportEnabled}>
              文件导入即将开放
            </button>
          </div>
        </section>

        <section className="content-card roadmap-card">
          <div className="card-head">
            <div>
              <p className="section-label">What Comes Next</p>
              <h3>下一步会补齐的学习面</h3>
            </div>
            <span className="mini-badge subtle">Soon</span>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <strong>Tutor Workshop</strong>
              <span>中英转换、长难句拆解、跟读与发音评估。</span>
            </div>
            <div className="feature-card">
              <strong>Review Loop</strong>
              <span>把高频错误、重点表达和复习节奏串起来。</span>
            </div>
            <div className="feature-card">
              <strong>Corpus Builder</strong>
              <span>把输入材料沉淀成可复用的听力与表达语料。</span>
            </div>
          </div>
        </section>
      </div>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">Recent Library</p>
            <h3>最近导入的材料</h3>
          </div>
          <span className="counter-badge">{captures.length}</span>
        </div>

        <CaptureList
          captures={captures}
          selectedCaptureId={selectedCaptureId}
          emptyLabel="还没有本地材料，先导入一段文本。"
          onSelect={onSelectCapture}
          limit={4}
        />
      </section>
    </div>
  );
}

interface GlanceCardProps {
  label: string;
  value: string;
  detail: string;
}

function GlanceCard({ label, value, detail }: GlanceCardProps) {
  return (
    <article className="glance-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
