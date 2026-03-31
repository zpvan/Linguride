interface CorpusViewProps {
  onGoToReader: () => void;
  onGoToInbox: () => void;
}

export function CorpusView({ onGoToReader, onGoToInbox }: CorpusViewProps) {
  return (
    <div className="view-stack">
      <section className="content-card unavailable-card">
        <p className="section-label">Corpus</p>
        <h3>桌面 Corpus 还未接通</h3>
        <p className="muted-copy">
          语料切分与听力分析的桌面流程仍在接入中，本轮只提供明确的入口和状态说明。
        </p>
      </section>

      <section className="content-card">
        <p className="section-label">计划中的分区</p>
        <div className="feature-grid">
          <div className="feature-card">
            <strong>语料切分</strong>
            <span>句子切分、重点定位、素材预处理</span>
          </div>
          <div className="feature-card">
            <strong>听力分析</strong>
            <span>听写分析、盲点总结与学习建议</span>
          </div>
        </div>

        <div className="action-row">
          <button type="button" className="tinted-button" onClick={onGoToReader}>
            先去 Reader
          </button>
          <button type="button" className="ghost-button" onClick={onGoToInbox}>
            回 Inbox
          </button>
        </div>
      </section>
    </div>
  );
}
