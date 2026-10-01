import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONFIG_PATH, getConfig, updateConfig, type ConfigPatch } from "./config.ts";
import { MODELS, getModel } from "./models.ts";
import { collectChatCompletion, upstreamFetch } from "./upstream.ts";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

type Json = Record<string, unknown>;

interface ChatMessage {
  role?: string;
  content?: unknown;
}

interface ChatRequestBody {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
  text?: string;
  source_lang?: string;
  target_lang?: string;
  translate?: boolean;
  mode?: "chat" | "translate";
  chat_template_kwargs?: Json;
  [key: string]: unknown;
}

function errorResponse(
  status: number,
  message: string,
  type = "invalid_request_error",
  code: string | number = status,
) {
  return { error: { message, type, code, param: null } };
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractText(messages: ChatMessage[] | undefined): string {
  if (!messages || messages.length === 0) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.role === "user") return contentToText(message.content);
  }
  return contentToText(messages[messages.length - 1]?.content);
}

function newId(): string {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function completionResponse(params: {
  id?: string;
  model: string;
  content: string;
  finishReason?: string | null;
}) {
  return {
    id: params.id ?? newId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: params.content },
        finish_reason: params.finishReason ?? "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function sseResponse(upstream: Response): Response {
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function proxyUpstreamError(upstream: Response) {
  let message = `Upstream error (${upstream.status})`;
  try {
    const body = await upstream.text();
    if (body) message = body.slice(0, 800);
  } catch {
    // ignore
  }
  return {
    status: upstream.status as ContentfulStatusCode,
    body: errorResponse(upstream.status, message, "upstream_error"),
  };
}

function publicSettings() {
  const config = getConfig();
  return {
    server: config.server,
    upstream: config.upstream,
    auth: config.auth,
    defaults: config.defaults,
    configPath: CONFIG_PATH,
    models: MODELS,
  };
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: getConfig().server.corsOrigin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    maxAge: 86400,
  }),
);

// ---------- 静态资源禁用启发式缓存，避免样式/脚本更新后浏览器仍用旧版 ----------
app.use("*", async (c, next) => {
  await next();
  const type = c.res.headers.get("Content-Type") ?? "";
  if (/text\/html|text\/css|javascript/i.test(type)) {
    c.res.headers.set("Cache-Control", "no-cache");
  }
});

// ---------- 鉴权: 由 config.yaml 的 auth 控制，可实时开关 ----------
app.use("/v1/*", async (c, next) => {
  const { auth } = getConfig();
  if (!auth.enabled || auth.keys.length === 0) return next();
  const header = c.req.header("authorization") ?? "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const key = bearer || c.req.header("x-api-key") || "";
  if (!key || !auth.keys.includes(key)) {
    return c.json(
      errorResponse(401, "Invalid API key provided.", "invalid_request_error", "invalid_api_key"),
      401,
    );
  }
  return next();
});

// ---------- 健康检查 ----------
app.get("/api/health", (c) => {
  const config = getConfig();
  return c.json({
    ok: true,
    authEnabled: config.auth.enabled && config.auth.keys.length > 0,
    upstream: config.upstream.base,
    models: MODELS.map((model) => model.id),
  });
});

// ---------- 前端公开配置（供翻译页直接访问上游，不含任何密钥） ----------
app.get("/api/public", (c) => {
  const config = getConfig();
  return c.json({
    models: MODELS,
    defaults: config.defaults,
    upstream: { base: config.upstream.base },
    auth: { enabled: config.auth.enabled },
    settingsProtected: Boolean(config.auth.settingsKey),
  });
});

// ---------- 设置页秘钥鉴权 ----------
app.use("/api/settings", async (c, next) => {
  const { auth } = getConfig();
  if (!auth.settingsKey) return next();
  const provided =
    c.req.header("x-settings-key") ||
    (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (provided !== auth.settingsKey) {
    return c.json(
      errorResponse(401, "Invalid settings key.", "invalid_request_error", "invalid_settings_key"),
      401,
    );
  }
  return next();
});

// ---------- 系统设置读写（持久化到 config.yaml） ----------
app.get("/api/settings", (c) => c.json(publicSettings()));

app.post("/api/settings", async (c) => {
  let patch: ConfigPatch;
  try {
    patch = (await c.req.json()) as ConfigPatch;
  } catch {
    return c.json(errorResponse(400, "Invalid JSON body."), 400);
  }

  updateConfig(patch);
  return c.json(publicSettings());
});

// ---------- OpenAI 兼容: 模型列表 ----------
app.get("/v1/models", (c) =>
  c.json({
    object: "list",
    data: MODELS.map((model) => ({
      id: model.id,
      object: "model",
      created: 0,
      owned_by: "index-translate",
      kind: model.kind,
      root: model.upstream,
      permission: [],
    })),
  }),
);

// ---------- OpenAI 兼容: 对话 / 翻译 ----------
app.post("/v1/chat/completions", async (c) => {
  const config = getConfig();
  let body: ChatRequestBody;
  try {
    body = (await c.req.json()) as ChatRequestBody;
  } catch {
    return c.json(errorResponse(400, "Invalid JSON body."), 400);
  }

  // 未知模型回退到默认模型；路由由模型类型决定，可用 mode:"chat" 显式指定对话
  const modelDef = getModel(body.model) ?? getModel(config.defaults.model) ?? MODELS[0]!;
  const stream = body.stream === true;
  const useChat = modelDef.kind === "chat" || body.mode === "chat";

  // 模式一: 翻译模型 -> 固定翻译模板
  // 无论客户端是否传 source_lang / target_lang，都会补齐（客户端值优先，否则用默认偏好）
  if (!useChat) {
    const text = typeof body.text === "string" ? body.text : extractText(body.messages);
    if (!text.trim()) {
      return c.json(errorResponse(400, "No text to translate."), 400);
    }

    const sourceLang = (body.source_lang ?? "").trim() || config.defaults.sourceLang;
    const targetLang = (body.target_lang ?? "").trim() || config.defaults.targetLang;

    const upstream = await upstreamFetch(config, "/translate_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
        model: modelDef.upstream,
        stream: true,
      }),
      signal: c.req.raw.signal,
    });

    if (!upstream.ok) {
      const { status, body: errorBody } = await proxyUpstreamError(upstream);
      return c.json(errorBody, status);
    }

    if (stream) return sseResponse(upstream);

    const result = await collectChatCompletion(upstream);
    return c.json(
      completionResponse({
        id: result.id,
        model: result.model ?? modelDef.upstream,
        content: result.content,
        finishReason: result.finishReason,
      }),
    );
  }

  // 模式二: 对话模型（或 mode:"chat"）-> 透传上游 chat/completions，剥离翻译相关字段
  const forwarded: ChatRequestBody = { ...body, model: modelDef.upstream };
  delete forwarded.source_lang;
  delete forwarded.target_lang;
  delete forwarded.translate;
  delete forwarded.mode;

  if (!Array.isArray(forwarded.messages) || forwarded.messages.length === 0) {
    const text = typeof body.text === "string" ? body.text : "";
    forwarded.messages = [{ role: "user", content: text }];
  }
  if (!forwarded.chat_template_kwargs) {
    forwarded.chat_template_kwargs = { enable_thinking: false };
  }

  const upstream = await upstreamFetch(config, "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forwarded),
    signal: c.req.raw.signal,
  });

  if (!upstream.ok) {
    const { status, body: errorBody } = await proxyUpstreamError(upstream);
    return c.json(errorBody, status);
  }

  if (stream) return sseResponse(upstream);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});

// 兼容 OpenAI 的错误结构
app.all("/v1/*", (c) =>
  c.json(
    errorResponse(404, `Unknown endpoint: ${c.req.path}`, "invalid_request_error", "not_found"),
    404,
  ),
);

// ---------- 静态资源 ----------
app.get("/", serveStatic({ path: "index.html", root: publicDir }));
app.get("/settings", serveStatic({ path: "settings.html", root: publicDir }));
app.use("/*", serveStatic({ root: publicDir }));

const config = getConfig();
serve({ fetch: app.fetch, port: config.server.port, hostname: config.server.host }, (info) => {
  const base = `http://localhost:${info.port}`;
  console.log(`\n  Index-Translate OpenAI API`);
  console.log(`  ├─ 网页  : ${base}/`);
  console.log(`  ├─ 设置  : ${base}/settings`);
  console.log(`  ├─ API   : ${base}/v1/chat/completions`);
  console.log(`  ├─ 模型  : ${MODELS.map((model) => model.id).join(", ")}`);
  console.log(`  ├─ 鉴权  : ${config.auth.enabled ? `已启用 (${config.auth.keys.length} 个 Key)` : "未启用"}`);
  console.log(`  └─ 配置  : ${CONFIG_PATH}\n`);
});
