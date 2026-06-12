"use client";

import { memo, useMemo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

/**
 * Markdown 渲染器（React.memo + 流式节流优化）
 *
 * ⚡ 优化策略：
 *
 * 1. React.memo — props 未变时跳过重渲染
 *    流式场景下，只有最后一条消息的 content 在变，历史消息不会重渲染
 *
 * 2. 流式节流 — 高频 chunk 更新时限制渲染频率 ≤ 150ms/次
 *    如果 1s 内收到 50 个 chunk，只会渲染 ~6-7 次，避免卡顿
 *
 * 3. CodeBlock 使用 React.memo — 代码块内容不变时跳过重渲染
 *
 * Props:
 * - content: 纯文本 Markdown 内容
 * - className: 附加样式类
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  // ===== 流式节流 =====
  const [displayContent, setDisplayContent] = useState(content);
  const lastRenderRef = useRef(Date.now());
  const latestContentRef = useRef(content);

  // 始终保持对最新内容的引用
  latestContentRef.current = content;

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastRenderRef.current;

    if (elapsed >= 150) {
      // ≥150ms 间隔：立即渲染
      setDisplayContent(content);
      lastRenderRef.current = now;
    } else {
      // <150ms：延迟到满 150ms 再渲染（丢弃中间态）
      const timer = setTimeout(() => {
        setDisplayContent(latestContentRef.current);
        lastRenderRef.current = Date.now();
      }, 150 - elapsed);
      return () => clearTimeout(timer);
    }
  }, [content]);

  /**
   * 组件对象静态化：避免每次渲染重新创建对象引用
   * 这样 ReactMarkdown 内部的子组件不会因为父组件重建而重渲染
   */
  const components = useRef(MARKDOWN_COMPONENTS).current;

  if (!content) return null;

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none break-words ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
});

/**
 * 代码块组件（React.memo 优化）
 *
 * 按用途分为两种样式：
 * - 内联代码 (`: 灰色背景 + monospace font
 * - 块级代码：深色背景 + 语言标签头 + 复制按钮
 */
const CodeBlock = memo(function CodeBlock({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const isInline = !className;
  const codeText = useMemo(
    () => String(children).replace(/\n$/, ""),
    [children]
  );

  // 内联代码
  if (isInline) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  }

  // 块级代码
  const language = className?.replace("language-", "") || "";

  return (
    <div className="group relative my-3 rounded-lg border bg-zinc-950 dark:bg-zinc-900">
      {/* 代码块头部：语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between rounded-t-lg border-b bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
        <span>{language || "code"}</span>
        <button
          onClick={() => navigator.clipboard.writeText(codeText)}
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
        >
          复制
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
});

/**
 * 静态组件映射（模块级常量，只创建一次）
 * 定义在 CodeBlock 之后，避免引用未声明的变量
 */
const MARKDOWN_COMPONENTS: Components = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock,
};
