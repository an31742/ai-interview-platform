"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  User,
  ExternalLink,
  Clock,
  BarChart3,
} from "lucide-react";

// ============================================
// 模拟面试 - 新建 & 历史列表
// ============================================

export default function MockInterviewPage() {
  const router = useRouter();
  const { sessions, resumes, createSession } = useInterviewStore();
  const [creating, setCreating] = useState(false);

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const id = createSession({
        resumeId: resumes[0]?.id,
        mode: "tech",
        difficulty: "mid",
        duration: 45,
      });
      router.push(`/interview/mock/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const completedSessions = sessions.filter(
    (s) => s.status === "completed"
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">模拟面试</h1>
        <p className="text-muted-foreground mt-1">
          基于你的简历和 JD，进行 AI 驱动的模拟面试
        </p>
      </div>

      {/* 新建面试 */}
      <div className="mb-8 rounded-lg border bg-gradient-to-r from-green-50 to-emerald-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">开始新的模拟面试</h2>
            <p className="text-sm text-muted-foreground">
              AI 面试官会根据你的简历和 JD 动态出题，模拟真实面试场景
            </p>
          </div>
          <Button onClick={handleCreateSession} disabled={creating}>
            <MessageSquare className="h-4 w-4 mr-2" />
            开始面试
          </Button>
        </div>
      </div>

      {/* 历史记录 */}
      <h2 className="text-lg font-semibold mb-3">
        历史面试 ({completedSessions.length})
      </h2>
      <div className="space-y-3">
        {completedSessions.map((session) => (
          <div
            key={session.id}
            className="rounded-lg border p-4 flex items-center justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {session.mode === "tech"
                    ? "技术面试"
                    : session.mode === "hr"
                      ? "HR 面试"
                      : "综合面试"}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {session.duration}min
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {session.score?.overall ?? "?"} 分
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/interview/mock/${session.id}`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                查看
              </Link>
            </Button>
          </div>
        ))}
        {completedSessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            还没有完成过模拟面试
          </p>
        )}
      </div>
    </div>
  );
}
