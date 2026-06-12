"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Sparkles,
  BookmarkPlus,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Question } from "@/types/interview";

// ============================================
// 面试准备页面 — 一键生成面试题
// ============================================

export default function InterviewPrepPage() {
  const { resumes, jds, addErrorEntry } = useInterviewStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [statusText, setStatusText] = useState("");

  const resume = resumes[0];
  const jd = jds[0];
  const hasResume = !!resume;
  const hasJD = !!jd;

  const handleGenerate = async () => {
    if (!resume) return;
    setGenerating(true);
    setStatusText("AI 正在根据你的简历生成面试题...");
    setQuestions([]);

    try {
      const response = await fetch("/api/interview/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: resume,
          jdAnalysis: jd?.analysis,
          count: 5,
        }),
      });

      if (!response.ok) throw new Error(`请求失败`);

      const result = await response.json();
      setQuestions(result.questions || []);
      setStatusText(
        `✅ 已生成 ${result.questions?.length || 0} 道面试题`
      );
    } catch (err) {
      setStatusText(
        `❌ ${err instanceof Error ? err.message : "生成失败，请重试"}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToErrorBook = (q: Question) => {
    if (savedIds.has(q.id)) return;

    addErrorEntry({
      questionContent: q.content,
      correctAnswer: q.expectedAnswer,
      yourAnswer: "",
      mistakeType: "depth",
      company: jd?.company || "AI 出题",
      tags: q.tags,
      mastery: 0,
      reviewCount: 0,
    });

    setSavedIds((prev) => new Set(prev).add(q.id));
  };

  const difficultyLabel = (d: string) => {
    const map: Record<string, string> = {
      junior: "初级",
      mid: "中级",
      senior: "高级",
    };
    return map[d] || d;
  };

  const categoryLabel = (c: string) => {
    const map: Record<string, string> = {
      vue: "Vue",
      react: "React",
      javascript: "JavaScript",
      css: "CSS",
      browser: "浏览器",
      engineering: "工程化",
      ai: "AI",
      "system-design": "系统设计",
      project: "项目",
      hr: "HR",
    };
    return map[c] || c;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          面试准备
        </h1>
        <p className="text-muted-foreground mt-1">
          基于你的简历和 JD，AI 一键生成针对性面试题
        </p>
      </div>

      {/* 状态概览 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">简历</p>
          <p className="text-sm font-medium mt-0.5">
            {hasResume
              ? `${resume.parsed?.name || "已上传"} · ${resume.parsed?.skills?.length || 0} 项技能`
              : "未上传 ⚠️"}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">JD 分析</p>
          <p className="text-sm font-medium mt-0.5">
            {hasJD
              ? `${jd.position || jd.company || "已分析"} · 匹配度 ${jd.analysis?.matchScore ?? "?"}%`
              : "未分析"}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">已保存错题</p>
          <p className="text-sm font-medium mt-0.5">{savedIds.size} 道</p>
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="mb-6">
        <Button
          onClick={handleGenerate}
          disabled={generating || !hasResume}
          size="lg"
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {statusText}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {hasResume ? "一键生成面试题" : "请先上传简历"}
            </>
          )}
        </Button>
        {statusText && !generating && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {statusText}
          </p>
        )}
      </div>

      {/* 面试题列表 */}
      {questions.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              生成的面试题 ({questions.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              换一批
            </Button>
          </div>

          <ScrollArea className="max-h-[700px]">
            <div className="space-y-3">
              {questions.map((q, i) => {
                const isExpanded = expandedId === q.id;

                return (
                  <div
                    key={q.id}
                    className="rounded-lg border overflow-hidden"
                  >
                    {/* 题目头 */}
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : q.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              #{i + 1}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                q.difficulty === "senior"
                                  ? "bg-red-50 text-red-600"
                                  : q.difficulty === "mid"
                                    ? "bg-yellow-50 text-yellow-600"
                                    : "bg-green-50 text-green-600"
                              }`}
                            >
                              {difficultyLabel(q.difficulty)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                              {categoryLabel(q.category)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{q.content}</p>
                        </div>
                        <div className="ml-3">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* 标签 */}
                      {q.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {q.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 展开区 */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                        {/* 标准答案 */}
                        <div>
                          <p className="text-xs font-medium text-green-600 mb-1">
                            ✅ 标准答案要点
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {q.expectedAnswer || "暂无"}
                          </p>
                        </div>

                        {/* 答题技巧 */}
                        {q.tips.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-blue-600 mb-1">
                              💡 答题技巧
                            </p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {q.tips.map((t, j) => (
                                <li
                                  key={j}
                                  className="text-sm text-muted-foreground"
                                >
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveToErrorBook(q)}
                            disabled={savedIds.has(q.id)}
                          >
                            {savedIds.has(q.id) ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                已收藏
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="h-3 w-3 mr-1" />
                                加入错题本
                              </>
                            )}
                          </Button>
                          {savedIds.has(q.id) && (
                            <span className="text-xs text-green-600">
                              已添加到错题本
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      {/* 空状态 */}
      {!generating && questions.length === 0 && (
        <div className="text-center py-16">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            {hasResume
              ? "点击上方按钮，AI 会根据你的简历和 JD 生成针对性面试题"
              : "请先上传简历，才能生成个性化面试题"}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>📄 简历 + 技术栈</span>
            <span>→</span>
            <span>🎯 三优先策略出题</span>
            <span>→</span>
            <span>📝 逐题练习 + 收藏</span>
          </div>
        </div>
      )}
    </div>
  );
}
