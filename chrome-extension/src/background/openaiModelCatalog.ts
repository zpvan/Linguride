import {
  LingridConfig,
  OpenAIModelCatalogResponseData,
  OpenAIModelCatalogScope,
  OpenAIModelCatalogVerificationState,
  OpenAIModelItem,
  resolveConfigApiProvider,
  resolveConfigOpenAIAuthMode,
} from "../types";

const OPENAI_MODEL_CATALOG_STORAGE_KEY = "openai_model_catalog_cache";
const OPENAI_MODELS_PAGE_URL = "https://developers.openai.com/api/docs/models/all";
const OPENAI_MODELS_API_URL = "https://api.openai.com/v1/models";
const OPENAI_MODEL_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;
const OPENAI_MODEL_CATALOG_RETRY_BACKOFF_MS = 5 * 60 * 1000;
const OPENAI_MODEL_FETCH_TIMEOUT_MS = 15000;
const OPENAI_CHAT_COMPLETIONS_ALLOWLIST = [
  "gpt-5.4",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.3-codex",
  "gpt-5.1-codex-mini",
] as const;
const DEFAULT_CODEX_ID_PATTERN = /^gpt-(\d+(?:\.\d+)*)-codex$/;

type StoredOpenAIModelCatalog = Omit<OpenAIModelCatalogResponseData, "stale">;

interface ParsedDocsModelItem {
  id: string;
  label: string;
  section: string;
  deprecated: boolean;
}

interface DocsCatalogCache {
  items: ParsedDocsModelItem[];
  fetchedAt: number;
  expiresAt: number;
}

interface OpenAIModelCatalogCacheStore {
  version: 1;
  docsCatalogCache?: DocsCatalogCache;
  resolvedCatalogCache?: {
    apiByKey?: Record<string, StoredOpenAIModelCatalog>;
    preview?: StoredOpenAIModelCatalog;
    oauth?: StoredOpenAIModelCatalog;
  };
}

interface OpenAIListModelsResponse {
  data?: Array<{
    id?: string;
  }>;
  error?: {
    message?: string;
  };
}

const SECTION_PRIORITY: Record<string, number> = {
  Coding: 0,
  "Frontier models": 1,
  "More models": 2,
  "ChatGPT models": 3,
};

let docsRefreshPromise: Promise<DocsCatalogCache> | null = null;
const resolvedRefreshPromises = new Map<
  string,
  Promise<OpenAIModelCatalogResponseData>
>();

function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "OpenAI 模型目录同步失败";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function normalizeModelLabel(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+\(Deprecated\)$/i, "").trim();
}

function buildStoredCatalog(
  scope: OpenAIModelCatalogScope,
  items: OpenAIModelItem[],
  verificationState: OpenAIModelCatalogVerificationState,
  fetchedAt: number,
  expiresAt: number,
  lastError?: string
): StoredOpenAIModelCatalog {
  return {
    items,
    fetchedAt,
    expiresAt,
    lastError,
    scope,
    verificationState,
  };
}

function toResponseData(
  catalog: StoredOpenAIModelCatalog,
  stale = false
): OpenAIModelCatalogResponseData {
  return {
    ...catalog,
    stale,
  };
}

async function readCatalogCacheStore(): Promise<OpenAIModelCatalogCacheStore> {
  const result = await chrome.storage.local.get(OPENAI_MODEL_CATALOG_STORAGE_KEY);
  return (
    result[OPENAI_MODEL_CATALOG_STORAGE_KEY] as OpenAIModelCatalogCacheStore
  ) || {
    version: 1,
  };
}

async function writeCatalogCacheStore(
  store: OpenAIModelCatalogCacheStore
): Promise<void> {
  await chrome.storage.local.set({
    [OPENAI_MODEL_CATALOG_STORAGE_KEY]: store,
  });
}

function getSectionPriority(section: string): number {
  return SECTION_PRIORITY[section] ?? 9;
}

function parseOfficialModelsPage(html: string): ParsedDocsModelItem[] {
  const sectionMatches = Array.from(
    html.matchAll(
      /<div id="([^"]+)" class="scroll-mt-24 flex flex-col gap-8"><div class="flex flex-col gap-2 md:flex-row md:items-center"><div class="text-lg font-semibold whitespace-nowrap">([^<]+)<\/div>/g
    )
  );

  if (sectionMatches.length === 0) {
    throw new Error("未能识别 OpenAI 官方模型页分组");
  }

  const itemsById = new Map<string, ParsedDocsModelItem>();

  sectionMatches.forEach((match, index) => {
    const section = decodeHtmlEntities(match[2] || "").trim();
    if (!section) {
      return;
    }

    const startIndex = match.index ?? 0;
    const nextIndex =
      index + 1 < sectionMatches.length
        ? sectionMatches[index + 1].index ?? html.length
        : html.length;
    const sectionHtml = html.slice(startIndex, nextIndex);

    const anchorMatches = Array.from(
      sectionHtml.matchAll(
        /<a href="(\/api\/docs\/models\/[^"]+)" class="flex h-full flex-col gap-4 text-emphasis hover:text-emphasis">([\s\S]*?)<\/a>/g
      )
    );

    anchorMatches.forEach((anchorMatch) => {
      const href = anchorMatch[1] || "";
      const anchorHtml = anchorMatch[2] || "";
      const hrefParts = href.split("/");
      const slug = hrefParts[hrefParts.length - 1]?.trim();
      const altMatch = anchorHtml.match(/alt="([^"]+)"/);
      const id = decodeHtmlEntities(altMatch?.[1] || slug || "").trim();

      if (!id) {
        return;
      }

      const titleMatch = anchorHtml.match(/<div class="font-semibold">([^<]+)<\/div>/);
      const label = normalizeModelLabel(titleMatch?.[1] || id);
      const deprecated =
        anchorHtml.includes(">Deprecated<") || /\(Deprecated\)/i.test(label);
      const nextItem: ParsedDocsModelItem = {
        id,
        label,
        section,
        deprecated,
      };
      const previousItem = itemsById.get(id);

      if (
        !previousItem ||
        getSectionPriority(nextItem.section) < getSectionPriority(previousItem.section)
      ) {
        itemsById.set(id, nextItem);
      }
    });
  });

  const parsedItems = Array.from(itemsById.values());
  const hasFrontier = parsedItems.some(
    (item) => item.section === "Frontier models"
  );
  const hasCoding = parsedItems.some((item) => item.section === "Coding");

  if (!hasFrontier || !hasCoding) {
    throw new Error("OpenAI 官方模型页分组不完整，已跳过覆盖本地缓存");
  }

  return parsedItems;
}

async function refreshDocsCatalog(): Promise<DocsCatalogCache> {
  if (!docsRefreshPromise) {
    docsRefreshPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OPENAI_MODEL_FETCH_TIMEOUT_MS
      );

      try {
        const response = await fetch(OPENAI_MODELS_PAGE_URL, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`获取官方模型页失败 (${response.status})`);
        }

        const html = await response.text();
        const items = parseOfficialModelsPage(html);
        const nextCache: DocsCatalogCache = {
          items,
          fetchedAt: Date.now(),
          expiresAt: Date.now() + OPENAI_MODEL_CATALOG_TTL_MS,
        };

        const store = await readCatalogCacheStore();
        await writeCatalogCacheStore({
          ...store,
          docsCatalogCache: nextCache,
        });

        return nextCache;
      } finally {
        clearTimeout(timeoutId);
      }
    })().finally(() => {
      docsRefreshPromise = null;
    });
  }

  return docsRefreshPromise;
}

async function resolveDocsCatalog(forceRefresh: boolean): Promise<{
  cache: DocsCatalogCache;
  lastError?: string;
}> {
  const store = await readCatalogCacheStore();
  const cachedDocs = store.docsCatalogCache;

  if (!forceRefresh && cachedDocs && !isExpired(cachedDocs.expiresAt)) {
    return { cache: cachedDocs };
  }

  try {
    const refreshed = await refreshDocsCatalog();
    return { cache: refreshed };
  } catch (error) {
    if (cachedDocs?.items?.length) {
      return {
        cache: cachedDocs,
        lastError: getErrorMessage(error),
      };
    }

    throw error;
  }
}

function filterAndMapApiPreviewItems(
  docsItems: ParsedDocsModelItem[]
): OpenAIModelItem[] {
  const docsItemMap = new Map(docsItems.map((item) => [item.id, item]));

  return OPENAI_CHAT_COMPLETIONS_ALLOWLIST
    .map((id) => docsItemMap.get(id))
    .filter((item): item is ParsedDocsModelItem => Boolean(item))
    .filter((item) => !item.deprecated && item.section !== "ChatGPT models")
    .map((item) => ({
      id: item.id,
      label: item.label,
      channel: "api" as const,
      section: item.section,
      deprecated: item.deprecated,
      source: "docs" as const,
    }));
}

function compareVersionSegments(a: number[], b: number[]): number {
  const maxLength = Math.max(a.length, b.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;

    if (left !== right) {
      return left - right;
    }
  }

  return 0;
}

function getDefaultCodexVersionSegments(id: string): number[] | null {
  const match = id.match(DEFAULT_CODEX_ID_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  return match[1]
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment));
}

function filterAndMapOAuthItems(
  docsItems: ParsedDocsModelItem[]
): OpenAIModelItem[] {
  const codingItems = docsItems.filter(
    (item) =>
      item.section === "Coding" &&
      !item.deprecated &&
      item.id.startsWith("gpt-") &&
      item.id.includes("codex")
  );

  const defaultCodexItems = codingItems.filter((item) =>
    DEFAULT_CODEX_ID_PATTERN.test(item.id)
  );
  const newestDefaultCodexItem = defaultCodexItems.sort((left, right) => {
    const leftVersion = getDefaultCodexVersionSegments(left.id) || [];
    const rightVersion = getDefaultCodexVersionSegments(right.id) || [];
    return compareVersionSegments(rightVersion, leftVersion);
  })[0];

  const nextItems = codingItems
    .filter((item) => !DEFAULT_CODEX_ID_PATTERN.test(item.id))
    .sort((left, right) => left.label.localeCompare(right.label, "en"))
    .map((item) => ({
      id: item.id,
      label: item.label,
      channel: "oauth" as const,
      section: item.section,
      deprecated: item.deprecated,
      source: "docs" as const,
    }));

  if (newestDefaultCodexItem) {
    nextItems.unshift({
      id: newestDefaultCodexItem.id,
      label: newestDefaultCodexItem.label,
      channel: "oauth",
      section: newestDefaultCodexItem.section,
      deprecated: newestDefaultCodexItem.deprecated,
      source: "docs",
    });
  }

  return nextItems;
}

async function hashApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchVisibleOpenAIModelIds(apiKey: string): Promise<Set<string>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OPENAI_MODEL_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(OPENAI_MODELS_API_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const responseText = await response.text();
    let data: OpenAIListModelsResponse = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText) as OpenAIListModelsResponse;
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      throw new Error(
        data.error?.message || `OpenAI /v1/models 请求失败 (${response.status})`
      );
    }

    return new Set(
      (data.data || [])
        .map((item) => item.id?.trim())
        .filter((id): id is string => Boolean(id))
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function getScopeFromConfig(config: LingridConfig): OpenAIModelCatalogScope {
  if (resolveConfigApiProvider(config) !== "openai") {
    throw new Error("当前未启用 OpenAI 服务");
  }

  return resolveConfigOpenAIAuthMode(config) === "oauth" ? "oauth" : "api";
}

async function getCacheKeyForConfig(
  config: LingridConfig
): Promise<{
  scope: OpenAIModelCatalogScope;
  cacheKey: string;
}> {
  const scope = getScopeFromConfig(config);

  if (scope === "oauth") {
    return {
      scope,
      cacheKey: "oauth",
    };
  }

  const apiKey = config.api_key?.trim() || "";
  if (!apiKey) {
    return {
      scope,
      cacheKey: "preview",
    };
  }

  return {
    scope,
    cacheKey: await hashApiKey(apiKey),
  };
}

function getStoredResolvedCatalog(
  store: OpenAIModelCatalogCacheStore,
  scope: OpenAIModelCatalogScope,
  cacheKey: string
): StoredOpenAIModelCatalog | undefined {
  if (scope === "oauth") {
    return store.resolvedCatalogCache?.oauth;
  }

  if (cacheKey === "preview") {
    return store.resolvedCatalogCache?.preview;
  }

  return store.resolvedCatalogCache?.apiByKey?.[cacheKey];
}

async function saveStoredResolvedCatalog(
  scope: OpenAIModelCatalogScope,
  cacheKey: string,
  catalog: StoredOpenAIModelCatalog
): Promise<void> {
  const store = await readCatalogCacheStore();
  const resolvedCatalogCache = {
    apiByKey: {
      ...(store.resolvedCatalogCache?.apiByKey || {}),
    },
    preview: store.resolvedCatalogCache?.preview,
    oauth: store.resolvedCatalogCache?.oauth,
  };

  if (scope === "oauth") {
    resolvedCatalogCache.oauth = catalog;
  } else if (cacheKey === "preview") {
    resolvedCatalogCache.preview = catalog;
  } else {
    resolvedCatalogCache.apiByKey[cacheKey] = catalog;
  }

  await writeCatalogCacheStore({
    ...store,
    resolvedCatalogCache,
  });
}

async function buildApiCatalog(
  docsItems: ParsedDocsModelItem[],
  config: LingridConfig,
  existingCatalog?: StoredOpenAIModelCatalog,
  docsError?: string
): Promise<{
  storedCatalog: StoredOpenAIModelCatalog;
  stale: boolean;
}> {
  const previewItems = filterAndMapApiPreviewItems(docsItems);
  if (previewItems.length === 0) {
    throw new Error("官方模型页中未找到可用于 Chat Completions 的 OpenAI 模型");
  }

  const previewCatalog = buildStoredCatalog(
    "api",
    previewItems,
    "docs_only",
    Date.now(),
    Date.now() + OPENAI_MODEL_CATALOG_TTL_MS,
    docsError
  );
  const apiKey = config.api_key?.trim() || "";

  if (!apiKey) {
    return {
      storedCatalog: previewCatalog,
      stale: false,
    };
  }

  try {
    const visibleIds = await fetchVisibleOpenAIModelIds(apiKey);
    const verifiedItems = previewItems
      .filter((item) => visibleIds.has(item.id))
      .map((item) => ({
        ...item,
        source: "docs+api" as const,
      }));

    return {
      storedCatalog: buildStoredCatalog(
        "api",
        verifiedItems,
        "verified_by_api_key",
        Date.now(),
        Date.now() + OPENAI_MODEL_CATALOG_TTL_MS,
        docsError
      ),
      stale: false,
    };
  } catch (error) {
    const lastError = getErrorMessage(error);

    if (
      existingCatalog?.verificationState === "verified_by_api_key" &&
      existingCatalog.items.length > 0
    ) {
      return {
        storedCatalog: {
          ...existingCatalog,
          expiresAt: Date.now() + OPENAI_MODEL_CATALOG_RETRY_BACKOFF_MS,
          lastError,
        },
        stale: true,
      };
    }

    return {
      storedCatalog: {
        ...previewCatalog,
        expiresAt: Date.now() + OPENAI_MODEL_CATALOG_RETRY_BACKOFF_MS,
        lastError,
      },
      stale: false,
    };
  }
}

function buildOAuthCatalog(
  docsItems: ParsedDocsModelItem[],
  docsError?: string
): StoredOpenAIModelCatalog {
  const oauthItems = filterAndMapOAuthItems(docsItems);

  if (oauthItems.length === 0) {
    throw new Error("官方模型页中未找到可用的 Codex 模型");
  }

  return buildStoredCatalog(
    "oauth",
    oauthItems,
    "docs_only",
    Date.now(),
    Date.now() + OPENAI_MODEL_CATALOG_TTL_MS,
    docsError
  );
}

async function refreshOpenAIModelCatalogInternal(
  config: LingridConfig,
  scope: OpenAIModelCatalogScope,
  cacheKey: string
): Promise<OpenAIModelCatalogResponseData> {
  const promiseKey = `${scope}:${cacheKey}`;
  const existingPromise = resolvedRefreshPromises.get(promiseKey);

  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async () => {
    const store = await readCatalogCacheStore();
    const existingCatalog = getStoredResolvedCatalog(store, scope, cacheKey);
    const { cache: docsCache, lastError: docsError } = await resolveDocsCatalog(
      true
    );

    const { storedCatalog, stale } =
      scope === "oauth"
        ? {
            storedCatalog: buildOAuthCatalog(docsCache.items, docsError),
            stale: false,
          }
        : await buildApiCatalog(
            docsCache.items,
            config,
            existingCatalog,
            docsError
          );

    await saveStoredResolvedCatalog(scope, cacheKey, storedCatalog);
    return toResponseData(storedCatalog, stale);
  })().finally(() => {
    resolvedRefreshPromises.delete(promiseKey);
  });

  resolvedRefreshPromises.set(promiseKey, refreshPromise);
  return refreshPromise;
}

export async function getOpenAIModelCatalog(
  config: LingridConfig
): Promise<OpenAIModelCatalogResponseData> {
  const { scope, cacheKey } = await getCacheKeyForConfig(config);
  const store = await readCatalogCacheStore();
  const cachedCatalog = getStoredResolvedCatalog(store, scope, cacheKey);

  if (!cachedCatalog) {
    return refreshOpenAIModelCatalogInternal(config, scope, cacheKey);
  }

  if (!isExpired(cachedCatalog.expiresAt)) {
    return toResponseData(cachedCatalog, false);
  }

  void refreshOpenAIModelCatalogInternal(config, scope, cacheKey).catch(
    (error) => {
      console.warn("[Lingride] OpenAI 模型目录后台刷新失败:", error);
    }
  );

  return toResponseData(cachedCatalog, true);
}

export async function refreshOpenAIModelCatalog(
  config: LingridConfig
): Promise<OpenAIModelCatalogResponseData> {
  const { scope, cacheKey } = await getCacheKeyForConfig(config);
  return refreshOpenAIModelCatalogInternal(config, scope, cacheKey);
}
