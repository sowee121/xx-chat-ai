/**
 * Mock Provider：按关键词返回多格式流式示例
 */
import type { ChatStream, StreamOptions } from '../types.js';

/** 可取消的延迟等待*/
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mock：代码意图回复*/
function codeAnswer(q: string): string[] {
  const wantsThrottle = /节流|throttle/i.test(q);
  const lines = [
    `下面是「${q}」对应的实现：`,
    '',
    '**防抖 debounce**：连续触发时重置计时，停止触发后再执行。',
    '',
    '```js',
    'function debounce(fn, delay = 300) {',
    '  let timer',
    '  return (...args) => {',
    '    clearTimeout(timer)',
    '    timer = setTimeout(() => fn(...args), delay)',
    '  }',
    '}',
    '```',
  ];

  if (wantsThrottle) {
    lines.push(
      '',
      '**节流 throttle**：在固定时间窗口内最多执行一次。',
      '',
      '```js',
      'function throttle(fn, interval = 300) {',
      '  let last = 0',
      '  return (...args) => {',
      '    const now = Date.now()',
      '    if (now - last >= interval) {',
      '      last = now',
      '      fn(...args)',
      '    }',
      '  }',
      '}',
      '```',
    );
  }

  lines.push(
    '',
    '- 防抖适合搜索联想、表单校验；节流适合滚动监听、拖拽跟手等场景。',
  );

  return lines;
}

/** Mock：表格意图回复*/
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

/** 登录流程图示例块 */
const LOGIN_FLOW_MERMAID_LINES = [
  'graph TD',
  '  A([开始]) --> B["输入账号密码 / 验证码 / 第三方授权"]',
  '  B --> C{校验表单}',
  '  C -->|不通过| B',
  '  C -->|通过| D[提交后端]',
  '  D --> E{凭证正确?}',
  '  E -->|否| F[提示错误] --> B',
  '  E -->|是| G[签发 Token] --> H[进入首页]',
] as const;

/** Mock：流程图意图回复*/
function mermaidAnswer(q: string): string[] {
  return [
    `这是「${q}」的流程图：`,
    '',
    '```mermaid',
    ...LOGIN_FLOW_MERMAID_LINES,
    '```',
    '',
    '点击图表右上角按钮可放大查看。',
  ];
}

/** 标准 xychart-beta 示例块（与 systemPrompt 约定一致） */
const XYCHART_MERMAID_LINES = [
  'xychart-beta',
  '    title "某产品月度销售额"',
  '    x-axis [1月, 2月, 3月]',
  '    y-axis "销售额 (万元)" 0 --> 4000',
  '    bar [1200, 1320, 1540]',
  '    bar [1800, 1750, 1680]',
  '    bar [2500, 2680, 3720]',
] as const;

/** Mock：图表示例（流程图 + 数值图） */
function chartExamplesAnswer(q: string): string[] {
  return [
    `## 图表示例`,
    '',
    `关于「${q}」，下面是两种常用 Mermaid 图表的标准写法：`,
    '',
    '### 流程图（graph TD）',
    '',
    '```mermaid',
    ...LOGIN_FLOW_MERMAID_LINES,
    '```',
    '',
    '### 数值图（xychart-beta）',
    '',
    '```mermaid',
    ...XYCHART_MERMAID_LINES,
    '```',
    '',
    '数值图每个 `bar […]` 为一组系列，数组长度须与 `x-axis` 类别数一致；勿使用 `barChart`、`xAxis`、`series` 等自创关键字。',
    '',
    '点击图表右上角按钮可放大查看。',
  ];
}

/** Mock：数值图（xychart-beta）意图回复 */
function xychartAnswer(q: string): string[] {
  return [
    `这是「${q}」的数值图示例（标准 \`xychart-beta\`）：`,
    '',
    '```mermaid',
    ...XYCHART_MERMAID_LINES,
    '```',
    '',
    '每个 `bar […]` 为一组系列，数组长度须与 `x-axis` 类别数一致；勿使用 `barChart`、`xAxis`、`series` 等自创关键字。',
    '',
    '点击图表右上角按钮可放大查看。',
  ];
}

/** Mock：公式意图回复*/
function mathAnswer(q: string): string[] {
  return [
    `关于「${q}」，下面是一些常用公式示例：`,
    '',
    '**行内公式**：质能方程 $E = mc^2$，欧拉恒等式 $e^{i\\pi} + 1 = 0$。',
    '',
    '**块级公式**（高斯积分）：',
    '',
    '$$',
    '\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}',
    '$$',
    '',
    '**二次方程求根公式**：',
    '',
    '$$',
    'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    '$$',
  ];
}

/** Mock：图片意图回复*/
function imageAnswer(q: string): string[] {
  return [
    `这是一张与「${q}」相关的示例图：`,
    '',
    '![山水草木](https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1280&h=720&fit=crop&q=100&auto=format)',
    '',
    '点击图片可放大预览。',
  ];
}

/** Mock：多格式综合回复*/
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
    '![山水草木](https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1280&h=720&fit=crop&q=100&auto=format)',
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
    '### Mermaid 数值图（xychart-beta）',
    '',
    '```mermaid',
    ...XYCHART_MERMAID_LINES,
    '```',
    '',
    '### 数学公式',
    '',
    '行内：$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$',
    '',
    '块级：',
    '',
    '$$',
    'E = mc^2',
    '$$',
    '',
    '试试问我「对比 SSE 与 WebSocket」「写一个防抖函数」「图表示例」或「数学公式示例」。',
  ];
}

/** Mock：深度思考示例（先 reasoning 再正文） */
function reasoningDemoAnswer(q: string): { reasoning: string; text: string } {
  const reasoning = [
    '用户想看「思考块 + 正文」的流式效果，我先拆开问题目标。',
    '',
    '1. 先给出可折叠的推理过程，模拟真实模型逐步分析。',
    '2. 再输出简洁 Markdown 正文，方便验证 UI 分层展示。',
    '3. 保持内容短小，避免演示时过长。',
    '',
    '结论：分两段推送——reasoning 结束后再写正文。',
  ].join('\n');

  const text = [
    `## 深度思考示例`,
    '',
    `你发送的是「${q}」。上面是模拟的思考过程，下面是最终回答：`,
    '',
    '- **思考块**：对应 `reasoning` 流式字段，可折叠查看',
    '- **正文**：对应 `text` 流式字段，正常 Markdown 渲染',
    '',
    '切换到 OpenAI Provider 后，真实推理模型也会走同样的两段展示。',
  ].join('\n');

  return { reasoning, text };
}

/** 根据关键词识别意图，返回对应格式的回答；无法识别时给出多格式合集*/
function buildMockMarkdown(query: string): string {
  const q = query.trim() || '你的问题';
  const lower = q.toLowerCase();

  const wantsChartExamples = /图表示例/.test(q);
  const wantsXychart = /xychart|数值图|柱状图|折线图|月度销售|销售占比|销售数据/.test(q);
  const wantsMermaid = /mermaid|流程图|时序图|流程|图表/.test(q);
  const wantsMath = /公式|latex|math|积分|求导|方程|质能|欧拉/.test(lower);
  const wantsCode = /防抖|节流|debounce|throttle|函数|代码|typescript|javascript|\bts\b|\bjs\b/.test(lower);
  const wantsTable = /表格|对比|比较|区别|差异|sse|websocket/.test(lower);
  const wantsImage = /图片|示例图|插入.*图|photo|image/.test(lower);

  let lines: string[];
  if (wantsChartExamples) lines = chartExamplesAnswer(q);
  else if (wantsXychart) lines = xychartAnswer(q);
  else if (wantsMermaid) lines = mermaidAnswer(q);
  else if (wantsMath) lines = mathAnswer(q);
  else if (wantsCode) lines = codeAnswer(q);
  else if (wantsTable) lines = tableAnswer(q);
  else if (wantsImage) lines = imageAnswer(q);
  else lines = showcaseAnswer(q);

  return lines.join('\n');
}

/** 把整段文本切成 2~5 个字符的小块，模拟 token 级流式*/
function* chunkText(text: string): Generator<string> {
  let i = 0;
  while (i < text.length) {
    const size = 2 + Math.floor(Math.random() * 4);
    yield text.slice(i, i + size);
    i += size;
  }
}

/** 按关键词生成 Markdown，再分片 yield 模拟真实 SSE */
export async function* mockStream(opts: StreamOptions): ChatStream {
  const { query, signal } = opts;
  const q = query.trim();
  const wantsReasoningDemo = /深度思考|思考示例|reasoning/.test(q);

  if (wantsReasoningDemo) {
    const { reasoning, text } = reasoningDemoAnswer(q || '深度思考示例');
    for (const chunk of chunkText(reasoning)) {
      if (signal.aborted) return;
      yield { type: 'reasoning', content: chunk };
      await sleep(16 + Math.floor(Math.random() * 18));
    }
    if (signal.aborted) return;
    await sleep(120);
    for (const chunk of chunkText(text)) {
      if (signal.aborted) return;
      yield { type: 'text', content: chunk };
      await sleep(18 + Math.floor(Math.random() * 22));
    }
    return;
  }

  const full = buildMockMarkdown(query);

  for (const chunk of chunkText(full)) {
    if (signal.aborted) return;
    yield { type: 'text', content: chunk };
    await sleep(18 + Math.floor(Math.random() * 22));
  }
}
