import { useEffect, useState } from "react";

import { SegmentedModeControl } from "../components/SegmentedModeControl";
import type { CefrLevel, LingurideConfig } from "../types/rustCore";

interface SettingsViewProps {
  config: LingurideConfig;
  isSaving: boolean;
  onSave: (nextConfig: LingurideConfig) => void;
}

const LEVEL_OPTIONS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function SettingsView({
  config,
  isSaving,
  onSave,
}: SettingsViewProps) {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <div className="view-stack">
      <section className="content-card">
        <div className="card-head">
          <div>
            <p className="section-label">核心设置</p>
            <h3>当前可保存项</h3>
          </div>
          <span className="info-pill">{isDirty ? "Unsaved" : "Synced"}</span>
        </div>

        <div className="settings-grid">
          <label className="settings-field">
            <span>Provider</span>
            <select
              className="settings-select"
              value={draft.provider}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  provider: event.currentTarget.value as LingurideConfig["provider"],
                });
              }}
            >
              <option value="deepSeek">DeepSeek</option>
              <option value="openAi">OpenAI</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          {draft.provider === "openAi" ? (
            <label className="settings-field">
              <span>Auth</span>
              <select
                className="settings-select"
                value={draft.openAiAuthMode}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    openAiAuthMode: event.currentTarget.value as LingurideConfig["openAiAuthMode"],
                  });
                }}
              >
                <option value="apiKey">API Key</option>
                <option value="oAuth">ChatGPT OAuth</option>
              </select>
            </label>
          ) : null}

          <label className="settings-field span-2">
            <span>API Base URL</span>
            <input
              className="settings-input"
              value={draft.apiBaseUrl}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  apiBaseUrl: event.currentTarget.value,
                });
              }}
              placeholder="https://api.deepseek.com"
            />
          </label>

          <label className="settings-field span-2">
            <span>Model</span>
            <input
              className="settings-input"
              value={draft.model}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  model: event.currentTarget.value,
                });
              }}
              placeholder="gpt-5.1-codex / deepseek-chat"
            />
          </label>
        </div>

        <div className="settings-subsection">
          <p className="section-label">Level</p>
          <div className="level-grid">
            {LEVEL_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                className={`level-option-button ${
                  draft.userLevel === level ? "active" : ""
                }`}
                onClick={() => {
                  setDraft({
                    ...draft,
                    userLevel: level,
                  });
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-subsection">
          <p className="section-label">Reader 默认模式</p>
          <SegmentedModeControl
            mode={draft.readerMode}
            onChange={(nextMode) => {
              setDraft({
                ...draft,
                readerMode: nextMode,
              });
            }}
          />
        </div>

        <label className="toggle-row">
          <div>
            <strong>Desktop Handoff</strong>
            <span>允许扩展把 capture 继续发送到桌面。</span>
          </div>
          <input
            type="checkbox"
            checked={draft.desktopHandoffEnabled}
            onChange={(event) => {
              setDraft({
                ...draft,
                desktopHandoffEnabled: event.currentTarget.checked,
              });
            }}
          />
        </label>

        <div className="action-row">
          <button
            type="button"
            className="primary-button"
            disabled={!isDirty || isSaving}
            onClick={() => {
              onSave(draft);
            }}
          >
            {isSaving ? "正在保存..." : "保存设置"}
          </button>
        </div>
      </section>

      <details className="content-card accordion-card">
        <summary>语音与识别</summary>
        <p className="muted-copy">
          ASR、TTS 与跟读相关配置会保留在这里，但当前 desktop DTO 还未接通这些真实字段。
        </p>
      </details>

      <details className="content-card accordion-card">
        <summary>Prompt 与调试</summary>
        <p className="muted-copy">
          Prompt、高级模型调优与调试选项本轮不渲染为可编辑表单，避免形成假配置。
        </p>
      </details>
    </div>
  );
}
