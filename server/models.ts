/**
 * 对外暴露的模型别名 -> 上游真实模型。
 * - `mt`  : 翻译模型，始终携带 source_lang / target_lang（客户端未传时取默认偏好）
 * - `chat`: 对话模型，忽略 source_lang / target_lang，走原生 chat/completions
 */
export type ModelKind = "mt" | "chat";

export interface TranslateModel {
  id: string;
  label: string;
  /** 上游真实模型名 */
  upstream: string;
  kind: ModelKind;
  tag: { zh: string; en: string };
}

export const MODELS: TranslateModel[] = [
  // —— 翻译模型 (MT) ——
  {
    id: "index-mt-2b",
    label: "Index-Translate-2B",
    upstream: "qwen35-2b-linear-merge",
    kind: "mt",
    tag: { zh: "快", en: "fast" },
  },
  {
    id: "index-mt-9b",
    label: "Index-Translate-9B",
    upstream: "qwen35-9b-6624275-iter999",
    kind: "mt",
    tag: { zh: "均衡", en: "balanced" },
  },
  {
    id: "index-mt-35b",
    label: "Index-Translate-35B-A3B",
    upstream: "Index-Translate-35B-A3B",
    kind: "mt",
    tag: { zh: "preview", en: "preview" },
  },
  // —— 对话模型 (Chat) ——
  {
    id: "index-chat-2b",
    label: "Index-Chat-2B",
    upstream: "qwen35-2b-linear-merge",
    kind: "chat",
    tag: { zh: "快", en: "fast" },
  },
  {
    id: "index-chat-9b",
    label: "Index-Chat-9B",
    upstream: "qwen35-9b-6624275-iter999",
    kind: "chat",
    tag: { zh: "均衡", en: "balanced" },
  },
  {
    id: "index-chat-35b",
    label: "Index-Chat-35B-A3B",
    upstream: "Index-Translate-35B-A3B",
    kind: "chat",
    tag: { zh: "preview", en: "preview" },
  },
];

export function getModel(id: string | undefined): TranslateModel | undefined {
  return MODELS.find((model) => model.id === id);
}

export function isValidModel(id: string | undefined): boolean {
  return Boolean(getModel(id));
}

export function modelLabel(id: string): string {
  return getModel(id)?.label ?? id;
}
