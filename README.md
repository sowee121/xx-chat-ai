# XX Chat AI

**Full-Stack AI Chat** — 全栈 AI 流式聊天 Demo

React 前端 + Fastify 后端，基于 SSE 的流式对话，Streamdown 多格式渲染，支持 Mock / OpenAI 切换、历史会话与动态模型选择。

## 功能特性

- **流式对话**：`@microsoft/fetch-event-source` + AbortController，支持停止生成
- **多格式渲染**：GFM 表格、代码高亮、Mermaid 图表、图片（点击 Lightbox 预览）
- **双 Provider**：Mock 关键词意图 / OpenAI API（兼容 edgefn、DeepSeek 等第三方端点）
- **动态模型**：Header 下拉拉取 `/v1/models`，选择持久化
- **历史会话**：SQLite 存储，侧栏新建 / 切换 / 删除
- **智能滚动**：贴底跟随 +「回到底部」按钮
- **现代 UI**：shadcn/ui（Maia + Neutral）+ Tailwind 4 + 亮暗主题，ChatGPT / Grok 混合布局

## 技术栈

| 层 | 选型 |
| --- | --- |
| 结构 | pnpm workspace（`apps/web` + `apps/server`） |
| 前端 | Vite 8 · React 19 · TypeScript 6 |
| SSE | `@microsoft/fetch-event-source` |
| 状态 | Zustand（`provider` / `model` 持久化） |
| Markdown | Streamdown + `@streamdown/code` / `mermaid` / `cjk` |
| UI | shadcn/ui · Tailwind CSS 4 · next-themes · lucide-react |
| 后端 | Fastify 5 · TypeScript |
| LLM | openai SDK（OpenAI API 兼容协议）+ Mock |
| 存储 | better-sqlite3（WAL） |

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+

### 安装与启动

```bash
git clone https://github.com/sowee121/xx-chat-ai.git
cd xx-chat-ai
pnpm install

# 配置 OpenAI（可选，不配置则仅 Mock 可用）
cp apps/server/config.local.example.json apps/server/config.local.json
# 编辑 apiKey / baseURL / model

pnpm dev
```

| 服务 | 地址 |
| --- | --- |
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3001 |

### 配置说明

**方式一：`config.local.json`（推荐本地开发）**

```bash
cp apps/server/config.local.example.json apps/server/config.local.json
```

```json
{
  "defaultProvider": "mock",
  "openai": {
    "apiKey": "sk-your-api-key",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o"
  }
}
```

**方式二：环境变量**（优先级高于配置文件）

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | API Key |
| `OPENAI_BASE_URL` | API 端点（OpenAI 兼容） |
| `OPENAI_MODEL` | 默认模型 |
| `OPENAI_SYSTEM_PROMPT` | 可选系统提示 |
| `DEFAULT_PROVIDER` | `mock` \| `openai` |
| `PORT` | 后端端口，默认 3001 |
| `DB_PATH` | SQLite 路径（可选） |

> `config.local.json` 已加入 `.gitignore`，请勿将真实 Key 提交到仓库。

## 项目结构

```
xx-chat-ai/
├── apps/
│   ├── web/                 # React 前端
│   │   └── src/
│   │       ├── components/  # chat / layout / ui
│   │       └── stores/      # Zustand chatStore
│   └── server/              # Fastify 后端
│       ├── config.local.example.json
│       └── src/
│           ├── routes/      # chat / history / providers
│           ├── providers/   # mock / openai
│           └── store/       # SQLite 历史
├── docs/plan.md             # 全栈方案文档
└── .cursor/rules/           # Cursor 项目规则
```

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/chat` | SSE 流式聊天 |
| `GET` | `/api/history` | 会话列表 |
| `GET` | `/api/history/:sessionCode` | 会话详情 |
| `DELETE` | `/api/history/:sessionCode` | 删除会话 |
| `GET` | `/api/providers` | Provider 可用性 |
| `GET` | `/api/providers/openai/models` | 动态模型列表 |

## 脚本

```bash
pnpm dev          # 同时启动前后端
pnpm dev:web      # 仅前端
pnpm dev:server   # 仅后端
pnpm build        # 构建 web + server
```

## 文档

详细方案见 [`docs/plan.md`](./docs/plan.md)。

## License

MIT
