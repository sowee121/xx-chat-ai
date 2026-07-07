import type { ChatStream, StreamOptions } from '../types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function codeAnswer(q: string): string[] {
  return [
    `下面是「${q}」对应的实现：`,
    '',
    '```ts',
    'export function debounce<T extends (...args: any[]) => void>(',
    '  fn: T,',
    '  delay = 300,',
    ') {',
    '  let timer: ReturnType<typeof setTimeout> | undefined',
    '  return (...args: Parameters<T>) => {',
    '    clearTimeout(timer)',
    '    timer = setTimeout(() => fn(...args), delay)',
    '  }',
    '}',
    '```',
    '',
    '- 连续触发时不断重置计时器，只有停止触发 `delay` 毫秒后才执行；',
    '- 常用于搜索输入、窗口 `resize`、按钮防连点等场景。',
  ];
}

function tableAnswer(q: string): string[] {
  return [
    `关于「${q}」，可以从下表快速对比：`,
    '',
    '| 维度 | SSE (Server-Sent Events) | WebSocket |',
    '| --- | --- | --- |',
    '| 通信方向 | 服务端 → 客户端（单向） | 双向全双工 |',
    '| 底层协议 | 基于 HTTP | 独立的 ws/wss 协议 |',
    '| 自动重连 | 浏览器原生支持 | 需自行实现 |',
    '| 数据格式 | 文本（UTF-8） | 文本 / 二进制 |',
    '| 适用场景 | 消息推送、AI 流式输出 | 聊天室、协同编辑、游戏 |',
    '',
    '> 本项目的流式回答用的正是 **SSE**：服务端单向、逐块推送即可满足需求。',
  ];
}

function mermaidAnswer(q: string): string[] {
  return [
    `这是「${q}」的流程图：`,
    '',
    '```mermaid',
    'graph TD',
    '  A[打开登录页] --> B[输入账号密码]',
    '  B --> C{校验表单}',
    '  C -->|不通过| B',
    '  C -->|通过| D[提交后端]',
    '  D --> E{凭证正确?}',
    '  E -->|否| F[提示错误] --> B',
    '  E -->|是| G[签发 Token] --> H[进入首页]',
    '```',
    '',
    '点击图表右上角按钮可放大查看。',
  ];
}

function showcaseAnswer(q: string): string[] {
  return [
    `## 关于「${q}」的回答`,
    '',
    '我可以用多种 Markdown 格式来组织答案，下面是一个综合示例：',
    '',
    '### 表格（GFM）',
    '',
    '| 能力 | 说明 | 状态 |',
    '| --- | --- | :---: |',
    '| SSE 流式 | 逐块推送并累加 | ✅ |',
    '| 代码高亮 | Streamdown 渲染 | ✅ |',
    '| Mermaid | 图表渲染 | ✅ |',
    '',
    '### 代码块',
    '',
    '```ts',
    'export function greet(name: string) {',
    '  return `Hello, ${name}!`',
    '}',
    '```',
    '',
    '### 图片',
    '',
    '![示例图片](https://picsum.photos/seed/xxchatai/640/360)',
    '',
    '### Mermaid 流程图',
    '',
    '```mermaid',
    'graph TD',
    '  A[用户输入] --> B{Provider}',
    '  B -->|mock| C[本地多格式流]',
    '  B -->|openai| D[OpenAI API]',
    '  C --> E[Streamdown 渲染]',
    '  D --> E',
    '```',
    '',
    '试试问我「对比 SSE 与 WebSocket」「写一个防抖函数」或「画个登录流程图」，我会给出更聚焦的回答。',
  ];
}

/** 根据关键词识别意图，返回对应格式的回答；无法识别时给出多格式合集。 */
function buildMockMarkdown(query: string): string {
  const q = query.trim() || '你的问题';
  const lower = q.toLowerCase();

  const wantsMermaid = /mermaid|流程图|时序图|流程|图表/.test(q);
  const wantsCode = /防抖|节流|debounce|throttle|函数|代码|typescript|javascript|\bts\b|\bjs\b/.test(lower);
  const wantsTable = /表格|对比|比较|区别|差异|sse|websocket/.test(lower);

  let lines: string[];
  if (wantsMermaid) lines = mermaidAnswer(q);
  else if (wantsCode) lines = codeAnswer(q);
  else if (wantsTable) lines = tableAnswer(q);
  else lines = showcaseAnswer(q);

  return lines.join('\n');
}

/** 把整段文本切成 2~5 个字符的小块，模拟 token 级流式。 */
function* chunkText(text: string): Generator<string> {
  let i = 0;
  while (i < text.length) {
    const size = 2 + Math.floor(Math.random() * 4);
    yield text.slice(i, i + size);
    i += size;
  }
}

export async function* mockStream(opts: StreamOptions): ChatStream {
  const { query, signal } = opts;
  const full = buildMockMarkdown(query);

  for (const chunk of chunkText(full)) {
    if (signal.aborted) return;
    yield chunk;
    await sleep(18 + Math.floor(Math.random() * 22));
  }
}
