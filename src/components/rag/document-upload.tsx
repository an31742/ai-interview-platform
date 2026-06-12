"use client";

import { useCallback, useRef, useState } from "react";
import { useRagStore } from "@/store/rag-store";
import { Upload, FileText, Loader2 } from "lucide-react";

/**
 * PDF 上传组件
 *
 * 支持拖拽上传 + 点击选择
 * 上传后自动触发后台处理（解析 → 切片 → Embedding → 存储）
 */
export function DocumentUpload() {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = useRagStore((s) => s.uploading);
  const setUploading = useRagStore((s) => s.setUploading);
  const documents = useRagStore((s) => s.documents);
  const setDocuments = useRagStore((s) => s.setDocuments);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("仅支持 PDF 文件格式");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("文件大小超过 10MB 限制");
        return;
      }

      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/rag/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "上传失败");
        }

        const data = await res.json();
        // 添加到文档列表
        setDocuments([
          ...documents,
          {
            id: data.id,
            filename: data.filename,
            status: "processing",
            chunkCount: 0,
            fileSize: file.size,
            uploadedAt: Date.now(),
          },
        ]);

        // 轮询文档处理状态
        pollDocumentStatus(data.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [documents, setDocuments, setUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  return (
    <div>
      {/* 拖拽区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleChange}
        />

        {uploading ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">正在处理...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">拖拽 PDF 到此处，或点击上传</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              支持 PDF 格式，最大 10MB
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 轮询文档处理状态
 */
async function pollDocumentStatus(docId: string) {
  const check = async () => {
    const res = await fetch("/api/rag/upload");
    const data = await res.json();
    const doc = data.documents?.find((d: { id: string }) => d.id === docId);
    if (!doc) return true;

    const store = useRagStore.getState();
    if (doc.status === "ready" || doc.status === "error") {
      store.updateDocumentStatus(docId, doc.status);
      if (doc.chunkCount) {
        // 更新完整文档列表
        store.setDocuments(data.documents || []);
      }
      return true;
    }
    return false;
  };

  // 每 1 秒检查一次，最多 60 秒
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const done = await check();
    if (done) break;
  }
}
