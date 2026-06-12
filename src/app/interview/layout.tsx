import { Navbar } from "@/components/shared/navbar";
import { InterviewSidebar } from "@/components/interview/layout/interview-sidebar";

export const metadata = {
  title: "AI 智能面试训练平台",
  description: "上传简历 → AI分析 → 模拟面试 → 复盘提升",
};

/**
 * 面试平台布局（与其他模块一致：顶部Navbar + 左侧菜单 + 内容区）
 */
export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <InterviewSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
