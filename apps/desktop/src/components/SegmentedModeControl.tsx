import type { ReaderMode } from "../types/rustCore";

interface SegmentedModeControlProps {
  mode: ReaderMode;
  disabled?: boolean;
  onChange: (nextMode: ReaderMode) => void;
}

const MODE_LABELS: Record<ReaderMode, string> = {
  translate: "翻译",
  paraphrase: "释义",
  mixed: "混杂",
};

export function SegmentedModeControl({
  mode,
  disabled = false,
  onChange,
}: SegmentedModeControlProps) {
  return (
    <div className="segmented-control desktop-segmented-control">
      {(["paraphrase", "mixed", "translate"] as ReaderMode[]).map((option) => (
        <button
          key={option}
          type="button"
          className={`segment ${mode === option ? "active" : ""}`}
          disabled={disabled}
          onClick={() => {
            onChange(option);
          }}
        >
          {MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
