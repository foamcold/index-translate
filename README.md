# Index-Translate

把 [index-translate.bilibili.com](https://index-translate.bilibili.com/?p=%2Fsite%2Ftranslate.html&lang=zh)
的「通用文本翻译」能力 API 化，对外提供 **OpenAI 兼容** 接口，并复刻其翻译页作为前端；
新增「系统设置」页，所有配置持久化到服务端 `config.yaml`。

## ✨ 特性

- **OpenAI 兼容 API**：`POST /v1/chat/completions`（支持 `stream` 流式）与 `GET /v1/models`
- **两类模型**
  - `index-mt-*`（翻译模型）：始终携带 `source_lang` / `target_lang`，客户端未传时取默认偏好
  - `index-chat-*`（对话模型）：忽略 `source_lang` / `target_lang`，走原生对话
- **前端复刻**：翻译模型选择（2B / 9B / 35B）、语种选择（100+）、指令预设、双栏对照、流式打字、TTFT 统计
- **前端直连上游**：翻译页由浏览器直接请求 `index-translate.bilibili.com`（与原网页一致），不经本站中转、不需要任何密钥；本站只提供显示与配置
- **前端只展示翻译模型**；对话模型仅在 API 提供
- **系统设置**：设置页秘钥登录（默认 `admin`）、API Key 列表（可生成）、默认模型 / 源语言 / 目标语言、上游地址
- **可选鉴权**：默认开启并自动生成 Key，配置持久化到 `config.yaml`
- **零构建**：Node 原生运行 TypeScript，前端为原生 HTML/CSS/JS

## 🧱 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 | Node.js 26（原生 TypeScript 类型剥离，无需编译） |
| 服务端 | [Hono](https://hono.dev) + `@hono/node-server` + `yaml` |
| 前端 | 原生 HTML / CSS / JavaScript（无框架、无构建） |
| 包管理 | pnpm |
| 工具链 | [mise](https://mise.jdx.dev) |

## 🚀 快速开始

```bash
# 1. 安装 mise（若尚未安装）
curl https://mise.run | sh

# 2. 安装运行时并安装依赖
mise install
mise run setup

# 3. 启动
mise run dev      # 开发（热重载）
# 或
mise run start    # 生产

# 打开 http://localhost:8787
# 设置页 http://localhost:8787/settings
```

首次启动会自动生成 `config.yaml`，其中包含一个随机 API Key，可直接在设置页查看。

## 🐳 Docker

```bash
# 构建并启动（后台）
docker compose up -d --build
# 或使用 mise 任务
mise run docker-up

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

- 网页 / API：<http://localhost:8787>；设置页：<http://localhost:8787/settings>
- 配置持久化在宿主机 `./data/config.yaml`（容器内 `CONFIG_PATH=/data/config.yaml`），首次启动自动生成（默认设置页秘钥 `admin`）
- 端口、Node 版本可分别通过 `docker-compose.yml` / `Dockerfile` 的 build args 调整

也可以不用 Compose：

```bash
docker build -t index-translate .
docker run -d --name index-translate \
  -p 8787:8787 \
  -v "$PWD/data:/data" \
  index-translate
```

## ⚙️ 配置

所有配置存放在项目根目录的 `config.yaml`（示例见 `config.yaml.example`）。
可通过设置页修改（立即生效），也可手动编辑后重启服务。

```yaml
server:
  port: 8787
  host: "0.0.0.0"
  corsOrigin: "*"

upstream:
  base: "https://index-translate.bilibili.com"

auth:
  enabled: true          # 是否启用 API Key 鉴权（默认开启）
  keys:
    - "sk-..."           # 为空且开启鉴权时自动生成
  settingsKey: "admin"   # 系统设置页访问秘钥，默认 admin；留空则关闭设置页鉴权

defaults:
  model: "index-mt-9b"
  sourceLang: "auto"
  targetLang: "zh"
```

可用环境变量 `CONFIG_PATH` 指定配置文件路径（相对项目根或绝对路径）。

## 📡 API

### 模型列表

```bash
curl http://localhost:8787/v1/models
```

| 模型 | 类型 | 说明 |
| --- | --- | --- |
| `index-mt-2b` / `index-mt-9b` / `index-mt-35b` | MT | 翻译模型，使用 `source_lang` / `target_lang` |
| `index-chat-2b` / `index-chat-9b` / `index-chat-35b` | Chat | 对话模型，忽略 `source_lang` / `target_lang`（仅 API） |

> 翻译模型与对话模型都可通过 API 调用；前端主页只展示翻译模型，与上游网页保持一致。

### 翻译（MT 模型）

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "index-mt-9b",
    "source_lang": "auto",
    "target_lang": "zh",
    "messages": [{ "role": "user", "content": "Hello, world" }],
    "stream": true
  }'
```

- MT 模型**无论客户端是否传** `source_lang` / `target_lang`，都会补齐：客户端值优先，否则读取 `defaults.sourceLang` / `defaults.targetLang`。
- 也可用顶层 `text` 字段代替 `messages`。

### 对话（Chat 模型）

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "index-chat-9b",
    "messages": [{ "role": "user", "content": "用一句话介绍你自己" }],
    "stream": true
  }'
```

Chat 模型会剥离 `source_lang` / `target_lang` / `translate` 字段，按原生对话处理。

### 指令模式（用翻译模型别名走对话）

上游网页的「按你的要求翻译」是拿翻译模型别名调用对话接口。为了在单一端点保留该能力，额外支持扩展字段 `mode`：

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "index-mt-9b",
    "mode": "chat",
    "messages": [{"role": "user", "content": "翻译为英文并拼出所有数字：有3人和24台服务器"}],
    "stream": true
  }'
```

- 不传 `mode`（默认 `translate`）：MT 模型走翻译模板
- `mode: "chat"`：即使模型是 MT 别名也走对话（主页指令模式即用此方式）
- Chat 模型无论是否传 `mode` 都走对话

#### OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8787/v1", api_key="sk-...")

# 翻译
print(client.chat.completions.create(
    model="index-mt-9b",
    messages=[{"role": "user", "content": "把意思说清，把语气留下。"}],
    extra_body={"source_lang": "zh", "target_lang": "en"},
).choices[0].message.content)

# 对话
print(client.chat.completions.create(
    model="index-chat-9b",
    messages=[{"role": "user", "content": "讲个冷笑话"}],
).choices[0].message.content)
```

## 🖥️ 前端页面

- `/` 文本翻译页：与原网页一致 —— 翻译模型（2B / 9B / 35B）、语种选择、指令预设、双栏流式翻译、耗时统计
- `/settings` 系统设置（需登录）：
  - **设置页秘钥**：默认 `admin`，在 config.yaml 的 `auth.settingsKey` 中配置，可留空关闭
  - **API Key 鉴权**：开关（默认开启）+ Key 列表（添加 / 生成）
  - **默认偏好**：默认翻译模型、默认源语言、默认目标语言
  - **上游与服务**：上游地址、服务信息、配置文件路径

设置读写接口：

- `GET /api/public` — 公开配置（模型、默认偏好、上游地址、是否鉴权），**不含任何密钥**
- `GET /api/settings` — 读取完整配置（需 `X-Settings-Key`）
- `POST /api/settings` — 更新并写入 `config.yaml`（需 `X-Settings-Key`）

> 翻译页不使用 `/v1/*`，也不接触 API Key：它在浏览器侧直接调用上游（上游已开放 `Access-Control-Allow-Origin: *`）。因此 API Key 仅用于外部客户端。

## 📁 目录结构

```
.
├── mise.toml            # mise 工具版本与任务
├── Dockerfile           # 多阶段构建（deps + runtime）
├── docker-compose.yml   # Compose 编排（端口 / 数据卷 / 健康检查）
├── .dockerignore
├── config.yaml.example  # 配置模板
├── server/
│   ├── index.ts         # Hono 应用：路由 / 鉴权 / 设置 API / 静态资源
│   ├── config.ts        # config.yaml 读写与归一化
│   ├── models.ts        # 模型表（mt / chat）
│   └── upstream.ts      # 上游调用与 SSE 聚合
├── public/
│   ├── index.html       # 翻译页
│   ├── settings.html    # 系统设置页
│   ├── css/             # theme.css + app.css
│   └── js/              # i18n / langs / common / translate / settings
└── tsconfig.json
```

## 🔒 说明

- 翻译能力来自上游 `index-translate.bilibili.com`，本项目仅做协议适配与界面复刻。
- 翻译页依赖上游的 CORS（当前为 `*`）；若上游收紧 CORS 或 `upstream.base` 指向不支持 CORS 的地址，网页直连会失败（可用 `/v1/*` 中转方案替代）。
- 系统设置页由 `auth.settingsKey` 保护（默认 `admin`），请及时修改为强秘钥。
- API Key 仅用于 `/v1/*` 外部调用，不会下发到浏览器；生产环境建议保持 API Key 鉴权开启，并将 `server.corsOrigin` 收敛到可信来源。
