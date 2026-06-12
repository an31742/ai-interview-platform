# 历史会话管理

## 一、数据结构

### 核心模型

```typescript
// types/chat.ts

/** 会话 */
interface Conversation {
  id: string;             // UUID，同时也是 URL 参数
  title: string;          // 自动生成（首条用户消息截取前30字 + ...）
  messages: Message[];    // 消息列表
  createdAt: number;      // 创建时间戳
  updatedAt: number;      // 最后更新时间戳
  tokenUsage: TokenUsage; // Token 统计
}

/** Token 统计 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

### 存储格式（localStorage）

```json
{
  "state": {
    "conversations": [
      {
        "id": "a1b2c3d4-...",
        "title": "用Python实现快速排序",
        "messages": [ ... ],
        "createdAt": 1712345678000,
        "updatedAt": 1712345690000,
        "tokenUsage": {
          "promptTokens": 50,
          "completionTokens": 200,
          "totalTokens": 250
        }
      }
    ],
    "currentConversationId": "a1b2c3d4-..."
  },
  "version": 1
}
```

## 二、存储方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Zustand persist** | ✅ 本项目 | 自动同步、API 简洁、选择性子持久化 | 抽象化，对新手不透明 |
| 手动 localStorage | 简单数据 | 完全可控 | 需自处理 JSON parse/stringify、变更监听 |
| IndexedDB | 大量数据（>5MB） | 异步、大容量 | 复杂，读取慢 |
| 云端存储 | 跨设备同步 | 永不丢失 | 需要后端 + 服务器费用 |

**为什么选 Zustand persist：**
- 一行 `partialize` 配置即可选择哪些字段持久化
- 自动处理序列化/反序列化
- `onRehydrateStorage` 回调解决 hydration 时序问题
- 切换为云端存储时，只需替换 persist 的 storage engine

## 三、持久化流程

```
页面首次加载
  ↓
Zustand Store 初始化
  conversations: [], currentConversationId: null, _hydrated: false
  ↓
persist 中间件从 localStorage 读取
  ↓
  onRehydrateStorage 回调
  ↓
  _hydrated = true  ← 标记恢复完成
  ↓
页面 useEffect 检测到 _hydrated，开始处理 URL
  ↓
  id === "new" → 新建
  id 存在 → selectConversation(id)
  id 不存在 → 新建（兜底）
```

## 四、会话切换流程

### 用户点击侧栏会话

```
Sidebar.handleSelect(id)
  → store.selectConversation(id)    // 更新 store 当前会话
  → router.push(`/chat/c/${id}`)    // 更新 URL
  → ConversationPage 重新渲染        // 读取新会话的消息
  → ChatMessages 展示新会话的消息列表
```

### 用户新建对话

```
Sidebar.handleNewChat()
  → store.addConversation()         // 创建空会话，返回 UUID
  → router.push(`/chat/c/${uuid}`)  // 跳转到新 URL
  → ConversationPage 显示空状态      // 无消息，显示 EmptyState
  → ChatInput 已就绪
  → 用户输入消息 → 正常 AI 交互
```

### 用户删除会话

```
Sidebar.handleDelete(e, id)
  → e.stopPropagation()             // 阻止触发 handleSelect
  → store.deleteConversation(id)
    → 过滤掉该会话
    → 如果删除的是当前会话，切换到最近一个或 null
  → 跳转到新当前会话或 /chat
```

### 页面刷新

```
浏览器刷新
  ↓
Next.js SSR → 客户端渲染
  ↓
Zustand Store 初始化（空数据）
  ↓
persist 中间件异步恢复
  ↓
  _hydrated = true
  ↓
useEffect 检测到 hydrated
  → 从 URL 读取 id
  → 匹配 conversations → selectConversation
  → 完美恢复之前的会话状态
```

## 五、标题自动生成

```typescript
// 在 store/chat-store.ts 的 addMessage 中
title:
  conv.title === "新对话" && messageInput.role === "user"
    ? messageInput.content.slice(0, 30) +
      (messageInput.content.length > 30 ? "..." : "")
    : conv.title
```

规则：
- 首次添加用户消息时，截取内容前 30 字符作为标题
- 超过 30 字符追加 `...`
- 已有自定义标题不受影响
- 后续消息不更新标题

## 六、排序策略

```typescript
// 按 updatedAt 倒序（最新的在最上面）
const sortedConversations = useMemo(
  () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
  [conversations]
);
```

- 每次添加消息时 `updatedAt` 都会更新
- 最近的对话自动排到最前面
- `useMemo` 缓存排序结果，仅 `conversations` 变化时重算

## 七、存储封装

`services/storage.ts` 提供辅助工具：

| 函数 | 用途 |
|------|------|
| `getStorageVersion()` | 版本检测，用于数据迁移 |
| `getConversationCount()` | 会话数量统计 |
| `exportData()` | 导出为 JSON（备份） |
| `importData(json)` | 从 JSON 导入（恢复） |
| `getStorageSize()` | 存储空间占用 |
| `clearStorage()` | 清空所有数据 |

## 八、持久化配置

```typescript
persist(
  (set, get) => ({ /* store */ }),
  {
    name: "ai-chat-storage",
    // 选择哪些字段持久化（排除运行时状态）
    partialize: (state) => ({
      conversations: state.conversations,
      currentConversationId: state.currentConversationId,
    }),
    // 恢复完成回调
    onRehydrateStorage: () => {
      return (state) => {
        if (state) state._setHydrated(true);
      };
    },
  }
)
```

**不持久化的字段：**
- `streamStatus` — 流式状态，刷新后重置为 `idle`
- `streamingMessage` — 流式缓存内容，刷新后清空
- `error` — 临时错误信息
- `_hydrated` — 运行时标记

## 九、Hydration 时序问题的解决

**问题：** Zustand persist 从 localStorage 读取数据是异步的。页面首次渲染时，`conversations` 是 `[]`，导致 URL 中的有效 ID 匹配失败，错误地创建新会话。

**解法：**

```typescript
// 1. Store 添加 _hydrated 标记
_hydrated: false

// 2. persist 配置 onRehydrateStorage 回调
onRehydrateStorage: () => (state) => {
  if (state) state._setHydrated(true);
}

// 3. 页面 useEffect 等待 hydrated
useEffect(() => {
  if (!hydrated) return;  // ← 关键：等数据恢复
  if (initializedRef.current) return;
  initializedRef.current = true;

  if (id === "new") {
    const newId = addConversation();
    window.history.replaceState(null, "", `/chat/c/${newId}`);
  } else {
    const exists = conversations.some((c) => c.id === id);
    if (exists) {
      selectConversation(id);
    } else {
      const newId = addConversation();
      window.history.replaceState(null, "", `/chat/c/${newId}`);
    }
  }
}, [hydrated, id]);
```
