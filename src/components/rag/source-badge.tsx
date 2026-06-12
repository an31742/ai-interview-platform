"use client";

import type { SourceInfo } from "@/types/rag";
import { FileText, ExternalLink } from "lucide-react";

/**
 * 来源引用标签
 *
 * 在回答中显示引用的文档来源
 * 让用户知道 AI 的回答基于哪些文档
 */
export function SourceBadge({ sources }: { sources: SourceInfo[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-muted">
      <div className="flex items-center gap-1.5 mb-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          参考来源 ({sources.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, i) => (
          <div
            key={i}
            className="group relative inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted transition-colors"
            title={source.content}
          >
            <span className="text-[9px] opacity-70">#{source.chunkIndex}</span>
            <span className="max-w-[120px] truncate">{source.filename}</span>
            <span className="text-[9px] opacity-50">
              {(source.score * 100).toFixed(0)}%
            </span>

            {/* Hover 时显示预览 */}
            <div className="absolute bottom-full left-0 mb-1 hidden w-64 rounded-lg border bg-popover p-2 shadow-lg group-hover:block z-10">
              <p className="text-[10px] leading-relaxed text-popover-foreground line-clamp-4">
                {source.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
