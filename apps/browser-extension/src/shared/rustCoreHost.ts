export interface RustCoreHost {
  version(): Promise<string>;
  analyzeCaptureText(text: string, title?: string): Promise<string>;
  ingestHandoff(jsonPayload: string): Promise<string>;
}

interface GeneratedWebCoreModule {
  default(
    input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module
  ): Promise<unknown>;
  core_version(): string;
  analyze_capture_text(text: string, title?: string | null): string;
  ingest_handoff(jsonPayload: string): string;
}

let cachedHost: Promise<RustCoreHost> | null = null;

export function loadRustCoreHost(): Promise<RustCoreHost> {
  if (!cachedHost) {
    cachedHost = createRustCoreHost();
  }

  return cachedHost;
}

async function createRustCoreHost(): Promise<RustCoreHost> {
  const moduleUrl = resolveRuntimeUrl("web-core/web_core.js");
  const wasmUrl = resolveRuntimeUrl("web-core/web_core_bg.wasm");
  const webCore = (await import(/* @vite-ignore */ moduleUrl)) as GeneratedWebCoreModule;

  await webCore.default(wasmUrl);

  return {
    async version() {
      return webCore.core_version();
    },
    async analyzeCaptureText(text, title) {
      return webCore.analyze_capture_text(text, title ?? null);
    },
    async ingestHandoff(jsonPayload) {
      return webCore.ingest_handoff(jsonPayload);
    },
  };
}

function resolveRuntimeUrl(relativePath: string): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relativePath);
  }

  return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
}
