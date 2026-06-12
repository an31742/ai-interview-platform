"use client";

import { useInterviewStore } from "@/store/interview-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download, Target, Lightbulb, BookOpen } from "lucide-react";

// ============================================
// JD 匹配分析报告
// ============================================

export default function JDAnalysisPage() {
  const router = useRouter();
  const jds = useInterviewStore((s) => s.jds);
  const latestJD = jds[0];

  if (!latestJD) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <p className="text-muted-foreground">还没有分析过 JD</p>
        <Button asChild className="mt-4">
          <a href="/interview/jd">去分析</a>
        </Button>
      </div>
    );
  }

  const { analysis } = latestJD;

  const handleExport = () => {
    const data = JSON.stringify(latestJD, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jd-analysis-${latestJD.company || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl mx-auto">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/interview/jd")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回 JD 列表
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            导出分析
          </Button>
        </div>

        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">JD 匹配分析</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {latestJD.company || "未知公司"} · {latestJD.position || "未知岗位"}
          </p>
        </div>

        {/* 匹配度 */}
        {analysis && (
          <>
            <div className="mb-6 rounded-lg border p-5">
              <div className="flex items-center gap-3 mb-3">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">岗位匹配度</h2>
                <span className="ml-auto text-2xl font-bold text-primary">
                  {analysis.matchScore}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${analysis.matchScore}%` }}
                />
              </div>
              {analysis.matchAnalysis && (
                <p className="text-sm text-muted-foreground mt-3">
                  {analysis.matchAnalysis}
                </p>
              )}
            </div>

            {/* 技能要求 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-2">必备技能</h3>
                <div className="flex flex-wrap gap-1">
                  {analysis.requiredSkills.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                    >
                      {s}
                    </span>
                  ))}
                  {analysis.requiredSkills.length === 0 && (
                    <span className="text-xs text-muted-foreground">未识别</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-2">加分技能</h3>
                <div className="flex flex-wrap gap-1">
                  {analysis.preferredSkills.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600"
                    >
                      {s}
                    </span>
                  ))}
                  {analysis.preferredSkills.length === 0 && (
                    <span className="text-xs text-muted-foreground">未识别</span>
                  )}
                </div>
              </div>
            </div>

            {/* 职责 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                岗位职责
              </h3>
              <div className="rounded-lg border p-4">
                <ul className="space-y-1">
                  {analysis.responsibilities.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground list-disc list-inside">
                      {r}
                    </li>
                  ))}
                  {analysis.responsibilities.length === 0 && (
                    <p className="text-sm text-muted-foreground">未识别</p>
                  )}
                </ul>
              </div>
            </div>

            {/* 面试重点 */}
            {analysis.interviewFocus.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Lightbulb className="h-4 w-4" />
                  面试准备重点
                </h3>
                <div className="rounded-lg border p-4">
                  <ol className="space-y-2">
                    {analysis.interviewFocus.map((f, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {i + 1}. {f}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* 下一步 */}
            <div className="rounded-lg border-l-4 border-l-primary bg-muted/30 p-4">
              <h3 className="font-semibold text-sm mb-1">🚀 下一步</h3>
              <p className="text-sm text-muted-foreground mb-3">
                基于这个 JD 分析，开始模拟面试练习
              </p>
              <Button
                size="sm"
                onClick={() => router.push("/interview/mock")}
              >
                开始模拟面试
              </Button>
            </div>
          </>
        )}

        {/* 没有分析结果 */}
        {!analysis && (
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <p className="text-muted-foreground">JD 尚未分析</p>
            <p className="text-xs text-muted-foreground mt-2">
              提交 JD 后会自动分析
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
