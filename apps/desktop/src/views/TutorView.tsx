interface TutorViewProps {
  onGoToReader: () => void;
  onGoToInbox: () => void;
}

export function TutorView({ onGoToReader, onGoToInbox }: TutorViewProps) {
  return (
    <div className="view-stack">
      <section className="content-card unavailable-card">
        <p className="section-label">Tutor</p>
        <h3>桌面 Tutor 还未接通</h3>
        <p className="muted-copy">
          中译英、英译中、长难句分析、发音评估和跟读面板会保留入口，但当前不伪造结果。
        </p>
      </section>

      <section className="content-card">
        <p className="section-label">计划中的分区</p>
        <div className="feature-grid">
          <div className="feature-card">
            <strong>翻译 / 释义</strong>
            <span>中译英、英译中、英英释义</span>
          </div>
          <div className="feature-card">
            <strong>句法分析</strong>
            <span>长难句拆解与结构理解</span>
          </div>
          <div className="feature-card">
            <strong>发音 / 跟读</strong>
            <span>评估、分句与 shadow 流程</span>
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
