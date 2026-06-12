"use client";

import { useInterviewStore } from "@/store/interview-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Brain, RefreshCw } from "lucide-react";

// ============================================
// 面试题库 & 错题本
// ============================================

export default function QuestionsPage() {
  const { errorBook, updateErrorEntry, deleteErrorEntry } =
    useInterviewStore();

  const masteryLabels = ["未掌握", "看过一次", "看过两次", "基本记住", "很熟练", "脱口而出"];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">面试题库</h1>
        <p className="text-muted-foreground mt-1">
          错题背诵 · 掌握度追踪 · 针对性练习
        </p>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">错题总数</p>
          <p className="text-2xl font-bold mt-1">{errorBook.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">已掌握 (≥4分)</p>
          <p className="text-2xl font-bold mt-1">
            {errorBook.filter((e) => e.mastery >= 4).length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">待复习</p>
          <p className="text-2xl font-bold mt-1">
            {errorBook.filter((e) => e.mastery < 3).length}
          </p>
        </div>
      </div>

      {/* 错题列表 */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Brain className="h-5 w-5" />
        我的错题本
      </h2>
      <ScrollArea className="max-h-[600px]">
        <div className="space-y-3">
          {errorBook.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-sm">{entry.questionContent}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    来源: {entry.company}
                    {" · "}
                    类型: {mistakeLabel(entry.mistakeType)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-muted-foreground">
                    {masteryLabels[entry.mastery]}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateErrorEntry(entry.id, {
                        mastery: Math.min(5, entry.mastery + 1) as 0 | 1 | 2 | 3 | 4 | 5,
                      })
                    }
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* 掌握度进度条 */}
              <div className="h-1.5 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(entry.mastery / 5) * 100}%` }}
                />
              </div>

              {/* 正确答案（展开） */}
              <div className="mt-2 rounded bg-muted/50 p-3">
                <p className="text-xs font-medium mb-1">✅ 标准答案:</p>
                <p className="text-sm text-muted-foreground">
                  {entry.correctAnswer}
                </p>
              </div>
            </div>
          ))}
          {errorBook.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                还没有错题记录，导入面试复盘后会自动生成
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <a href="/interview/review">去导入复盘</a>
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function mistakeLabel(type: string): string {
  const map: Record<string, string> = {
    "concept-error": "概念错误",
    expression: "表达问题",
    depth: "深度不足",
    structure: "结构混乱",
  };
  return map[type] ?? type;
}
