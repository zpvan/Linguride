import { useState } from "react";

import { analyzeTextOverview } from "./lib/rustCore";
import type { TextAnalysisSummary } from "./types/rustCore";
import "./App.css";

const SAMPLE_TEXT = `Linguride can now route desktop text analysis through a shared Rust core.
This gives the Tauri shell a stable consumer before iOS, Android, or browser WASM are considered.

The first milestone stays intentionally small: deterministic metrics, no provider coupling, and a clean boundary between the desktop UI and the reusable analysis engine.`;

function App() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [result, setResult] = useState<TextAnalysisSummary | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleAnalyze() {
    const nextText = text.trim();
    if (!nextText) {
      setError("Enter a passage before sending it into the Rust core.");
      setResult(null);
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const nextResult = await analyzeTextOverview(nextText);
      setResult(nextResult);
    } catch (analysisError) {
      setResult(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Rust core analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Phase 5 · Desktop First</p>
        <h1>Rust core is now wired into the desktop shell.</h1>
        <p className="intro">
          This screen is intentionally narrow in scope: it proves that Tauri can
          call a shared Rust core without pulling browser runtime code into the
          pipeline.
        </p>
      </section>

      <section className="workspace">
        <div className="editor-card">
          <div className="card-header">
            <div>
              <p className="card-kicker">Desktop Input</p>
              <h2>Text Routed To Rust</h2>
            </div>
            <span className="status-chip">
              {isAnalyzing ? "Analyzing" : "Ready"}
            </span>
          </div>

          <textarea
            className="text-editor"
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="Paste a passage for the Rust core to analyze."
          />

          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Running Rust core..." : "Analyze in Rust"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setText(SAMPLE_TEXT)}
              disabled={isAnalyzing}
            >
              Load sample
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setText("");
                setResult(null);
                setError("");
              }}
              disabled={isAnalyzing}
            >
              Clear
            </button>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <div className="results-column">
          <div className="metrics-card">
            <div className="card-header">
              <div>
                <p className="card-kicker">Rust Output</p>
                <h2>Deterministic Summary</h2>
              </div>
            </div>

            {result ? (
              <>
                <div className="metrics-grid">
                  <MetricCard
                    label="Words"
                    value={result.metrics.wordCount.toString()}
                  />
                  <MetricCard
                    label="Sentences"
                    value={result.metrics.sentenceCount.toString()}
                  />
                  <MetricCard
                    label="Paragraphs"
                    value={result.metrics.paragraphCount.toString()}
                  />
                  <MetricCard
                    label="Read Time"
                    value={`${result.metrics.estimatedReadingMinutes.toFixed(1)} min`}
                  />
                  <MetricCard
                    label="Avg Word"
                    value={result.metrics.averageWordLength.toFixed(1)}
                  />
                  <MetricCard
                    label="Avg Sentence"
                    value={result.metrics.averageSentenceLength.toFixed(1)}
                  />
                </div>

                <div className="insight-block">
                  <p className="card-kicker">Highlights</p>
                  <ul className="highlight-list">
                    {result.highlights.map((highlight) => (
                      <li key={highlight.title} className="highlight-item">
                        <strong>{highlight.title}</strong>
                        <span>{highlight.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="excerpt-block">
                  <div>
                    <p className="card-kicker">Excerpt</p>
                    <p className="excerpt-text">{result.excerpt}</p>
                  </div>
                  <div>
                    <p className="card-kicker">Normalized Text</p>
                    <p className="normalized-text">{result.normalizedText}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Run the desktop command to see the shared Rust core respond.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
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

export default App;
