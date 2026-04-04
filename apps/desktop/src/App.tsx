import { useEffect, useState } from "react";

import { AppShell } from "./components/AppShell";
import { ContextPanel } from "./components/ContextPanel";
import { desktopCapabilities } from "./lib/capabilities";
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
import { HomeView } from "./views/HomeView";
import { ReaderView } from "./views/ReaderView";
import { ReviewView } from "./views/ReviewView";
import { SettingsView } from "./views/SettingsView";
import "./App.css";

const SAMPLE_CAPTURE = `Reading in a second language becomes easier when the text is just slightly above your comfort zone.
You do not need perfect understanding on the first pass. What matters is repeated contact with real sentences, clear feedback on what blocks you, and a short loop that turns input into something you can notice again tomorrow.`;

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [activeView, setActiveView] = useState<DesktopView>("home");
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("loading");
  const [selectedCaptureId, setSelectedCaptureId] = useState("");
  const [readerResult, setReaderResult] = useState<ReaderResult | null>(null);
  const [captureDraft, setCaptureDraft] = useState(SAMPLE_CAPTURE);
  const [titleDraft, setTitleDraft] = useState("Why Reading Still Matters");
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
      const defaultView = options?.nextView || "home";

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
  const sessionCount = workspace?.sessions.length ?? 0;
  const mainContent = renderMainView();

  return (
    <AppShell
      activeView={activeView}
      captures={workspace?.captures ?? []}
      selectedCaptureId={selectedCaptureId}
      currentLevel={currentLevel}
      capabilities={desktopCapabilities}
      workspaceStatus={workspaceStatus}
      sessionCount={sessionCount}
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
          selectedCaptureId={selectedCaptureId}
          onModeChange={(nextMode) => {
            void handleModeChange(nextMode);
          }}
          onSelectView={handleSelectView}
          onSelectCapture={(capture) => {
            void handleSelectCapture(capture);
          }}
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
            onOpenReview={() => {
              setActiveView("review");
            }}
          />
        );
      case "review":
        return (
          <ReviewView
            readerResult={readerResult}
            isLoading={isLoading}
            isRunningReader={isRunningReader}
            onGoToReader={() => {
              setActiveView("reader");
            }}
            onGoHome={() => {
              setActiveView("home");
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
            onOpenReview={() => {
              setActiveView("review");
            }}
          />
        );
      case "home":
      default:
        return (
          <HomeView
            titleDraft={titleDraft}
            captureDraft={captureDraft}
            isSavingCapture={isSavingCapture}
            fileImportEnabled={desktopCapabilities.fileImport}
            captures={workspace?.captures ?? []}
            sessions={workspace?.sessions ?? []}
            selectedCaptureId={selectedCaptureId}
            currentLevel={currentLevel}
            defaultMode={mode}
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

  if (input.activeView === "reader" && !input.readerResult) {
    return "empty";
  }

  if (input.activeView === "review" && !input.readerResult) {
    return "empty";
  }

  if (input.activeView === "home" && !(input.workspace?.captures.length ?? 0)) {
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
    case "home":
      return {
        title: "Today",
        subtitle:
          workspace?.captures.length
            ? "继续最近一段材料，或者把新的文本带进今天的输入循环。"
            : "从一段真实文本开始，先建立你的桌面学习工作区。",
      };
    case "reader":
      return {
        title: "Reader",
        subtitle: readerResult
          ? `当前材料：${readerResult.document.title}`
          : "并排阅读原文与输出，把内容快速读透。",
      };
    case "review":
      return {
        title: "Review",
        subtitle: readerResult
          ? "把这次输入收拢成难点、亮点和下一步练习。"
          : "先让 Reader 处理一段材料，再回来复盘。",
      };
    case "settings":
      return {
        title: "Preferences",
        subtitle: "维护模型连接、学习级别和桌面偏好。",
      };
    default:
      return {
        title: "Today",
        subtitle: "继续最近一段材料，或者导入新的文本。",
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
