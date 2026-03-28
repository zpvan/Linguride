import {
  OpenAIOAuthErrorCode,
  OpenAIOAuthStatus,
} from "../types";

const OPENAI_OAUTH_STORAGE_KEY = "lingrid_auth";
const OPENAI_OAUTH_PENDING_STORAGE_KEY = "lingrid_auth_pending";
const OPENAI_OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;
const OPENAI_OAUTH_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_OAUTH_REDIRECT_URI = "http://localhost:1455/auth/callback";
const OPENAI_OAUTH_SCOPE = "openid profile email offline_access";
const OPENAI_AUTH_CLAIM_NAMESPACE = "https://api.openai.com/auth";
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30 * 1000;

interface OpenAICodexAuthStorage {
  openai_codex?: OpenAICodexOAuthCredentials;
}

interface OpenAICodexPendingAuth {
  verifier: string;
  state: string;
  created_at: number;
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface ParsedOAuthCallback {
  code?: string;
  state?: string;
}

interface OpenAIOAuthClaimPayload {
  chatgpt_account_id?: string;
}

type DecodedJwtPayload = Record<string, unknown> & {
  "https://api.openai.com/auth"?: OpenAIOAuthClaimPayload;
};

export interface OpenAICodexOAuthCredentials {
  type: "oauth";
  provider: "openai-codex";
  access: string;
  refresh: string;
  expires: number;
  account_id: string;
}

export interface OpenAICodexOAuthStatusData {
  status: OpenAIOAuthStatus;
  expiresAt?: number;
  accountId?: string;
}

export class OpenAICodexAuthError extends Error {
  readonly code: OpenAIOAuthErrorCode;

  constructor(code: OpenAIOAuthErrorCode, message: string) {
    super(message);
    this.name = "OpenAICodexAuthError";
    this.code = code;
  }
}

let refreshPromise: Promise<OpenAICodexOAuthCredentials> | null = null;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateRandomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return encodeBase64Url(new Uint8Array(digest));
}

function decodeJwtPayload(token?: string): DecodedJwtPayload | null {
  if (!token) {
    return null;
  }

  try {
    const segments = token.split(".");
    if (segments.length < 2) {
      return null;
    }

    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json) as DecodedJwtPayload;
  } catch {
    return null;
  }
}

function extractAccountIdFromJwt(token?: string): string | null {
  const payload = decodeJwtPayload(token);
  const accountId = payload?.[OPENAI_AUTH_CLAIM_NAMESPACE]?.chatgpt_account_id;
  return typeof accountId === "string" && accountId.trim()
    ? accountId.trim()
    : null;
}

function normalizeExpiry(expiresInSeconds?: number): number {
  const expiresInMs = Math.max((expiresInSeconds || 0) * 1000, 0);
  return Date.now() + expiresInMs;
}

function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS;
}

async function getStoredAuthState(): Promise<OpenAICodexAuthStorage> {
  const result = await chrome.storage.local.get(OPENAI_OAUTH_STORAGE_KEY);
  return (result[OPENAI_OAUTH_STORAGE_KEY] as OpenAICodexAuthStorage) || {};
}

async function getStoredCredentials(): Promise<OpenAICodexOAuthCredentials | null> {
  const state = await getStoredAuthState();
  return state.openai_codex || null;
}

async function saveStoredCredentials(
  credentials: OpenAICodexOAuthCredentials
): Promise<void> {
  const state: OpenAICodexAuthStorage = {
    openai_codex: credentials,
  };
  await chrome.storage.local.set({ [OPENAI_OAUTH_STORAGE_KEY]: state });
}

async function clearStoredCredentials(): Promise<void> {
  await chrome.storage.local.remove(OPENAI_OAUTH_STORAGE_KEY);
}

async function getStoredPendingAuth(): Promise<OpenAICodexPendingAuth | null> {
  const result = await chrome.storage.session.get(OPENAI_OAUTH_PENDING_STORAGE_KEY);
  const pending = result[
    OPENAI_OAUTH_PENDING_STORAGE_KEY
  ] as OpenAICodexPendingAuth | undefined;

  if (!pending) {
    return null;
  }

  if (Date.now() - pending.created_at > OPENAI_OAUTH_PENDING_TTL_MS) {
    await chrome.storage.session.remove(OPENAI_OAUTH_PENDING_STORAGE_KEY);
    return null;
  }

  return pending;
}

async function savePendingAuth(pending: OpenAICodexPendingAuth): Promise<void> {
  await chrome.storage.session.set({
    [OPENAI_OAUTH_PENDING_STORAGE_KEY]: pending,
  });
}

async function clearPendingAuth(): Promise<void> {
  await chrome.storage.session.remove(OPENAI_OAUTH_PENDING_STORAGE_KEY);
}

function parseOAuthCallbackInput(callbackInput: string): ParsedOAuthCallback {
  const trimmedInput = callbackInput.trim();

  if (!trimmedInput) {
    return {};
  }

  if (trimmedInput.includes("code=")) {
    try {
      const url = trimmedInput.startsWith("http")
        ? new URL(trimmedInput)
        : new URL(
            trimmedInput.startsWith("?")
              ? `${OPENAI_OAUTH_REDIRECT_URI}${trimmedInput}`
              : `${OPENAI_OAUTH_REDIRECT_URI}?${trimmedInput}`
          );
      return {
        code: url.searchParams.get("code") || undefined,
        state: url.searchParams.get("state") || undefined,
      };
    } catch {
      const params = new URLSearchParams(
        trimmedInput.startsWith("?") ? trimmedInput.slice(1) : trimmedInput
      );
      return {
        code: params.get("code") || undefined,
        state: params.get("state") || undefined,
      };
    }
  }

  if (trimmedInput.includes("#")) {
    const [code, state] = trimmedInput.split("#", 2);
    return {
      code: code || undefined,
      state: state || undefined,
    };
  }

  return { code: trimmedInput };
}

async function exchangeToken(
  params: Record<string, string>
): Promise<OAuthTokenResponse> {
  const response = await fetch(OPENAI_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  const responseText = await response.text();
  let data: OAuthTokenResponse;

  try {
    data = JSON.parse(responseText) as OAuthTokenResponse;
  } catch {
    throw new OpenAICodexAuthError(
      "TOKEN_EXCHANGE_FAILED",
      responseText || "OpenAI OAuth token exchange failed"
    );
  }

  if (!response.ok || data.error || !data.access_token) {
    throw new OpenAICodexAuthError(
      "TOKEN_EXCHANGE_FAILED",
      data.error_description ||
        data.error ||
        response.statusText ||
        "OpenAI OAuth token exchange failed"
    );
  }

  return data;
}

function buildCredentials(
  tokenResponse: OAuthTokenResponse,
  fallbackRefreshToken?: string,
  fallbackAccountId?: string
): OpenAICodexOAuthCredentials {
  const access = tokenResponse.access_token?.trim();
  const refresh =
    tokenResponse.refresh_token?.trim() || fallbackRefreshToken?.trim();
  const accountId =
    extractAccountIdFromJwt(tokenResponse.id_token) ||
    extractAccountIdFromJwt(tokenResponse.access_token) ||
    fallbackAccountId?.trim() ||
    "";

  if (!access || !refresh || !accountId) {
    throw new OpenAICodexAuthError(
      "TOKEN_EXCHANGE_FAILED",
      "OpenAI OAuth 返回的凭据不完整"
    );
  }

  return {
    type: "oauth",
    provider: "openai-codex",
    access,
    refresh,
    expires: normalizeExpiry(tokenResponse.expires_in),
    account_id: accountId,
  };
}

async function refreshCredentialsInternal(
  currentCredentials: OpenAICodexOAuthCredentials
): Promise<OpenAICodexOAuthCredentials> {
  try {
    const tokenResponse = await exchangeToken({
      grant_type: "refresh_token",
      client_id: OPENAI_OAUTH_CLIENT_ID,
      refresh_token: currentCredentials.refresh,
    });

    const nextCredentials = buildCredentials(
      tokenResponse,
      currentCredentials.refresh,
      currentCredentials.account_id
    );
    await saveStoredCredentials(nextCredentials);
    return nextCredentials;
  } catch (error) {
    if (error instanceof OpenAICodexAuthError) {
      await clearStoredCredentials();
      throw new OpenAICodexAuthError(
        "OAUTH_NOT_CONNECTED",
        "请重新登录 OpenAI OAuth"
      );
    }

    throw error;
  }
}

async function refreshCredentials(
  currentCredentials: OpenAICodexOAuthCredentials
): Promise<OpenAICodexOAuthCredentials> {
  if (!refreshPromise) {
    refreshPromise = refreshCredentialsInternal(currentCredentials).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function startOpenAICodexOAuth(): Promise<{
  authorizeUrl: string;
  pending: true;
}> {
  const verifier = generateRandomBase64Url(64);
  const state = generateRandomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);

  await savePendingAuth({
    verifier,
    state,
    created_at: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: OPENAI_OAUTH_CLIENT_ID,
    redirect_uri: OPENAI_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: OPENAI_OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "pi",
  });

  return {
    authorizeUrl: `${OPENAI_OAUTH_AUTHORIZE_URL}?${params.toString()}`,
    pending: true,
  };
}

export async function completeOpenAICodexOAuth(callbackInput: string): Promise<{
  connected: true;
  expiresAt: number;
  accountId: string;
}> {
  const pending = await getStoredPendingAuth();
  if (!pending) {
    throw new OpenAICodexAuthError(
      "OAUTH_NOT_CONNECTED",
      "登录已过期，请重新开始 OpenAI OAuth"
    );
  }

  const parsed = parseOAuthCallbackInput(callbackInput);
  if (!parsed.code) {
    throw new OpenAICodexAuthError(
      "MISSING_CODE",
      "未从回调内容中解析出授权 code"
    );
  }

  if (parsed.state && parsed.state !== pending.state) {
    throw new OpenAICodexAuthError(
      "STATE_MISMATCH",
      "OpenAI OAuth state 校验失败，请重新登录"
    );
  }

  const tokenResponse = await exchangeToken({
    grant_type: "authorization_code",
    client_id: OPENAI_OAUTH_CLIENT_ID,
    redirect_uri: OPENAI_OAUTH_REDIRECT_URI,
    code: parsed.code,
    code_verifier: pending.verifier,
  });

  const credentials = buildCredentials(tokenResponse);
  await saveStoredCredentials(credentials);
  await clearPendingAuth();

  return {
    connected: true,
    expiresAt: credentials.expires,
    accountId: credentials.account_id,
  };
}

export async function getOpenAICodexOAuthStatus(): Promise<OpenAICodexOAuthStatusData> {
  const credentials = await getStoredCredentials();
  if (credentials) {
    return {
      status: isExpired(credentials.expires) ? "expired" : "connected",
      expiresAt: credentials.expires,
      accountId: credentials.account_id,
    };
  }

  const pending = await getStoredPendingAuth();
  if (pending) {
    return { status: "pending" };
  }

  return { status: "missing" };
}

export async function disconnectOpenAICodexOAuth(): Promise<void> {
  await clearPendingAuth();
  await clearStoredCredentials();
}

export async function getOpenAICodexOAuthCredentials(options?: {
  forceRefresh?: boolean;
}): Promise<OpenAICodexOAuthCredentials> {
  const credentials = await getStoredCredentials();

  if (!credentials) {
    throw new OpenAICodexAuthError(
      "OAUTH_NOT_CONNECTED",
      "请先完成 OpenAI OAuth 登录"
    );
  }

  if (options?.forceRefresh || isExpired(credentials.expires)) {
    return refreshCredentials(credentials);
  }

  return credentials;
}
