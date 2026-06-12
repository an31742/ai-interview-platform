# Playground 增强功能

本文档记录了四个增强功能：UI 优化、模板保存/加载、A/B 对比测试、导航链接。

---

## 一、UI 优化

### 全局导航栏

```
┌─────────────────────────────────────────────────────┐
│  [💬 聊天]  [🧪 Playground]        AI Chat · DeepSeek│
└─────────────────────────────────────────────────────┘
```

**实现方式**：`components/shared/navbar.tsx`

- 使用 `usePathname()` 检测当前页面，高亮对应标签
- 不在 chat/playground 页面时自动隐藏
- 通过布局文件注入：`chat/layout.tsx` 和 `playground/layout.tsx` 各自引入

### 视觉优化

| 优化点 | 描述 |
|--------|------|
| 类型选择器 | 改为 2×2 卡片布局，选中状态有勾选图标 + 阴影 |
| 面板分隔 | 阴影分隔替代纯边框，视觉层次更清晰 |
| 按钮交互 | 统一 hover/focus 过渡动画 |
| 流式指示器 | 添加旋转动画 + 状态文字 |

---

## 二、模板保存/加载

### 数据结构

```typescript
interface SavedTemplate {
  id: string;
  name: string;
  promptType: PromptType;
  variables: PromptVariables;
  modelConfig: ModelConfig;
  createdAt: number;
  updatedAt: number;
}
```

### 功能流程

```
保存：
用户编辑好 Prompt → 点击"保存模板"
  → 弹出名称输入框 → 输入名称 → 回车保存
  → 存入 localStorage（通过 Zustand persist）

加载：
用户点击"加载模板"
  → 展开模板列表
  → 点击任一模板 → 自动填充编辑器和配置
  → 立即可以调整后发送

删除：
鼠标悬停模板 → 点击删除图标
```

### 持久化策略

```typescript
persist(
  // ...
  partialize: (state) => ({
    savedTemplates: state.savedTemplates,  // 持久化
    history: state.history,                 // 持久化
    // 其他运行时状态不持久化
  }),
)
```

### UI 位置

模板管理器位于左侧编辑器中，类型选择器下方：
```
Prompt 编辑器
├── Prompt 模式选择器
├── [💾 保存模板]  [📥 加载模板 (N)]
├── ───────────── 分隔线
└── 模板编辑区
```

---

## 三、A/B 对比测试

### 原理

```
同一个 Prompt
    ├──→ 配置 A (temperature=0.1)
    │       → 响应 A
    │
    └──→ 配置 B (temperature=0.9)
            → 响应 B
```

并发发送两个请求，结果并排展示，方便对比分析。

### 状态管理

```typescript
// Store 中新增
abTestMode: boolean;          // 是否开启 A/B 模式
abConfigA: ModelConfig;       // 配置 A
abConfigB: ModelConfig;       // 配置 B
abResponseA: string;          // 响应 A
abResponseB: string;          // 响应 B
abStreamingA: boolean;        // 流式状态 A
abStreamingB: boolean;        // 流式状态 B
```

### 使用流程

```
1. 在普通模式下编辑 Prompt
2. 点击 "🧪 A/B 对比测试" 按钮
3. 中间面板切换为 A/B 双配置：
   ┌─── 配置 A (蓝色) ───┐
   │ Temperature: 0.1    │
   │ Max Tokens: 2048    │
   └─────────────────────┘
   ┌─── 配置 B (绿色) ───┐
   │ Temperature: 0.9    │
   │ Max Tokens: 2048    │
   └─────────────────────┘
4. 点击 "运行 A/B 对比"
5. 右侧面板并排显示两个响应：
   ┌─── 结果 A (蓝色) ───┐
   │ Markdown 内容...     │
   └──────────────────────┘
   ┌─── 结果 B (绿色) ───┐
   │ Markdown 内容...     │
   └──────────────────────┘
6. 点击 "退出对比" 返回普通模式
```

### 组件结构

| 组件 | 用途 |
|------|------|
| `config/ab-config-panel.tsx` | 双配置面板 |
| `hooks/use-ab-send.ts` | 并发发送两个请求 |
| `output/output-panel.tsx` | 渲染对比结果（A/B 模式分支） |

---

## 四、导航链接

### 实现方式

在 `chat/layout.tsx` 和 `playground/layout.tsx` 中分别引入 `Navbar` 组件。

```
// 聊天布局
<Navbar />
<div className="flex flex-1">{children}</div>

// Playground 布局
<Navbar />
<div className="flex flex-1 min-h-0">{children}</div>
```

### 导航项

```typescript
const NAV_ITEMS = [
  { href: "/chat", label: "聊天", icon: MessageSquare },
  { href: "/playground", label: "Playground", icon: FlaskConical },
];
```

### 自动隐藏

```typescript
// 不在 chat 或 playground 页面时不显示
if (!pathname.startsWith("/chat") && !pathname.startsWith("/playground")) {
  return null;
}
```

---

## 五、完整文件清单

| 文件 | 操作 | 用途 |
|------|------|------|
| `components/shared/navbar.tsx` | ✨ 新建 | 全局导航栏 |
| `components/playground/editor/template-manager.tsx` | ✨ 新建 | 模板保存/加载 UI |
| `components/playground/config/ab-config-panel.tsx` | ✨ 新建 | A/B 对比配置面板 |
| `hooks/use-ab-send.ts` | ✨ 新建 | A/B 并发发送逻辑 |
| `types/playground.ts` | 🔧 扩展 | 添加 SavedTemplate 类型 |
| `store/playground-store.ts` | 🔧 扩展 | 添加模板 CRUD + AB 测试状态 |
| `app/chat/layout.tsx` | 🔧 修改 | 添加导航栏 |
| `app/playground/layout.tsx` | 🔧 修改 | 添加导航栏 |
| `app/playground/page.tsx` | 🔧 修改 | A/B 模式切换中间面板 |
| `components/playground/editor/prompt-editor.tsx` | 🔧 修改 | 集成模板管理器 |
| `components/playground/editor/prompt-type-selector.tsx` | 🔧 修改 | 卡片式布局优化 |
| `components/playground/config/model-config-panel.tsx` | 🔧 修改 | 添加 A/B 切换按钮 |
| `components/playground/output/output-panel.tsx` | 🔧 修改 | A/B 结果对比展示 |
| `hooks/use-playground-send.ts` | 🔧 修改 | 导出 buildPromptContent |
