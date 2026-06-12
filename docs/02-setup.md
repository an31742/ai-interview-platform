# 项目搭建与环境配置

## 一、依赖清单

```json
{
  "dependencies": {
    "next": "16.2.7",           // React 全栈框架，App Router
    "react": "19.2.4",          // UI 库
    "react-dom": "19.2.4",      // DOM 渲染
    "zustand": "^5.0.5",        // 轻量状态管理
    "openai": "^4.94.1",        // OpenAI SDK（兼容 DeepSeek）
    "react-markdown": "^10.1.0", // Markdown 渲染
    "rehype-highlight": "^7.0.2", // 代码语法高亮
    "remark-gfm": "^4.0.1",     // GFM 扩展（表格、任务列表）
    "lucide-react": "^0.487.0", // 图标库
    "class-variance-authority": "^0.7.1", // shadcn 变体管理
    "tailwind-merge": "^3.2.0",  // Tailwind 类名合并
    "tailwindcss-animate": "^1.0.7" // 动画工具
  }
}
```

## 二、环境变量 (.env.local)

```bash
# DeepSeek API 配置
DEEPSEEK_API_KEY=sk-your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

## 三、Next.js 配置 (next.config.ts)

```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};
```

## 四、TailwindCSS v4 配置说明

TailwindCSS v4 与 v3 的主要区别：

**v3 方式：** 使用 `tailwind.config.ts` 文件 + `@tailwind` 指令 + PostCSS 插件

**v4 方式：** 直接在 `globals.css` 中用 `@import "tailwindcss"` + `@theme` 块定义变量

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-primary: hsl(var(--primary));
  --color-background: hsl(var(--background));
  --radius-lg: var(--radius);
}
```

### tailwindcss-animate 兼容

`tailwindcss-animate` 是 TailwindCSS v3 的插件，v4 不支持。解决方案：手动在 `globals.css` 中定义动画关键帧和工具类。

```css
@keyframes enter {
  from {
    opacity: var(--tw-enter-opacity, 1);
    transform: translate3d(...);
  }
}

@keyframes exit {
  to {
    opacity: var(--tw-exit-opacity, 1);
    transform: translate3d(...);
  }
}

.animate-in {
  animation-name: enter;
  animation-duration: 150ms;
}

.fade-in-0 { --tw-enter-opacity: 0; }
.slide-in-from-left { --tw-enter-translate-x: -100%; }
```

## 五、shadcn/ui 配置 (components.json)

```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

## 六、初始化项目命令

```bash
# 创建 Next.js 项目
npx create-next-app@latest ai-chat --typescript --tailwind --eslint

# 安装核心依赖
npm install zustand openai react-markdown rehype-highlight remark-gfm lucide-react class-variance-authority tailwind-merge

# 安装 shadcn/ui 组件
npx shadcn@latest add button input sheet scroll-area separator

# 启动开发服务器
npm run dev
```
