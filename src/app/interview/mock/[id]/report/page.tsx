"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, BarChart3, Loader2 } from "lucide-react";

// ============================================
// 面试报告页面
// ============================================

const DIMENSION_LABELS: Record<string, string> = {
  fundamentals: "基础能力",
  projectDepth: "项目深度",
  systemDesign: "系统设计",
  expression: "表达沟通",
  aiCapability: "AI 能力",
};

export default function InterviewReportPage() {
  const params = useParams<{ id: string }>();
  const session = useInterviewStore((s) =>
    s.sessions.find((s) => s.id === params.id)
  );
  const resume = useInterviewStore((s) => {
    const id = s.currentResumeId;
    return id ? s.resumes.find((r) => r.id === id) : s.resumes[0];
  });
  const [generating, setGenerating] = useState(false);

  const hasRealScore = session?.score && session.score.overall > 0;

  const handleGenerate = async () => {
    if (!session) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/interview/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: session.messages,
          resumeContext: resume?.parsed
            ? `${resume.parsed.name}，${resume.parsed.yearsOfExperience}年经验`
            : undefined,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.score) {
          useInterviewStore.getState().completeSession(session.id, result.score);
          window.location.reload();
        }
      }
    } catch {
      alert("生成报告失败，请重试");
    }
    setGenerating(false);
  };

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">面试会话不存在</p>
        <Button asChild className="mt-4">
          <Link href="/interview/mock">返回面试列表</Link>
        </Button>
      </div>
    );
  }

  if (!hasRealScore) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">面试报告</h1>
        <p className="text-muted-foreground mb-6">报告尚未生成，点击下方按钮生成报告</p>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />生成中...</>
          ) : "生成面试报告"}
        </Button>
        <div className="mt-4">
          <Button variant="ghost" asChild>
            <Link href={`/interview/mock/${session.id}`}>返回面试</Link>
          </Button>
        </div>
      </div>
    );
  }

  const score = session.score as NonNullable<typeof session.score>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/interview/mock/${session.id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回面试
          </Link>
        </Button>
      </div>

      {/* 总分 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">面试报告</h1>
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
          <span className="text-3xl font-bold text-primary">
            {score.overall}
          </span>
        </div>
        <p className="text-muted-foreground mt-2">总分</p>
      </div>

      {/* 各维度分数 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">维度评分</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(score.dimensions).map(([key, val]) => (
            <div key={key} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {DIMENSION_LABELS[key] ?? key}
                </span>
                <span className="text-lg font-bold">{val}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 优缺点 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold text-sm text-green-600 mb-2">
            ✅ 优点
          </h3>
          {score.strengths.length > 0 ? (
            <ul className="space-y-1">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc list-inside">{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold text-sm text-orange-600 mb-2">
            ⚠️ 待改进
          </h3>
          {score.weaknesses.length > 0 ? (
            <ul className="space-y-1">
              {score.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc list-inside">{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          )}
        </div>
      </div>

      {/* 改进建议 */}
      {score.suggestions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">📈 改进建议</h2>
          <div className="rounded-lg border p-4">
            <ul className="space-y-2">
              {score.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground">{i + 1}. {s}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 表达分析 */}
      {score.expressionIssues && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">🎤 表达分析</h2>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground mb-1">
              紧张度:{" "}
              {score.expressionIssues.tensionLevel === "calm"
                ? "😊 放松"
                : score.expressionIssues.tensionLevel === "moderate"
                  ? "😐 一般"
                  : "😰 紧张"}
            </p>
            {score.expressionIssues.fillerWords.length > 0 && (
              <p className="text-sm text-muted-foreground mb-1">
                口头禅: {score.expressionIssues.fillerWords.join("、")}
              </p>
            )}
            {score.expressionIssues.advice && (
              <p className="text-sm text-muted-foreground">
                建议: {score.expressionIssues.advice}
              </p>
            )}
          </div>
        </section>
      )}

      {/* 导出 */}
      <div className="text-center">
        <Button variant="outline" onClick={() => {
          const data = JSON.stringify(score, null, 2);
          const blob = new Blob([data], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `面试报告-${session.id.slice(0, 8)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download className="h-4 w-4 mr-2" />
          导出报告
        </Button>
      </div>
    </div>
  );
}
