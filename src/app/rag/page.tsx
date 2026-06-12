"use client";

import { useEffect } from "react";
import { useRagStore } from "@/store/rag-store";
import { DocumentUpload } from "@/components/rag/document-upload";
import { DocumentList } from "@/components/rag/document-list";
import { RagChat } from "@/components/rag/rag-chat";

/**
 * RAG 知识库问答主页面
 *
 * 布局：
 * ┌──────────────────────────────────────────────┐
 * │                     Navbar                    │
 * ├──────────────┬───────────────────────────────┤
 * │  左侧面板     │           右侧主区域             │
 * │  (文档管理)   │          (RAG 问答)             │
 * │ ┌──────────┐ │  ┌───────────────────────────┐ │
 * │ │ PDF 上传 │ │  │                           │ │
 * │ ├──────────┤ │  │      RAG 聊天界面           │ │
 * │ │ 文档列表 │ │  │                           │ │
 * │ │ ─────── │ │  │                           │ │
 * │ │ 配置选项 │ │  │                           │ │
 * │ └──────────┘ │  └───────────────────────────┘ │
 * └──────────────┴───────────────────────────────┘
 */
export default function RagPage() {
  const setDocuments = useRagStore((s) => s.setDocuments);

  // 页面加载时获取已索引文档列表
  useEffect(() => {
    fetch("/api/rag/upload")
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setDocuments(data.documents);
        }
      })
      .catch(() => {
        // 首次加载没有文档是正常的
      });
  }, [setDocuments]);

  return (
    <div className="flex h-full w-full">
      {/* 左侧面板：文档管理 */}
      <div className="w-[340px] min-w-[300px] max-w-[380px] border-r bg-background flex flex-col shrink-0">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">知识库</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <DocumentUpload />
          <DocumentList />

          {/* 分隔 */}
          <div className="border-t" />

          {/* 使用说明 */}
          <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">💡 使用说明</p>
            <p>1. 上传 PDF 文档（自动切片 + 索引）</p>
            <p>2. 等待状态变为「就绪」</p>
            <p>3. 在右侧提问，AI 将基于文档回答</p>
          </div>
        </div>
      </div>

      {/* 右侧主区域：RAG 问答 */}
      <div className="flex-1 flex flex-col min-w-0">
        <RagChat />
      </div>
    </div>
  );
}
