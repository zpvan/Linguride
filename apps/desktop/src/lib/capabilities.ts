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
  void view;
  void capabilities;
  return false;
}
