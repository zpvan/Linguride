#!/usr/bin/env node
/**
 * @file diagnose-minimax-tts.mjs
 * @description MiniMax 异步语音合成（t2a_async_v2）可用性诊断脚本
 *
 * 用法：
 *   MINIMAX_API_KEY=xxx node scripts/diagnose-minimax-tts.mjs
 *   MINIMAX_API_KEY=xxx DIAGNOSE_SAMPLES=8 MINIMAX_TTS_MODEL=speech-2.8-hd node scripts/diagnose-minimax-tts.mjs
 *
 * 输出每次采样的各阶段耗时与最终汇总（成功率 / avg / p50 / max / 错误分布）。
 */

const API_BASE = (
  process.env.MINIMAX_TTS_BASE_URL || "https://api.minimaxi.com/v1"
).replace(/\/$/, "");
const API_KEY = process.env.MINIMAX_API_KEY?.trim();
const MODEL = process.env.MINIMAX_TTS_MODEL || "speech-2.8-turbo";
const SAMPLES = Number.parseInt(process.env.DIAGNOSE_SAMPLES || "5", 10);
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;
const SAMPLE_TEXT =
  "The quick brown fox jumps over the lazy dog near the riverbank.";

if (!API_KEY) {
  console.error("错误：请通过环境变量提供 MINIMAX_API_KEY");
  console.error(
    "用法：MINIMAX_API_KEY=xxx node scripts/diagnose-minimax-tts.mjs"
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timedFetch(url, init) {
  const startedAt = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, ok: response.ok, text, ms: Date.now() - startedAt };
}

function parseBaseResp(text) {
  try {
    const data = JSON.parse(text);
    return { data, statusCode: data?.base_resp?.status_code, statusMsg: data?.base_resp?.status_msg };
  } catch {
    return { data: null, statusCode: undefined, statusMsg: text.slice(0, 120) };
  }
}

async function createTask() {
  const { status, ok, text, ms } = await timedFetch(`${API_BASE}/t2a_async_v2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      text: SAMPLE_TEXT,
      language_boost: "auto",
      voice_setting: { voice_id: "English_expressive_narrator", speed: 1, vol: 1, pitch: 1 },
      audio_setting: { format: "mp3" },
    }),
  });
  const { data, statusCode, statusMsg } = parseBaseResp(text);
  if (!ok || statusCode !== 0 || !data?.task_id) {
    throw Object.assign(new Error(`创建任务失败 http=${status} code=${statusCode} msg=${statusMsg}`), { phase: "create" });
  }
  return { taskId: data.task_id, fileId: data.file_id, ms };
}

async function pollTask(taskId) {
  const startedAt = Date.now();
  const transitions = [];
  let polls = 0;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const { status, ok, text } = await timedFetch(
      `${API_BASE}/query/t2a_async_query_v2?task_id=${taskId}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );
    polls += 1;
    const { data, statusCode, statusMsg } = parseBaseResp(text);
    if (!ok || statusCode !== 0) {
      throw Object.assign(new Error(`查询失败 http=${status} code=${statusCode} msg=${statusMsg}`), { phase: "poll" });
    }
    const taskStatus = String(data?.status || "").toLowerCase();
    if (transitions[transitions.length - 1] !== taskStatus) transitions.push(taskStatus);
    if (taskStatus === "success") {
      const fileId = data?.file_id;
      if (!fileId) throw Object.assign(new Error("任务成功但无 file_id"), { phase: "poll" });
      return { fileId, ms: Date.now() - startedAt, polls, transitions };
    }
    if (taskStatus === "failed" || taskStatus === "expired") {
      throw Object.assign(new Error(`任务状态=${taskStatus}`), { phase: "poll" });
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw Object.assign(new Error(`轮询超时（${POLL_TIMEOUT_MS / 1000}s, ${polls} 次查询）`), { phase: "poll" });
}

async function downloadAudio(fileId) {
  const startedAt = Date.now();
  const response = await fetch(`${API_BASE}/files/retrieve_content?file_id=${fileId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`下载失败 http=${response.status} body=${text.slice(0, 120)}`), { phase: "download" });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw Object.assign(new Error("下载的音频为空"), { phase: "download" });
  }
  return { ms: Date.now() - startedAt, bytes: buffer.byteLength };
}

async function runSample(index) {
  const totalStart = Date.now();
  try {
    const created = await createTask();
    const polled = await pollTask(created.taskId);
    const downloaded = await downloadAudio(polled.fileId);
    return {
      index,
      success: true,
      createMs: created.ms,
      synthMs: polled.ms,
      downloadMs: downloaded.ms,
      totalMs: Date.now() - totalStart,
      polls: polled.polls,
      bytes: downloaded.bytes,
      transitions: polled.transitions.join("→"),
    };
  } catch (error) {
    return {
      index,
      success: false,
      totalMs: Date.now() - totalStart,
      phase: error.phase || "unknown",
      error: error.message,
    };
  }
}

const results = [];
console.log(`MiniMax TTS 诊断开始：模型=${MODEL} 采样=${SAMPLES} 次 端点=${API_BASE}\n`);
for (let i = 1; i <= SAMPLES; i++) {
  const result = await runSample(i);
  results.push(result);
  if (result.success) {
    console.log(
      `#${i} ✓ 总耗时 ${(result.totalMs / 1000).toFixed(1)}s（创建 ${result.createMs}ms / 合成 ${(result.synthMs / 1000).toFixed(1)}s (${result.polls}次轮询, ${result.transitions}) / 下载 ${result.downloadMs}ms, ${result.bytes}B）`
    );
  } else {
    console.log(`#${i} ✗ 阶段=${result.phase} 耗时 ${(result.totalMs / 1000).toFixed(1)}s 错误：${result.error}`);
  }
}

const successes = results.filter((r) => r.success);
const synthTimes = successes.map((r) => r.synthMs).sort((a, b) => a - b);
const totalTimes = successes.map((r) => r.totalMs).sort((a, b) => a - b);
const failureGroups = new Map();
for (const r of results.filter((r) => !r.success)) {
  const key = `${r.phase}: ${r.error}`;
  failureGroups.set(key, (failureGroups.get(key) || 0) + 1);
}

console.log("\n===== 汇总 =====");
console.log(`成功率：${successes.length}/${SAMPLES}`);
if (successes.length > 0) {
  const avg = (arr) => (arr.reduce((s, v) => s + v, 0) / arr.length / 1000).toFixed(1);
  console.log(`合成耗时 avg=${avg(synthTimes)}s p50=${(percentile(synthTimes, 50) / 1000).toFixed(1)}s max=${(percentile(synthTimes, 100) / 1000).toFixed(1)}s`);
  console.log(`总耗时   avg=${avg(totalTimes)}s p50=${(percentile(totalTimes, 50) / 1000).toFixed(1)}s max=${(percentile(totalTimes, 100) / 1000).toFixed(1)}s`);
}
if (failureGroups.size > 0) {
  console.log("失败分布：");
  for (const [reason, count] of failureGroups) console.log(`  ×${count} ${reason}`);
}

process.exit(successes.length === SAMPLES ? 0 : 1);
