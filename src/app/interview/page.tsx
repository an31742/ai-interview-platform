"use client";

import { useEffect } from "react";
import { useInterviewStore } from "@/store/interview-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Target,
  Brain,
  Clock,
  BarChart3,
  ChevronRight,
} from "lucide-react";

// ============================================
// 面试平台仪表盘
// ============================================

export default function InterviewDashboardPage() {
  const router = useRouter();
  const stats = useInterviewStore((s) => s.stats);
  const resumes = useInterviewStore((s) => s.resumes);
  const sessions = useInterviewStore((s) => s.sessions);
  const errorBook = useInterviewStore((s) => s.errorBook);
  const refreshStats = useInterviewStore((s) => s.refreshStats);

  // 加载时刷新统计
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const quickActions = [
    {
      title: "上传简历",
      description: resumes.length > 0 ? `${resumes[0].parsed?.name || "已上传"} · ${resumes.length} 份简历` : "上传简历让 AI 分析你的技术栈",
      href: "/interview/resume",
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-50",
      badge: resumes.length > 0 ? resumes.length : undefined,
    },
    {
      title: "开始模拟面试",
      description: resumes.length === 0 ? "先上传简历再开始面试" : `已完成 ${stats.totalInterviews} 次 · 平均 ${stats.avgScore} 分`,
      href: "/interview/mock",
      icon: MessageSquare,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      title: "导入面试复盘",
      description: "粘贴面试记录，AI 自动提取错题",
      href: "/interview/review",
      icon: AlertTriangle,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      title: "错题本",
      description: stats.errorBookCount > 0 ? `${stats.errorBookCount} 道错题 · 掌握率 ${stats.masteredRate}%` : "还没有错题记录",
      href: "/interview/questions",
      icon: BookOpen,
      color: "text-purple-500",
      bg: "bg-purple-50",
      badge: stats.errorBookCount > 0 ? stats.errorBookCount : undefined,
    },
  ];

  const completed = sessions.filter((s) => s.status === "completed");
  const recentSessions = [...sessions].reverse().slice(0, 5);

  const resume = resumes[0];

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">AI 面试训练平台</h1>
        <p className="text-muted-foreground mt-1">
          {resume
            ? `${resume.parsed?.name || "已上传简历"} · ${completed.length} 次面试完成`
            : "上传简历开始你的面试准备"}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">模拟面试</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{stats.totalInterviews}</div>
          <p className="text-xs text-muted-foreground mt-1">完成次数</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">平均分</span>
            <Target className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">
            {stats.avgScore}
            <span className="text-sm font-normal text-muted-foreground ml-1">分</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            最弱项: {stats.weakCategories.length > 0 ? dimLabel(stats.weakCategories[0]) : "暂无"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">错题数</span>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold">{stats.errorBookCount}</div>
          <p className="text-xs text-muted-foreground mt-1">待复习: {errorBook.filter((e) => e.mastery < 3).length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">掌握率</span>
            <Brain className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold">
            {stats.masteredRate}
            <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {errorBook.filter((e) => e.mastery >= 4).length} 题已掌握
          </p>
        </div>
      </div>

      {/* 快捷操作 */}
      <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {quickActions.map((action) => (
          <Link key={action.title} href={action.href}>
            <div className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-2 ${action.bg}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{action.title}</h3>
                    {(action as any).badge && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {(action as any).badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 最近面试 + 简历概览 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 最近面试 */}
        <div className="col-span-2 rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">最近面试</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/interview/mock")}>
              查看全部 <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              还没有面试记录
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/interview/mock/${s.id}`)}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 p-1.5">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {s.mode === "tech" ? "技术面试" : s.mode === "hr" ? "HR 面试" : "综合面试"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.duration}min
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {s.status === "completed" ? `${s.score?.overall ?? "?"} 分` : "进行中"}
                        </span>
                        <span>{new Date(s.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 简历概览 */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">简历</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/interview/resume")}>
              {resume ? "查看" : "上传"} <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {resume ? (
            <div>
              <p className="text-sm font-medium">{resume.parsed?.name || "待解析"}</p>
              <p className="text-xs text-muted-foreground">{resume.parsed?.title || ""}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(resume.parsed?.skills || []).slice(0, 6).map((s) => (
                  <span key={s} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">
                  AI 置信度: {resume.analysis?.confidence ?? "?"}/100
                </p>
                {resume.analysis && resume.analysis.weaknesses.length > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ 待改进: {resume.analysis.weaknesses.slice(0, 2).join("、")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              还没有上传简历
            </div>
          )}
        </div>
      </div>

      {/* 学习路径提示 */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <h3 className="font-semibold text-lg mb-2">🎯 推荐学习路径</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>上传简历 → 让 AI 分析你的技术栈短板</li>
          <li>导入面试复盘 → 提取错题到错题本</li>
          <li>开始模拟面试 → 针对薄弱环节练习</li>
          <li>查看面试报告 → 追踪进步曲线</li>
        </ol>
        <div className="mt-4">
          <Button asChild>
            <Link href="/interview/resume">{resume ? "继续准备" : "开始上传简历"}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function dimLabel(key: string): string {
  const map: Record<string, string> = {
    fundamentals: "基础",
    projectDepth: "项目深度",
    systemDesign: "系统设计",
    expression: "表达",
    aiCapability: "AI",
  };
  return map[key] || key;
}
