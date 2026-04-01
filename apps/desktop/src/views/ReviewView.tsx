import type { ReaderResult } from "../types/rustCore";

interface ReviewViewProps {
  readerResult: ReaderResult | null;
  isLoading: boolean;
  isRunningReader: boolean;
  onGoToReader: () => void;
  onGoHome: () => void;
}

const TIER_LABELS = {
  foundation: "基础可读",
  guided: "需要引导",
  stretch: "拉伸区",
  intensive: "高强度",
} as const;

export function ReviewView({
  readerResult,
  isLoading,
  isRunningReader,
  onGoToReader,
  onGoHome,
}: ReviewViewProps) {
  if (isLoading) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Review</p>
        <h3>正在准备复盘面板</h3>
        <p className="muted-copy">先同步工作区，再拉取最近一次阅读结果。</p>
      </section>
    );
  }

  if (isRunningReader) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Review</p>
        <h3>正在更新复盘要点</h3>
        <p className="muted-copy">Reader 跑完后，这里会自动刷新难点和建议。</p>
      </section>
    );
  }

  if (!readerResult) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Review</p>
        <h3>还没有可复盘的材料</h3>
        <p className="muted-copy">先打开一条 capture，让 Reader 生成结果，再回来做复盘。</p>
        <div className="action-row">
          <button type="button" className="primary-button" onClick={onGoHome}>
            回 Today
          </button>
          <button type="button" className="ghost-button" onClick={onGoToReader}>
            去 Reader
          </button>
        </div>
      </section>
    );
  }

  const { difficulty, summary } = readerResult;

  return (
    <div className="view-stack">
      <section className="content-card hero-card review-hero">
        <div className="hero-copy">
          <p className="section-label">Review Loop</p>
          <h3>把这次输入收拢成可记住、可复用的重点。</h3>
          <p className="muted-copy hero-body">{summary.excerpt}</p>
        </div>

        <div className="glance-grid">
          <GlanceStat
            label="Difficulty"
            value={TIER_LABELS[difficulty.tier]}
            detail={`CEFR ${difficulty.cefrLevel}`}
          />
          <GlanceStat
            label="Score"
            value={String(difficulty.score)}
            detail="综合难度评分"
          />
          <GlanceStat
            label="Read Time"
            value={`${difficulty.readingTimeMinutes.toFixed(1)} min`}
            detail="预计通读时长"
          />
          <GlanceStat
            label="Sentences"
            value={String(summary.metrics.sentenceCount)}
            detail="本次处理句数"
          />
        </div>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">Focus Areas</p>
            <h3>建议优先盯住的点</h3>
          </div>
          <span className="counter-badge">{difficulty.suggestions.length}</span>
        </div>

        <ul className="stacked-list emphasis-list">
          {difficulty.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">Highlights</p>
            <h3>这段材料的关键提醒</h3>
          </div>
          <span className="counter-badge">{summary.highlights.length}</span>
        </div>

        <div className="highlight-grid">
          {summary.highlights.map((item) => (
            <article key={item.title} className="feature-card highlight-card">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">Text Snapshot</p>
            <h3>本次阅读的结构信息</h3>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard label="Words" value={String(summary.metrics.wordCount)} />
          <MetricCard
            label="Paragraphs"
            value={String(summary.metrics.paragraphCount)}
          />
          <MetricCard
            label="Avg Sentence"
            value={`${summary.metrics.averageSentenceLength.toFixed(1)} 词`}
          />
          <MetricCard
            label="Avg Word"
            value={`${summary.metrics.averageWordLength.toFixed(1)} 字符`}
          />
        </div>
      </section>
    </div>
  );
}

interface GlanceStatProps {
  label: string;
  value: string;
  detail: string;
}

function GlanceStat({ label, value, detail }: GlanceStatProps) {
  return (
    <article className="glance-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
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
