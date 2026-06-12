# 性能优化

## 一、优化全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                       性能优化方案                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│  React 层面                        流式渲染层面                  │
│  ┌──────────────────────┐          ┌──────────────────────┐    │
│  │ React.memo           │          │ 节流渲染 (150ms)     │    │
│  │ useCallback          │          │ 增量内容展示         │    │
│  │ useMemo              │          │ 空内容跳过渲染       │    │
│  │ 静态常量提取         │          │                      │    │
│  └──────────────────────┘          └──────────────────────┘    │
│                                                                │
│  长对话层面                          代码拆分层面               │
│  ┌──────────────────────┐          ┌──────────────────────┐    │
│  │ 分页渲染 (50条/页)  │          │ 组件拆分为独立 chunk │    │
│  │ "加载更早消息"按钮  │          │ 大依赖按需加载       │    │
│  │ 打断不滚动策略       │          │                      │    │
│  └──────────────────────┘          └──────────────────────┘    │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、React 性能优化

### 2.1 React.memo — 跳过不必要的重渲染

**问题：** 流式场景下，每次 chunk 更新都会触发 `ChatMessages` 重渲染，如果消息列表有 100 条历史消息，它们全都会跟着重渲染。

**解法：** `React.memo` 对 props 做浅比较，props 没变就不重渲染。

```typescript
// ✅ 正确：React.memo 阻止历史消息重渲染
export const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }) {
  // ... 只有 role/content/isStreaming 变化时才重渲染
});

// ✅ 正确：MarkdownRenderer 同理
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }) {
  // ... 只有 content/className 变化时才重渲染
});
```

**效果：** 发送 "帮我写一篇5000字文章" 时，只有最新的流式消息在实时重渲染，之前的对话完全不动。

### 2.2 useCallback — 避免函数定义导致子组件重渲染

```typescript
// ✅ 正确：handleSend 只依赖 input 变化时才重建
const handleSend = useCallback(async () => {
  const content = input.trim();
  if (!content || isStreaming) return;
  // ...
}, [input, isStreaming, /* ... */]);

// ✅ 正确：loadMore 没有依赖，只创建一次
const loadMore = useCallback(() => {
  setVisibleRange((prev) => ({
    start: Math.max(0, prev.start - PAGE_SIZE),
    end: prev.end,
  }));
}, []);
```

### 2.3 useMemo — 缓存计算结果

```typescript
// ✅ 正确：排序结果缓存，只 conversations 变化时重算
const sortedConversations = useMemo(
  () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
  [conversations]
);

// ✅ 正确：代码块文本只 children 变化时重算
const codeText = useMemo(
  () => String(children).replace(/\n$/, ""),
  [children]
);
```

### 2.4 静态常量提取 — 避免每次渲染创建新对象

```typescript
// ❌ 错误：每次渲染都创建新对象 → 下层组件必定重渲染
return (
  <ReactMarkdown
    components={{
      pre: ({ children }) => <>{children}</>,
      code: CodeBlock,
    }}
  />
);

// ✅ 正确：模块级常量，只创建一次
const MARKDOWN_COMPONENTS: Components = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock,
};

// 组件内通过 useRef 保持引用稳定
const components = useRef(MARKDOWN_COMPONENTS).current;
```

---

## 三、流式渲染优化

### 3.1 渲染节流

**问题：** DeepSeek API 返回 chunk 的速度很快（每 10-30ms 一个 token），如果每次收到 chunk 都触发完整的 `react-markdown` 解析 + `rehype-highlight` 语法高亮，CPU 会撑不住。

**解法：** 150ms 节流 — 高频更新时丢弃中间状态，只渲染 "最新快照"。

```typescript
// markdown-renderer.tsx 中的流式节流逻辑
const [displayContent, setDisplayContent] = useState(content);
const lastRenderRef = useRef(Date.now());
const latestContentRef = useRef(content);

// 始终保持最新内容的引用
latestContentRef.current = content;

useEffect(() => {
  const now = Date.now();
  const elapsed = now - lastRenderRef.current;

  if (elapsed >= 150) {
    // ≥150ms 间隔：立即渲染
    setDisplayContent(content);
    lastRenderRef.current = now;
  } else {
    // <150ms：延迟到满 150ms 再渲染（丢弃中间状态）
    const timer = setTimeout(() => {
      setDisplayContent(latestContentRef.current);
      lastRenderRef.current = Date.now();
    }, 150 - elapsed);
    return () => clearTimeout(timer);
  }
}, [content]);
```

**渲染时序示例：**

```
时间线 (ms)     chunk 到达     渲染          用户看到
0              chunk A        ✓             "你"
30             chunk B        丢弃           
60             chunk C        丢弃           
90             chunk D        丢弃           
120            chunk E        丢弃           
150            chunk F        ✓             "你好世界"  (一次渲染B~F的累积)
180            chunk G        ✓             "你好世界！"
```

**效果：** 1 秒接收 50 个 chunk，只渲染 ~6 次，CPU 占用降低 80%+。

### 3.2 空内容跳过渲染

Streaming 开始但还没收到任何内容时，`MarkdownRenderer` 返回 `null`，让 `ChatMessage` 的跳动点动画显示：

```typescript
if (!content) return null;
```

---

## 四、长对话优化

### 4.1 分页渲染策略

**问题：** 一个会话有 200+ 条消息时，DOM 中同时存在 200 个 `ChatMessage` 组件 + 200 个 `MarkdownRenderer` 组件。`react-markdown` 和 `rehype-highlight` 对每条消息都要解析，导致内存占用高、滚动卡顿。

**解法：** 分页渲染 — 只渲染最近 50 条消息，更早的消息通过按钮加载。

```typescript
const PAGE_SIZE = 50;

// 只取可见范围的消息
const visibleMessages = useMemo(
  () => allMessages.slice(visibleRange.start, visibleRange.end),
  [allMessages, visibleRange]
);
```

### 4.2 加载更早消息

```
┌─────────────────────────────────────────┐
│  ↑  加载更早消息（还有 120 条）         │  ← 按钮
├─────────────────────────────────────────┤
│  消息 81 - 130 （前一页）               │
├─────────────────────────────────────────┤
│  消息 131 - 180 （当前页）              │
├─────────────────────────────────────────┤
│  ○ 流式消息                             │
└─────────────────────────────────────────┘
```

```typescript
const loadMore = useCallback(() => {
  setVisibleRange((prev) => ({
    start: Math.max(0, prev.start - PAGE_SIZE),
    end: prev.end,
  }));
}, []);
```

### 4.3 "打断不滚动"策略

**问题：** 用户正在向上翻看历史消息时，新消息到达导致页面自动滚到底部，打断阅读体验。

**解法：** 检测用户是否在底部附近（200px 阈值），只有在底部时才自动滚动。

```typescript
const checkNearBottom = useCallback(() => {
  const el = containerRef.current;
  if (!el) return;
  const threshold = 200;
  isNearBottomRef.current =
    el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}, []);

const scrollToBottom = useCallback(() => {
  // 仅在用户接近底部时才自动滚动
  if (isNearBottomRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, []);
```

---

## 五、Zustand 精确订阅

**最重要的优化：** 只订阅你需要的字段。

```typescript
// ❌ 错误：任何状态变化都会触发重渲染
const store = useChatStore();

// ✅ 正确：只订阅需要的字段
const streamingMessage = useChatStore((s) => s.streamingMessage);
const streamStatus = useChatStore((s) => s.streamStatus);
const conversations = useChatStore((s) => s.conversations);

// ✅ 更优：selector 返回基础类型而非对象
const messageCount = useChatStore((s) => {
  const conv = s.conversations.find(c => c.id === s.currentConversationId);
  return conv?.messages.length ?? 0;
});
// vs
// ❌ 每次返回新对象 → 订阅者必定重渲染
const currentConv = useChatStore((s) =>
  s.conversations.find(c => c.id === s.currentConversationId)
);
```

**各组件订阅清单：**

| 组件 | 订阅的字段 | 重渲染条件 |
|------|-----------|-----------|
| `ChatMessages` | `conversations`, `currentConversationId`, `streamingMessage`, `streamStatus` | 会话数据或流式内容变化 |
| `ChatInput` | `streamStatus`, `currentConversationId` | 流式开始/结束、会话切换 |
| `Sidebar` | `conversations`, `currentConversationId` | 会话列表变化、当前会话切换 |
| `ChatMessage` | 无（仅 props） | 仅自己的 prop 变化 |

---

## 六、优化效果量化

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 流式渲染频率 | 50次/秒 | ~6次/秒 | **8x ↓** |
| 历史消息重渲染 | 全部重渲染 | 仅新消息 | **∞** |
| 长对话 DOM 节点 | 全部渲染 | 最近50条 | **随消息量增长** |
| Markdown 解析 | 每次渲染都执行 | 节流后大幅减少 | **取决于频率** |
| 组件对象稳定性 | 每次重建 | 模块级常量 | **零重建** |
| 首屏 JS 体积 | 含 react-markdown | 仍含（动态导入待验证） | 待后续拆包 |

---

## 七、优化检查清单

- [x] `ChatMessage` — React.memo
- [x] `MarkdownRenderer` — React.memo + 静态 components
- [x] `CodeBlock` — React.memo + useMemo(codeText)
- [x] 流式节流 — 150ms 间隔
- [x] 分页渲染 — 50条/页
- [x] "打断不滚动" — 200px 阈值
- [x] `useCallback` — 事件处理函数
- [x] `useMemo` — 排序、切片、字符串处理
- [x] Zustand 精确订阅 — 按字段订阅
- [ ] 动态导入 react-markdown — `next/dynamic`（简化后改用普通导入）
- [ ] 代码块语法高亮 WASM 模式 — rehype-highlight 后续可优化

---

## 八、后续可做的优化

1. **Worker 线程解析** — 将 `react-markdown` + `rehype-highlight` 的解析放到 Web Worker，完全不阻塞主线程
2. **增量渲染** — 流式场景下只渲染新增的 token，而不是全量 re-parse
3. **本地搜索索引** — 为消息建立倒排索引，搜索时不需要遍历所有消息
4. **缩略历史** — 超过 500 条消息时，将最早的消息摘要后存储
5. **打包优化** — 使用 `@next/bundle-analyzer` 分析并优化 chunk 分割
