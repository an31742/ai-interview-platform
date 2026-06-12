"use client";

import { useRagStore } from "@/store/rag-store";
import { FileText, Trash2, CheckCircle, Loader2, AlertCircle } from "lucide-react";

/**
 * 已索引文档列表
 *
 * 显示每个文档的处理状态，支持删除
 */
export function DocumentList() {
  const documents = useRagStore((s) => s.documents);
  const setDocuments = useRagStore((s) => s.setDocuments);

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center text-xs text-muted-foreground">
        暂无已索引的文档，请上传 PDF
      </div>
    );
  }

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/rag/upload?id=${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== docId));
      }
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        已索引文档 ({documents.length})
      </h3>
      <div className="space-y-1.5">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
          >
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">
                  {doc.filename}
                </span>
                <StatusIcon status={doc.status} />
              </div>
              <div className="text-[10px] text-muted-foreground">
                {doc.status === "ready"
                  ? `${doc.chunkCount} 个切片 · ${formatSize(doc.fileSize)}`
                  : doc.status === "processing"
                  ? "正在处理..."
                  : doc.error || "处理失败"}
              </div>
            </div>

            <button
              onClick={() => handleDelete(doc.id)}
              className="flex-shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <CheckCircle className="h-3 w-3 text-emerald-500" />;
    case "processing":
      return <Loader2 className="h-3 w-3 animate-spin text-amber-500" />;
    case "error":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
