import type { AppConfig } from "./config.ts";

/** 上游 Index-Translate 通过 `?p=` 查询路由暴露内部接口（兼容 CDN 白名单）。 */
export function upstreamUrl(config: AppConfig, path: string): string {
  return `${config.upstream.base}/?p=${encodeURIComponent(path)}`;
}

/** 上游错误包装，便于统一转成 OpenAI 错误结构。 */
export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

export async function upstreamFetch(
  config: AppConfig,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(upstreamUrl(config, path), init);
  return response;
}

export interface CollectedChat {
  id?: string;
  model?: string;
  content: string;
  finishReason: string | null;
}

/** 消费 OpenAI 兼容的 SSE 流并聚合为完整文本（上游 translate_stream 只支持流式）。 */
export async function collectChatCompletion(response: Response): Promise<CollectedChat> {
  const body = response.body;
  if (!body) return { content: "", finishReason: null };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let id: string | undefined;
  let model: string | undefined;
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          id?: string;
          model?: string;
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
        };
        if (chunk.id) id = chunk.id;
        if (chunk.model) model = chunk.model;
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) content += choice.delta.content;
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        // 忽略无法解析的心跳/异常行
      }
    }
  }

  return { id, model, content, finishReason };
}
