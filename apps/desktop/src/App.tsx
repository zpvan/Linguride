import { useEffect, useState } from "react";

import { AppShell } from "./components/AppShell";
import { ContextPanel } from "./components/ContextPanel";
import { desktopCapabilities, isViewUnavailable } from "./lib/capabilities";
import {
  ingestManualCapture,
  loadWorkspaceSnapshot,
  runReaderCapture,
  saveWorkspaceConfig,
} from "./lib/rustCore";
import type {
  CaptureRecord,
  LingurideConfig,
  ReaderMode,
  ReaderResult,
  WorkspaceSnapshot,
} from "./types/rustCore";
import type {
  DesktopView,
  StatusBannerState,
  WorkspaceStatus,
} from "./types/ui";
import { CorpusView } from "./views/CorpusView";
import { InboxView } from "./views/InboxView";
import { ReaderView } from "./views/ReaderView";
import { SettingsView } from "./views/SettingsView";
import { TutorView } from "./views/TutorView";
import "./App.css";

const SAMPLE_CAPTURE = `Linguride is moving to a Rust-first core so the browser extension and desktop app can share the same business contracts.
The browser keeps a TypeScript shell for DOM, permissions, and UI, while the desktop app consumes the same reader workflow natively through Tauri.`;

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [activeView, setActiveView] = useState<DesktopView>("inbox");
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("loading");
  const [selectedCaptureId, setSelectedCaptureId] = useState("");
  const [readerResult, setReaderResult] = useState<ReaderResult | null>(null);
  const [captureDraft, setCaptureDraft] = useState(SAMPLE_CAPTURE);
  const [titleDraft, setTitleDraft] = useState("Rust-First Capture");
  const [mode, setMode] = useState<ReaderMode>("translate");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRunningReader, setIsRunningReader] = useState(false);
  const [banner, setBanner] = useState<StatusBannerState | null>(null);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  useEffect(() => {
    setWorkspaceStatus(
      deriveWorkspaceStatus({
        activeView,
        isLoading,
        workspace,
        readerResult,
      })
    );
  }, [activeView, isLoading, readerResult, workspace]);

  async function refreshWorkspace(options?: {
    selectedCaptureId?: string;
    nextView?: DesktopView;
  }) {
    setIsLoading(true);

    try {
      const snapshot = await loadWorkspaceSnapshot();
      const preferredCaptureId =
        options?.selectedCaptureId || selectedCaptureId || snapshot.captures[0]?.id || "";
      const defaultView =
        options?.nextView || (snapshot.captures.length > 0 ? "reader" : "inbox");

      setWorkspace(snapshot);
      setSelectedCaptureId(preferredCaptureId);
      setMode(snapshot.config.readerMode);
      setActiveView(defaultView);

      if (preferredCaptureId) {
        const nextReaderResult = await runReaderCapture(
          preferredCaptureId,
          snapshot.config.readerMode
        );
        setReaderResult(nextReaderResult);
      } else {
        setReaderResult(null);
      }
    } catch (refreshError) {
      setBanner(toErrorBanner(refreshError, "无法加载本地工作区"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCapture() {
    const nextText = captureDraft.trim();
    if (!nextText) {
      setBanner({
        tone: "warning",
        title: "缺少正文",
        message: "先粘贴一段文本，再导入到 Reader。",
      });
      return;
    }

    setIsSavingCapture(true);

    try {
      const capture = await ingestManualCapture({
        text: nextText,
        title: titleDraft.trim() || undefined,
      });
      setBanner({
        tone: "success",
        title: "导入完成",
        message: "新的 capture 已保存，并切换到 Reader。",
      });
      await refreshWorkspace({
        selectedCaptureId: capture.id,
        nextView: "reader",
      });
    } catch (createError) {
      setBanner(toErrorBanner(createError, "创建 capture 失败"));
    } finally {
      setIsSavingCapture(false);
    }
  }

  async function handleSelectCapture(capture: CaptureRecord) {
    setSelectedCaptureId(capture.id);
    setActiveView("reader");
    setIsRunningReader(true);

    try {
      const nextReaderResult = await runReaderCapture(capture.id, mode);
      setReaderResult(nextReaderResult);
    } catch (readerError) {
      setBanner(toErrorBanner(readerError, "运行 Reader 失败"));
    } finally {
      setIsRunningReader(false);
    }
  }

  async function handleModeChange(nextMode: ReaderMode) {
    setMode(nextMode);
    if (!workspace) {
      return;
    }

    const nextConfig: LingurideConfig = {
      ...workspace.config,
      readerMode: nextMode,
    };

    try {
      const savedConfig = await saveWorkspaceConfig(nextConfig);
      setWorkspace({
        ...workspace,
        config: savedConfig,
      });

      if (selectedCaptureId) {
        setIsRunningReader(true);
        const nextReaderResult = await runReaderCapture(selectedCaptureId, nextMode);
        setReaderResult(nextReaderResult);
      }
    } catch (saveError) {
      setBanner(toErrorBanner(saveError, "保存阅读模式失败"));
      setMode(workspace.config.readerMode);
    } finally {
      setIsRunningReader(false);
    }
  }

  async function handleSaveSettings(nextConfig: LingurideConfig) {
    if (!workspace) {
      return;
    }

    setIsSavingSettings(true);

    try {
      const savedConfig = await saveWorkspaceConfig(nextConfig);
      setWorkspace({
        ...workspace,
        config: savedConfig,
      });
      setMode(savedConfig.readerMode);

      if (selectedCaptureId) {
        setIsRunningReader(true);
        const nextReaderResult = await runReaderCapture(
          selectedCaptureId,
          savedConfig.readerMode
        );
        setReaderResult(nextReaderResult);
      }

      setBanner({
        tone: "success",
        title: "设置已保存",
        message: "当前桌面连接、级别和 Reader 默认模式已更新。",
      });
    } catch (saveError) {
      setBanner(toErrorBanner(saveError, "保存设置失败"));
    } finally {
      setIsSavingSettings(false);
      setIsRunningReader(false);
    }
  }

  function handleSelectView(nextView: DesktopView) {
    setActiveView(nextView);
  }

  const header = getViewHeader(activeView, workspace, readerResult);
  const currentLevel = workspace?.config.userLevel || "A2";
  const mainContent = renderMainView();

  return (
    <AppShell
      activeView={activeView}
      captures={workspace?.captures ?? []}
      selectedCaptureId={selectedCaptureId}
      currentLevel={currentLevel}
      capabilities={desktopCapabilities}
      workspaceStatus={workspaceStatus}
      title={header.title}
      subtitle={header.subtitle}
      banner={banner}
      onSelectView={handleSelectView}
      onSelectCapture={(capture) => {
        void handleSelectCapture(capture);
      }}
      main={mainContent}
      context={
        <ContextPanel
          activeView={activeView}
          workspace={workspace}
          readerResult={readerResult}
          mode={mode}
          isRunningReader={isRunningReader}
          workspaceStatus={workspaceStatus}
          capabilities={desktopCapabilities}
          onModeChange={(nextMode) => {
            void handleModeChange(nextMode);
          }}
          onSelectView={handleSelectView}
        />
      }
    />
  );

  function renderMainView() {
    switch (activeView) {
      case "reader":
        return (
          <ReaderView
            readerResult={readerResult}
            isLoading={isLoading}
            isRunningReader={isRunningReader}
          />
        );
      case "tutor":
        return (
          <TutorView
            onGoToReader={() => {
              setActiveView("reader");
            }}
            onGoToInbox={() => {
              setActiveView("inbox");
            }}
          />
        );
      case "corpus":
        return (
          <CorpusView
            onGoToReader={() => {
              setActiveView("reader");
            }}
            onGoToInbox={() => {
              setActiveView("inbox");
            }}
          />
        );
      case "settings":
        return workspace ? (
          <SettingsView
            config={workspace.config}
            isSaving={isSavingSettings}
            onSave={(nextConfig) => {
              void handleSaveSettings(nextConfig);
            }}
          />
        ) : (
          <ReaderView
            readerResult={null}
            isLoading={isLoading}
            isRunningReader={false}
          />
        );
      case "inbox":
      default:
        return (
          <InboxView
            titleDraft={titleDraft}
            captureDraft={captureDraft}
            isSavingCapture={isSavingCapture}
            fileImportEnabled={desktopCapabilities.fileImport}
            captures={workspace?.captures ?? []}
            selectedCaptureId={selectedCaptureId}
            onTitleChange={setTitleDraft}
            onCaptureChange={setCaptureDraft}
            onCreateCapture={() => {
              void handleCreateCapture();
            }}
            onLoadSample={() => {
              setCaptureDraft(SAMPLE_CAPTURE);
            }}
            onSelectCapture={(capture) => {
              void handleSelectCapture(capture);
            }}
          />
        );
    }
  }
}

function deriveWorkspaceStatus(input: {
  activeView: DesktopView;
  isLoading: boolean;
  workspace: WorkspaceSnapshot | null;
  readerResult: ReaderResult | null;
}): WorkspaceStatus {
  if (input.isLoading) {
    return "loading";
  }

  if (isViewUnavailable(input.activeView, desktopCapabilities)) {
    return "unavailable";
  }

  if (input.activeView === "reader" && !input.readerResult) {
    return "empty";
  }

  if (input.activeView === "inbox" && !(input.workspace?.captures.length ?? 0)) {
    return "empty";
  }

  return "ready";
}

function getViewHeader(
  activeView: DesktopView,
  workspace: WorkspaceSnapshot | null,
  readerResult: ReaderResult | null
) {
  switch (activeView) {
    case "reader":
      return {
        title: "Reader",
        subtitle: readerResult
          ? `当前正在阅读：${readerResult.document.title}`
          : "阅读、难度分析与学习建议。",
      };
    case "tutor":
      return {
        title: "Tutor",
        subtitle: "翻译、句法分析、发音与跟读的桌面入口。",
      };
    case "corpus":
      return {
        title: "Corpus",
        subtitle: "语料切分与听力分析的桌面入口。",
      };
    case "settings":
      return {
        title: "Settings",
        subtitle: "连接配置、用户级别与桌面偏好。",
      };
    case "inbox":
    default:
      return {
        title: "Inbox",
        subtitle:
          workspace?.captures.length
            ? "导入新文本，或继续最近一次的阅读。"
            : "从粘贴文本开始，建立你的本地工作区。",
      };
  }
}

function toErrorBanner(error: unknown, fallbackTitle: string): StatusBannerState {
  return {
    tone: "error",
    title: fallbackTitle,
    message: error instanceof Error ? error.message : "发生了未预期的错误。",
  };
}

export default App;
