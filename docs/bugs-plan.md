# XX Chat AI — 已知 Bug 修复计划

> **文档性质**：本地修复排期用，与功能方案 `docs/plan.md` 分离。  
> **来源**：2026-07 代码审查（`chat.ts` / `openai.ts` / `chatStore.ts` / `sseClient.ts` / `thinkingParser.ts` 等）。  
> **状态**：BUG-01～03、BUG-07 已修复；其余待排期。

---

## 1. 总览

| 优先级 | ID | 简述 | 影响 |
| --- | --- | --- | --- |
| P0 | BUG-01 | 仅有推理、无正文时不落库 assistant | 刷新后 AI 回复丢失 | **已修复** |
| P1 | BUG-02 | 空正文 assistant 进入多轮上下文 | 后续请求质量下降 | **已修复** |
| P1 | BUG-03 | 流式报错时不保存已生成 partial 正文 | 刷新后半截回复丢失 | **已修复** |
| P2 | BUG-04 | `sseClient` 中 `JSON.parse` 无保护 | 畸形 SSE 可能误报网络错误 |
| P2 | BUG-05 | 推理字段 + 标签双通道可能重复展示 | 特定网关下推理重复 |
| P2 | BUG-06 | 无效 `sessionCode` 静默创建空会话 | 历史对不上、困惑 |
| P3 | BUG-07 | abort 后 `openai.ts` `finally` 仍 flush | 理论上的多余 yield，低风险 | **已修复** |

**建议修复顺序**：BUG-01 → BUG-02 → BUG-03 → BUG-04 → BUG-05 → BUG-06 → BUG-07

---

## 2. 问题详情

### BUG-01 · 仅有推理无正文时 assistant 不落库 【P0】✅ 已修复

**修复**（2026-07-10）：`chat.ts` 记录 `hadReasoning`；`textToSave` 为空但有推理时落库占位符 `（本轮无正文输出）`（含 abort 路径）。

**现象**

- 流式过程中前端 `ReasoningBlock` 有内容，但 `message.content` 始终为空。
- 本轮结束后 UI 仍显示推理块；**刷新页面或重新打开对话**后，该轮 assistant 消失，只剩 user 消息。

**典型触发**

- 推理模型把思考放在 `content` 内标签（如 `redacted_thinking`），标签闭合前流结束。
- 模型整轮只输出思考、无可见正文。
- 用户过早「停止生成」，尚未收到任何 `text` delta。

**根因**

`apps/server/src/routes/chat.ts` 中 `fullText` 只累加 `type === 'text'` 的 delta；落库条件为 `textToSave` 非空：

```ts
const textToSave = stripThinkingTags(fullText);
if (textToSave) historyStore.appendMessage(session.sessionCode, 'assistant', textToSave);
```

推理走 `reasoning` 通道，**从不写入 SQLite**（与产品设计「历史仅存正文」一致），但未处理「正文为空」的边界。

**涉及文件**

- `apps/server/src/routes/chat.ts`
- （可选联动）`apps/web/src/stores/chatStore.ts` — 刷新后与 DB 不一致时的 UI 表现

**修复方向（待实现）**

1. **最小方案**：`textToSave` 为空但本轮曾收到过 `reasoning`（服务端需记 flag）时，仍 `appendMessage` 一条 assistant，内容为约定占位符，如 `（本轮无正文输出）`；或存 strip 后的极短摘要（需产品确认）。
2. **更完整方案**：`messages` 表增加可选 `reasoning` 列或 metadata JSON，历史回放时可还原 `ReasoningBlock`（改动面大，单独立项）。
3. **验收**：Mock 或构造「只推 reasoning、不推 text」的流 → 刷新后 assistant 行仍存在；正常有正文的轮次行为不变。

---

### BUG-02 · 空正文 assistant 污染多轮上下文 【P1】✅ 已修复

**修复**（2026-07-10）：`chatStore.send` 构造 `history` 时过滤 `assistant` 且 `content` 为空的条目。

**现象**

- 上一轮 assistant 在内存里 `content: ''` 但 `reasoning` 有值。
- 用户继续提问时，请求 body 的 `messages` 含 `{ role: 'assistant', content: '' }`。
- 模型可能因空 assistant 消息产生异常或质量下降。

**根因**

`apps/web/src/stores/chatStore.ts` 构造 history 时未过滤：

```ts
const history = state.messages.map((m) => ({ role: m.role, content: m.content }))
```

**涉及文件**

- `apps/web/src/stores/chatStore.ts`

**修复方向（待实现）**

1. 构造 `history` 时过滤 `role === 'assistant' && !content.trim()` 的条目。
2. 或：与 BUG-01 联动，保证落库后 `openSession` 拉取的历史与内存一致（无空 assistant）。
3. **验收**：上一轮仅推理无正文 → 下一轮请求的 `messages` 中不包含空 assistant；正常多轮对话不受影响。

---

### BUG-03 · 流式报错时不保存 partial 正文 【P1】✅ 已修复

**修复**（2026-07-10）：`chat.ts` 的 `catch` 中调用 `persistAssistantIfAny`，与 abort 路径一致。

**现象**

- API 中途报错或网络中断，前端已展示部分正文。
- `catch` 只发 `error` 事件，**不落库**；刷新后 partial 丢失。
- 用户主动停止（abort）且已有正文时，abort 路径会落库 — 行为不一致。

**根因**

`apps/server/src/routes/chat.ts`：

```ts
} catch (err) {
  request.log.error(err);
  send('error', { message: ... });
  // 未使用已积累的 fullText
}
```

**涉及文件**

- `apps/server/src/routes/chat.ts`

**修复方向（待实现）**

1. 在 `catch` 中复用 abort 逻辑：`stripThinkingTags(fullText)` 非空则 `appendMessage`。
2. 注意：连接已断时 `send('error')` 可能写不出去，落库仍应执行。
3. **验收**：模拟流式中途 500 → DB 有 partial assistant；与 abort 路径行为对齐。

---

### BUG-04 · SSE 解析缺少 try/catch 【P2】

**现象**

- 若 `meta` / `delta` / `done` / `error` 的 `data` 非合法 JSON，`onmessage` 内 `JSON.parse` 抛错。
- 外层 catch 可能向用户展示「网络错误」，掩盖真实问题。

**根因**

`apps/web/src/services/sseClient.ts` 的 `onmessage` 各分支直接 `JSON.parse(ev.data)`。

**涉及文件**

- `apps/web/src/services/sseClient.ts`

**修复方向（待实现）**

1. 封装 `safeParse(data)`，失败时 `onError?.('流式数据解析失败')` 并 `ctrl.abort()`。
2. 开发环境可 `console.warn` 原始 payload 便于排查。
3. **验收**：注入畸形 SSE 数据不导致未捕获异常；用户看到明确错误文案。

---

### BUG-05 · 推理可能重复展示 【P2】

**现象**

- 同一 token 周期内，网关既返回 `reasoning_content`（等字段），又在 `content` 里包思考标签。
- 前端 `ReasoningBlock` 同一段思考出现两次。

**根因**

`apps/server/src/providers/openai.ts` 两条路径并行、无去重：

```ts
const reasoning = extractReasoningFromDelta(delta);
if (reasoning) yield { type: 'reasoning', content: reasoning };

if (content) yield* emitParsed(parser, content);
```

当前 edgefn + R1 实测仅标签路径，**暂未复现**，换供应商后可能踩坑。

**涉及文件**

- `apps/server/src/providers/openai.ts`
- `apps/server/src/lib/reasoningDelta.ts`
- `apps/server/src/lib/thinkingParser.ts`

**修复方向（待实现）**

1. 当本 chunk 已从字段提取 `reasoning` 时，对 `content` 跳过标签解析，或仅解析标签外正文。
2. 或：字段有推理时，对 `content` 先 `stripThinkingTags` 再 `emitParsed`。
3. **验收**：构造双通道 mock delta → 前端 reasoning 只出现一份。

---

### BUG-06 · 无效 sessionCode 静默创建空会话 【P2】

**现象**

- 客户端携带已删除或不存在的 `sessionCode` 发消息。
- 服务端不 404，而是用该 code **新建空会话**并继续写入消息。
- 用户以为还在旧对话，实际是新空壳。

**根因**

`apps/server/src/store/sqlite.ts` — `ensureSession`：

```ts
if (sessionCode) {
  const existing = this.getSession(sessionCode);
  if (existing) return existing;
}
// 未找到时仍使用传入的 sessionCode 创建新 session
sessionCode: sessionCode ?? randomUUID(),
```

**涉及文件**

- `apps/server/src/store/sqlite.ts`
- `apps/server/src/routes/chat.ts`
- （可选）`apps/web/src/stores/chatStore.ts` — 收到 404 后 `newChat()` 或提示

**修复方向（待实现）**

1. **方案 A**：传入 `sessionCode` 且不存在 → `reply 404`，前端清空 `sessionCode` 重试或提示。
2. **方案 B**：不存在时忽略客户端 code，生成新 UUID（需在 `meta` 回传新 code，前端更新）。
3. **验收**：删除对话后仍用旧 code 发消息 → 行为符合选定方案，且不 silently 丢历史。

---

### BUG-07 · abort 后 provider `finally` 仍 flush 【P3】✅ 已修复

**修复**（2026-07-10）：`openai.ts` 的 `finally` 在 `signal.aborted` 时跳过 `parser.flush()`；正常结束与报错路径仍会 flush 未闭合标签。

**现象**

- 用户停止或连接断开，`chat.ts` 已 `break` 出 `for await`。
- `openaiStream` 的 `finally` 仍会 `parser.flush()` 并 `yield` 残留 chunk。
- 消费者已离开循环时，这些 yield 通常被丢弃，**实际影响小**。

**根因**

`apps/server/src/providers/openai.ts`：

```ts
} finally {
  for (const part of parser.flush()) {
    yield part;
  }
}
```

未区分 `signal.aborted` 与正常结束。

**修复方向（待实现）**

1. `finally` 内若 `signal.aborted` 则跳过 flush，或仅 flush 已被 chat 路由消费的语义下必要部分。
2. **验收**：停止生成无多余 SSE；正常结束仍 flush 未闭合标签。

---

## 3. 非 Bug / 暂不纳入本计划

| 项 | 说明 |
| --- | --- |
| 用户消息「编辑」不截断后续轮次 | 产品设计：仅 `prefillComposer` 回填，非缺陷 |
| 流式中切换会话 | 切换时 abort；已访问会话靠内存缓存恢复，未落库 partial 以 DB 为准 |
| 无单元测试 | 技术债；修复 BUG-01/05 时建议补 `thinkingParser` 最小用例 |
| TypeScript | `apps/web`、`apps/server` 分别 `tsc --noEmit` 已通过（审查时） |

---

## 4. 建议实施阶段

### Phase A — 数据一致性（优先）

- [x] BUG-01：空正文落库策略（占位符 `（本轮无正文输出）`）
- [x] BUG-02：过滤空 assistant history
- [x] BUG-03：`catch` 路径 partial 落库

**预估改动面**： primarily `chat.ts` + `chatStore.ts`  
**回归**：正常流式完成、停止生成、仅推理模型、刷新后历史列表

### Phase B — 健壮性

- [ ] BUG-04：`sseClient` 安全解析
- [ ] BUG-06：`sessionCode` 不存在时的 API 契约 + 前端处理

### Phase C — Provider 边缘

- [ ] BUG-05：双通道推理去重
- [x] BUG-07：abort 时 skip flush

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
| 前端状态 | `apps/web/src/stores/chatStore.ts` |
| SSE 客户端 | `apps/web/src/services/sseClient.ts` |
| 会话存储 | `apps/server/src/store/sqlite.ts` |

---

*最后更新：2026-07-10（同步 Phase 6 会话缓存与骨架屏行为）*
