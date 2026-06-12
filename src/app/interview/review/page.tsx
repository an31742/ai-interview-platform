"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Upload, Loader2, Trash2, FileText, CheckCircle2, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

// ============================================
// 复盘导入页面
// ============================================

export default function ReviewPage() {
  const router = useRouter();
  const { reviews, addReview, deleteReview, addErrorEntry } = useInterviewStore();
  const [content, setContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [lastResult, setLastResult] = useState<{
    reviewId: string;
    errorCount: number;
  } | null>(null);

  const handleImport = async () => {
    if (!content.trim()) return;

    setImporting(true);
    setStatusText("AI 正在分析复盘内容...");
    setLastResult(null);

    try {
      const response = await fetch("/api/interview/analyze-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(err.error || `分析失败 (${response.status})`);
      }

      const result = await response.json();

      // 1. 存储复盘记录
      const reviewId = addReview(result.review);

      // 2. 自动生成错题条目
      let errorCount = 0;
      if (result.errorEntries && Array.isArray(result.errorEntries)) {
        for (const entry of result.errorEntries) {
          if (entry.questionContent) {
            addErrorEntry(entry);
            errorCount++;
          }
        }
      }

      setContent("");
      setLastResult({ reviewId, errorCount });
      setStatusText(`✅ 分析完成！识别 ${result.review.questions?.length || 0} 道题，提取 ${errorCount} 条错题`);

      // 3. 刷新仪表盘
      useInterviewStore.getState().refreshStats();
    } catch (err) {
      setStatusText(`❌ ${err instanceof Error ? err.message : "分析失败"}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">面试复盘导入</h1>
        <p className="text-muted-foreground mt-1">
          导入面试录音转写或复盘文档，AI 自动提取错题到错题本
        </p>
      </div>

      {/* 导入区域 */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">
          粘贴面试记录或复盘内容
        </label>
        <Textarea
          placeholder={`将面试复盘内容粘贴到这里...\n\n支持任意格式，例如：\n\n公司：字节跳动\n岗位：前端开发\n\n面试官问：SSE和WebSocket的区别？\n我答：SSE是单向的，WebSocket是全双工\n面试官说：深度不够\n\n面试官问：项目最大挑战？\n我答：没有挑战...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="mb-2 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button onClick={handleImport} disabled={!content.trim() || importing}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {statusText}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                导入并分析
              </>
            )}
          </Button>
          {lastResult && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {lastResult.errorCount} 条错题已加入错题本
            </span>
          )}
        </div>
        {!importing && statusText && (
          <p className="text-xs text-muted-foreground mt-1">{statusText}</p>
        )}
      </div>

      {/* 快速导入样本 */}
      <details className="mb-6">
        <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
          粘贴示例数据试试看（点击展开）
        </summary>
        <div className="mt-2 rounded-lg border bg-muted/30 p-3">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{`公司：字节跳动
岗位：前端开发工程师（AI业务线）

面试官问：SSE和WebSocket在使用场景上有什么区别？
我答：SSE是服务器向客户端单向推送，WebSocket是双向通信。SSE基于HTTP，WebSocket基于TCP。
面试官：你项目里用的SSE，高并发下有什么优化方案？
我答：设置缓存变量，接收到数据不立刻显示，接收完全再展示。
面试官：那不是高并发优化，是渲染节流。

面试官问：你在项目中遇到的最大挑战是什么？
我答：说实话没有遇到特别大的挑战。
面试官：那你觉得你项目中最有技术含量的部分是什么？`}</pre>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setContent(`公司：字节跳动
岗位：前端开发工程师（AI业务线）

面试官问：SSE和WebSocket在使用场景上有什么区别？
我答：SSE是服务器向客户端单向推送，WebSocket是双向通信。SSE基于HTTP，WebSocket基于TCP。
面试官：你项目里用的SSE，高并发下有什么优化方案？
我答：设置缓存变量，接收到数据不立刻显示，接收完全再展示。
面试官：那不是高并发优化，是渲染节流。

面试官问：你在项目中遇到的最大挑战是什么？
我答：说实话没有遇到特别大的挑战。
面试官：那你觉得你项目中最有技术含量的部分是什么？`);
            }}
          >
            填入示例
          </Button>
        </div>
      </details>

      {/* 复盘列表 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          历史复盘 ({reviews.length})
        </h2>
        {reviews.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => router.push("/interview/questions")}>
            <BookOpen className="h-4 w-4 mr-1" />
            查看错题本
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[500px]">
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{review.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {review.position} · {review.date}
                      {" · "}
                      结果:{" "}
                      {review.result === "pass"
                        ? "✅ 通过"
                        : review.result === "fail"
                          ? "❌ 未通过"
                          : "⏳ 待定"}
                    </p>
                    {review.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {review.summary}
                      </p>
                    )}
                    {review.weaknessTags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {review.weaknessTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {review.questions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {review.questions.length} 道题 · 平均分 {Math.round(review.questions.reduce((s, q) => s + q.score, 0) / review.questions.length * 10) / 10}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteReview(review.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {reviews.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                还没有导入过复盘记录
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                粘贴上面的示例数据试试效果
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
