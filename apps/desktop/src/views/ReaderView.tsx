import type { ReaderResult } from "../types/rustCore";

interface ReaderViewProps {
  readerResult: ReaderResult | null;
  isLoading: boolean;
  isRunningReader: boolean;
}

export function ReaderView({
  readerResult,
  isLoading,
  isRunningReader,
}: ReaderViewProps) {
  if (isLoading) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>正在加载工作区</h3>
        <p className="muted-copy">稍等片刻，正在同步本地 capture 与阅读结果。</p>
      </section>
    );
  }

  if (isRunningReader) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>正在生成阅读结果</h3>
        <p className="muted-copy">正在按当前模式运行 Rust reader workflow。</p>
      </section>
    );
  }

  if (!readerResult) {
    return (
      <section className="content-card empty-state">
        <p className="section-label">Reader</p>
        <h3>还没有内容</h3>
        <p className="muted-copy">先去 Inbox 导入文本，或从左侧选择一条 recent capture。</p>
      </section>
    );
  }

  return (
    <div className="view-stack">
      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">当前文档</p>
            <h3>{readerResult.document.title}</h3>
          </div>
          <span className="info-pill">{readerResult.document.mode}</span>
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
      </section>

      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">阅读输出</p>
            <h3>逐段结果</h3>
          </div>
          <span className="counter-badge">{readerResult.document.blocks.length}</span>
        </div>

        <div className="block-list">
          {readerResult.document.blocks.map((block) => (
            <article key={block.id} className="reader-block">
              <p className="original-copy">{block.originalText}</p>
              <p className="rendered-copy">{block.renderedText}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
