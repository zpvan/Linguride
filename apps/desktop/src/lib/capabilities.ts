import type { DesktopCapabilities, DesktopView } from "../types/ui";

export const desktopCapabilities: DesktopCapabilities = {
  reader: true,
  tutor: false,
  corpus: false,
  handoff: true,
  fileImport: false,
};

export function isViewUnavailable(
  view: DesktopView,
  capabilities: DesktopCapabilities
): boolean {
  if (view === "tutor") {
    return !capabilities.tutor;
  }

  if (view === "corpus") {
    return !capabilities.corpus;
  }

  return false;
}
