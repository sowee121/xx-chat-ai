# XX Chat AI — 已知 Bug 修复计划

> **文档性质**：本地修复排期用，与功能方案 `docs/plan.md` 分离。  
> **来源**：2026-07 代码审查 + 2026-07-13 体验复核（`chatStore` / 路由 / 落库一致性等）。  
> **状态**：BUG-01～14 均已修复；**当前无未修条目**。

---

## 1. 总览

| 优先级 | ID | 简述 | 影响 | 状态 |
| --- | --- | --- | --- | --- |
| P0 | BUG-01 | 仅有推理、无正文时不落库 assistant | 刷新后 AI 回复丢失 | **已修复** |
| P1 | BUG-02 | 空正文 assistant 进入多轮上下文 | 后续请求质量下降 | **已修复** |
| P1 | BUG-03 | 流式报错时不保存已生成 partial 正文 | 刷新后半截回复丢失 | **已修复** |
| P1 | BUG-08 | 流式中切会话，旧 delta 污染新会话 | 消息写串、缓存/多轮错乱 | **已修复** |
| P1 | BUG-09 | 首条发送 meta 前整区空白 | 短暂空白；失败时错误条也看不到 | **已修复** |
| P1 | BUG-10 | 仅推理轮次前后端正文不一致 | 刷新前后 UI/上下文不一致 | **已修复** |
| P2 | BUG-04 | `sseClient` 中 `JSON.parse` 无保护 | 畸形 SSE 可能误报网络错误 | **已修复** |
| P2 | BUG-05 | 推理字段 + 标签双通道可能重复展示 | 特定网关下推理重复 | **已修复** |
| P2 | BUG-06 | 无效 `sessionCode` 静默创建空会话 | 历史对不上、困惑 | **已修复** |
| P2 | BUG-11 | 过早停止留下空 assistant 幽灵行 | 无 token 停止后仍占位空白气泡 | **已修复** |
| P2 | BUG-12 | Provider 建连失败仍已落库 user | 重试叠孤儿 user | **已修复** |
| P3 | BUG-07 | abort 后 `openai.ts` `finally` 仍 flush | 理论上的多余 yield，低风险 | **已修复** |
| P3 | BUG-13 | 空闲超时未先 abort 上游 | 超时后上游可能多挂一会儿 | **已修复** |
| P3 | BUG-14 | 占位符正文进入多轮 history | 把「本轮无正文输出」喂给模型 | **已修复** |

**建议修复顺序**：无剩余待修项

---

## 2. 问题详情

### BUG-01 · 仅有推理无正文时 assistant 不落库 【P0】✅ 已修复

**修复**（2026-07-10 / 续）：

1. `chat.ts` 记录 `hadReasoning`；`textToSave` 为空但有推理时落库占位符 `（本轮无正文输出）`（含 abort / error 路径）。
2. `messages.reasoning` 列落库思考正文；历史 API / 前端回放 `ReasoningBlock`（默认折叠）；多轮请求不回传 reasoning。

**现象**

- 流式过程中前端 `ReasoningBlock` 有内容，但 `message.content` 始终为空。
- 本轮结束后 UI 仍显示推理块；**刷新页面或重新打开对话**后，该轮 assistant 消失，只剩 user 消息。

**典型触发**

- 推理模型把思考放在 `content` 内标签（如 `redacted_thinking`），标签闭合前流结束。
- 模型整轮只输出思考、无可见正文。
- 用户过早「停止生成」，尚未收到任何 `text` delta。

**根因（历史）**

`apps/server/src/routes/chat.ts` 中 `fullText` 只累加 `type === 'text'` 的 delta；早期落库条件为 `textToSave` 非空，推理不落库。

**涉及文件**

- `apps/server/src/routes/chat.ts`
- `apps/server/src/store/sqlite.ts` / `history.ts`
- `apps/web/src/stores/chatStore.ts`、`ReasoningBlock.tsx`

**验收**

- 只推 reasoning、不推 text → 刷新后 assistant 行仍在（占位符 + 可展开思考块）
- 正常有正文的轮次：正文 + reasoning 均可还原；多轮 body 不含 reasoning

---

### BUG-02 · 空正文 assistant 污染多轮上下文 【P1】✅ 已修复

**修复**（2026-07-10）：`chatStore.send` 构造 `history` 时过滤 `assistant` 且 `content` 为空的条目。

**现象**

- 上一轮 assistant 在内存里 `content: ''` 但 `reasoning` 有值。
- 用户继续提问时，请求 body 的 `messages` 含 `{ role: 'assistant', content: '' }`。
- 模型可能因空 assistant 消息产生异常或质量下降。

**根因**

`apps/web/src/stores/chatStore.ts` 构造 history 时未过滤。

**涉及文件**

- `apps/web/src/stores/chatStore.ts`

**验收**

- 上一轮仅推理无正文 → 下一轮请求的 `messages` 中不包含空 assistant；正常多轮对话不受影响

---

### BUG-03 · 流式报错时不保存 partial 正文 【P1】✅ 已修复

**修复**（2026-07-10）：`chat.ts` 的 `catch` 中调用 `persistAssistantIfAny`，与 abort 路径一致。

**现象**

- API 中途报错或网络中断，前端已展示部分正文。
- `catch` 只发 `error` 事件，**不落库**；刷新后 partial 丢失。
- 用户主动停止（abort）且已有正文时，abort 路径会落库 — 行为不一致。

**根因**

`apps/server/src/routes/chat.ts` 的 `catch` 早期未复用 abort 落库逻辑。

**涉及文件**

- `apps/server/src/routes/chat.ts`

**验收**

- 模拟流式中途 500 → DB 有 partial assistant；与 abort 路径行为对齐

---

### BUG-04 · SSE 解析缺少 try/catch 【P2】✅ 已修复

**修复**（2026-07-14）：`sseClient` 增加 `safeParse`；`meta` / `delta` / `done` / `error` 解析失败时提示「流式数据解析失败」并 abort，开发环境 `console.warn` 原始 payload。

**现象**

- 若 `meta` / `delta` / `done` / `error` 的 `data` 非合法 JSON，`onmessage` 内 `JSON.parse` 抛错。
- 外层 catch 可能向用户展示「网络错误」，掩盖真实问题。

**根因（历史）**

`apps/web/src/services/sseClient.ts` 的 `onmessage` 各分支直接 `JSON.parse(ev.data)`。

**涉及文件**

- `apps/web/src/services/sseClient.ts`

**验收**

- 注入畸形 SSE data → 不出现未捕获异常；用户看到「流式数据解析失败」

---

### BUG-05 · 推理可能重复展示 【P2】✅ 已修复

**修复**（2026-07-14）：`openaiStream` 一旦从独立字段抽到 reasoning，本流后续 `content` 改为 `stripThinkingTags` 后仅推 `text`，且不再 `parser.flush()` 标签缓冲，避免字段+标签双通道重复。

**现象**

- 同一 token 周期内，网关既返回 `reasoning_content`（等字段），又在 `content` 里包思考标签。
- 前端 `ReasoningBlock` 同一段思考出现两次。

**根因（历史）**

`apps/server/src/providers/openai.ts` 两条路径并行、无去重。

**涉及文件**

- `apps/server/src/providers/openai.ts`
- `apps/server/src/lib/thinkingParser.ts`（`stripThinkingTags`）

**验收**

- 双通道 mock delta → 前端 reasoning 只出现一份；纯标签路径（无字段）行为不变

---

### BUG-06 · 无效 sessionCode 静默创建空会话 【P2】✅ 已修复

**修复**（2026-07-14，方案 A）：

1. `ensureSession`：传入 code 不存在时抛 `SessionNotFoundError`，**不再**用客户端 code 建空壳。
2. `POST /api/chat` 在 SSE hijack **前**捕获并 `404 { error: '对话不存在或已删除' }`。
3. 前端：顶部 Toast（约 3s）提示「对话不存在或已删除」；清 `sessionCode`/缓存、去掉本轮乐观消息，并 `navigate('/')`（不再用消息区错误红条）。

**现象**

- 客户端携带已删除或不存在的 `sessionCode` 发消息。
- 服务端不 404，而是用该 code **新建空会话**并继续写入消息。
- 用户以为还在旧对话，实际是新空壳。

**根因（历史）**

`ensureSession` 未找到时仍 `sessionCode ?? randomUUID()` 写入新 session。

**涉及文件**

- `apps/server/src/store/sqlite.ts`、`history.ts`
- `apps/server/src/routes/chat.ts`
- `apps/web/src/services/sseClient.ts`、`stores/chatStore.ts`、`hooks/useSyncSessionRoute.ts`

**验收**

- 删除对话后仍用旧 code 发消息 → HTTP 404，不新建同 code 会话；前端提示并回首页

---

### BUG-07 · abort 后 provider `finally` 仍 flush 【P3】✅ 已修复

**修复**（2026-07-10）：`openai.ts` 的 `finally` 在 `signal.aborted` 时跳过 `parser.flush()`；正常结束与报错路径仍会 flush 未闭合标签。

**涉及文件**

- `apps/server/src/providers/openai.ts`

**验收**

- 停止生成无多余 SSE；正常结束仍 flush 未闭合标签

---

### BUG-08 · 流式中切会话，旧 delta 污染新会话 【P1】✅ 已修复

**修复**（2026-07-14）：

1. `send` 分配 `_streamSeq` token；`onMeta` / `onDelta` / `onDone` / `onError` 与收尾 `syncSessionCache` 仅在 token 命中时生效。
2. 路由 abort、`openSession`、`stop`、`newChat` 时 bump `_streamSeq`，丢弃迟到回调。
3. 产品策略保持 **abort + 跟新 URL**（与 `plan.md` 对齐）。

**现象**

- 生成中切换到另一对话后，旧流残留 `delta` / 迟到回调可能写进**当前**会话最后一条 assistant。
- 进一步污染 `sessionMessagesCache` 与下一轮 `history`。

**根因（历史）**

`appendToAssistant` / 流回调无世代校验；abort 后立刻换会话即可被污染。

**涉及文件**

- `apps/web/src/stores/chatStore.ts`
- `apps/web/src/hooks/useSyncSessionRoute.ts`

**验收**

- 流式中连切两个会话 → 新会话 messages 不含旧流文本；旧会话缓存也不被污染

---

### BUG-09 · 首条发送 meta 前整区空白 【P1】✅ 已修复

**修复**（2026-07-14）：

1. `send` 乐观挂载 `PENDING_SESSION_CODE`（已有真实 code 则挂真实 code）。
2. `onMeta` 卸掉 pending，换成真实 `sessionCode`；pending 不写入 URL。

**现象**

- 首页/新建对话发出第一条消息后，短暂（建连失败时甚至更久）主区空白。
- 错误发生在 `meta` 之前时，`MessageList` 未挂载，红条错误也可能看不到。

**根因（历史）**

`showChat` 已 true，但 `mountedSessionCodes` 仅在 `onMeta` 才有条目。

**涉及文件**

- `apps/web/src/lib/pendingSession.ts`
- `apps/web/src/stores/chatStore.ts`
- `apps/web/src/hooks/useSyncSessionRoute.ts`

**验收**

- 首页发送后立刻可见用户气泡与等待三点；`meta` 前断连仍能看到错误提示

---

### BUG-10 · 仅推理轮次前后端正文不一致 【P1】✅ 已修复

**修复**（2026-07-14）：

1. 前端 `REASONING_ONLY_PLACEHOLDER` 与服务端占位文案对齐。
2. `onDone` / `stop` 时若末条 assistant 有 reasoning、无 text，写入同一占位符。

**现象**

- 服务端落库为 `（本轮无正文输出）`，前端流结束仍 `content: ''`，刷新前后不一致。

**根因（历史）**

占位符只在落库补上，SSE 未回传最终 content。

**涉及文件**

- `apps/web/src/lib/reasoningPlaceholder.ts`
- `apps/web/src/stores/chatStore.ts`
- `apps/server/src/routes/chat.ts`（文案交叉注释）

**验收**

- 仅推理轮次流结束 UI 与刷新后 DB 一致

---

### BUG-11 · 过早停止留下空 assistant 幽灵行 【P2】✅ 已修复

**修复**（2026-07-14）：`stop` / 无产出 `onError` 时，若末条 assistant 无 content/reasoning 则 `pop` 移除。

**现象**

- 尚未收到任何 reasoning/text 就点「停止」：前端仍保留空 assistant 节点。

**涉及文件**

- `apps/web/src/stores/chatStore.ts`

**验收**

- 发送后立刻停止 → 列表无空白助手行

---

### BUG-12 · Provider 建连失败仍已落库 user 【P2】✅ 已修复

**修复**（2026-07-14）：`catch` 路径若无任何 delta 且未落库 assistant，则 `deleteLastUserMessage` 回滚本轮 user。

**现象**

- 先 `appendMessage(user)` 再开流；`create()` 失败留下孤儿 user。

**涉及文件**

- `apps/server/src/routes/chat.ts`
- `apps/server/src/store/sqlite.ts`、`history.ts`

**验收**

- 故意错误 Key 发一条 → DB 无该轮孤儿 user

---

### BUG-13 · 空闲超时未先 abort 上游 【P3】✅ 已修复

**修复**（2026-07-14）：`withStreamIdleTimeout` 空闲分支先调用 `abort()` 再抛错；`chat.ts` 传入 `() => ac.abort()`。

**涉及文件**

- `apps/server/src/lib/streamIdle.ts`
- `apps/server/src/routes/chat.ts`

**验收**

- 超时后上游连接尽快随 AbortSignal 结束

---

### BUG-14 · 占位符正文进入多轮 history 【P3】✅ 已修复

**修复**（2026-07-14）：组 `history` 时过滤 `REASONING_ONLY_PLACEHOLDER` 与空正文 assistant。

**涉及文件**

- `apps/web/src/stores/chatStore.ts`

**验收**

- 仅推理轮次后继续提问 → 请求 body 不含占位符字符串

---

## 3. 非 Bug / 暂不纳入本计划

| 项 | 说明 |
| --- | --- |
| 用户消息「编辑」不截断后续轮次 | 产品设计：仅 `prefillComposer` 回填，非缺陷 |
| 流式中切换会话（产品策略） | **abort + `_streamSeq` 守卫**（BUG-08 已修；与 plan 对齐） |
| Mock 豁免空闲超时 | 按产品约定，非缺陷 |
| 首页「模拟错误提示」暗门 | 开发预览：中文主文案 + `authentication_error: Invalid API key` 示例，不发请求 |
| 首页首条免聊天区骨架 | 按设计：仅切换已有会话走 `MessageContentShell` |
| 无单元测试 | 技术债；修 BUG-05/08 时建议补最小用例 |
| TypeScript | `apps/web`、`apps/server` 分别 `tsc --noEmit` 已通过（审查时） |

---

## 4. 建议实施阶段

### Phase A — 数据一致性（已完成）

- [x] BUG-01：空正文落库策略（占位符 `（本轮无正文输出）`）
- [x] BUG-02：过滤空 assistant history
- [x] BUG-03：`catch` 路径 partial 落库

### Phase B — 流式会话竞态（已完成）

- [x] BUG-08：send 世代校验 + 路由策略对齐
- [x] BUG-09：首条消息乐观 mount / 回退渲染
- [x] BUG-10：仅推理轮次前后端 content 对齐

**回归**：首页首条发送、流式中切会话、仅推理模型、刷新历史

### Phase C — 健壮性（已完成）

- [x] BUG-04：`sseClient` 安全解析
- [x] BUG-06：`sessionCode` 不存在时的 API 契约 + 前端处理
- [x] BUG-11：过早停止移除空 assistant
- [x] BUG-12：建连失败回滚 user

### Phase D — Provider / 边缘（已完成）

- [x] BUG-05：双通道推理去重
- [x] BUG-07：abort 时 skip flush
- [x] BUG-13：空闲超时先 abort
- [x] BUG-14：history 过滤占位符

---

## 5. 修复后文档同步

完成任一 Phase 后：

1. 更新本文档对应条目的 **状态**（已修复 / 按设计保留）。
2. 若行为变更影响对外 API 或配置，同步 `docs/plan.md` 第 6、7 节及「已知问题与修复记录」表。
3. 任务收尾按 `.cursor/rules/plan-sync.mdc` 说明 plan 同步结论。

---

## 6. 审查参考（关键代码位置）

| 区域 | 路径 |
| --- | --- |
| SSE 落库 | `apps/server/src/routes/chat.ts` |
| 推理解析 | `apps/server/src/lib/thinkingParser.ts`、`reasoningDelta.ts` |
| Provider | `apps/server/src/providers/openai.ts` |
| 上游错误 | `apps/server/src/lib/upstreamError.ts` |
| 空闲超时 | `apps/server/src/lib/streamIdle.ts`、`apps/web/src/lib/streamIdle.ts` |
| 前端状态 | `apps/web/src/stores/chatStore.ts`、`toastStore.ts` |
| 错误红条 | `apps/web/src/components/chat/StreamErrorBanner.tsx` |
| SSE 客户端 | `apps/web/src/services/sseClient.ts` |
| 路由同步 | `apps/web/src/hooks/useSyncSessionRoute.ts` |
| 布局挂载 | `apps/web/src/routes/ChatLayout.tsx` |
| 会话存储 | `apps/server/src/store/sqlite.ts` |

---

*最后更新：2026-07-14（BUG-01～14 已修；上游错误 detail / 首条免骨架等体验项已同步 plan）*
