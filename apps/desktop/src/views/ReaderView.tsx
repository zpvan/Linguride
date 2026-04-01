import type { ReaderResult } from "../types/rustCore";

interface ReaderViewProps {
  readerResult: ReaderResult | null;
  isLoading: boolean;
  isRunningReader: boolean;
  onOpenReview: () => void;
}

const MODE_LABELS = {
  translate: "对照",
  paraphrase: "释义",
  mixed: "双语",
} as const;

export function ReaderView({
  readerResult,
  isLoading,
  isRunningReader,
  onOpenReview,
}: ReaderViewProps) {
  if (isLoading) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>正在准备阅读工作台</h3>
        <p className="muted-copy">稍等片刻，正在同步本地材料与最近一次阅读结果。</p>
      </section>
    );
  }

  if (isRunningReader) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>正在生成阅读输出</h3>
        <p className="muted-copy">正在按当前模式整理原文、释义和难度数据。</p>
      </section>
    );
  }

  if (!readerResult) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>还没有可阅读的材料</h3>
        <p className="muted-copy">先回 Today 导入文本，或从侧栏选择最近一条材料。</p>
      </section>
    );
  }

  const metrics = readerResult.summary.metrics;

  return (
    <div className="view-stack">
      <section className="content-card hero-card reader-hero">
        <div className="card-head">
          <div>
            <p className="section-label">Reading Studio</p>
            <h3>{readerResult.document.title}</h3>
            <p className="muted-copy hero-body">{readerResult.summary.excerpt}</p>
          </div>
          <div className="action-row">
            <span className="info-pill">{MODE_LABELS[readerResult.document.mode]}</span>
            <button type="button" className="tinted-button" onClick={onOpenReview}>
              打开 Review
            </button>
          </div>
        </div>

        {readerResult.document.originUrl ? (
          <a
            className="source-link"
            href={readerResult.document.originUrl}
            target="_blank"
            rel="noreferrer"
          >
            {readerResult.document.originUrl}
          </a>
        ) : null}

        <div className="metric-grid">
          <MetricCard label="Words" value={String(metrics.wordCount)} />
          <MetricCard label="Sentences" value={String(metrics.sentenceCount)} />
          <MetricCard
            label="Read Time"
            value={`${readerResult.difficulty.readingTimeMinutes.toFixed(1)} min`}
          />
          <MetricCard label="Difficulty" value={readerResult.difficulty.cefrLevel} />
        </div>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">Side By Side</p>
            <h3>原文与输出并排阅读</h3>
          </div>
          <span className="counter-badge">{readerResult.document.blocks.length}</span>
        </div>

        <div className="block-list">
          {readerResult.document.blocks.map((block) => (
            <article key={block.id} className="reader-block">
              <div className="block-pane">
                <p className="section-label">Original</p>
                <p className="original-copy">{block.originalText}</p>
              </div>
              <div className="block-pane">
                <p className="section-label">Output</p>
                <p className="rendered-copy">{block.renderedText}</p>
              </div>
            </article>
          ))}
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
