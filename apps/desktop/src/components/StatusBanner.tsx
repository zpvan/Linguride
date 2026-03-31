import type { StatusBannerState } from "../types/ui";

interface StatusBannerProps {
  banner: StatusBannerState | null;
}

export function StatusBanner({ banner }: StatusBannerProps) {
  if (!banner) {
    return null;
  }

  return (
    <div className={`status-banner ${banner.tone}`} role="status">
      <strong>{banner.title}</strong>
      <span>{banner.message}</span>
    </div>
  );
}
