"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessageSquare,
  BookOpen,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ============================================
// 面试平台左侧导航菜单
// ============================================

const MENU_ITEMS = [
  { href: "/interview", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { href: "/interview/resume", label: "简历管理", icon: FileText },
  { href: "/interview/jd", label: "JD 分析", icon: Briefcase },
  { href: "/interview/mock", label: "模拟面试", icon: MessageSquare },
  { href: "/interview/prep", label: "面试准备", icon: GraduationCap },
  { href: "/interview/questions", label: "错题本", icon: BookOpen },
  { href: "/interview/review", label: "复盘导入", icon: AlertTriangle },
];

export function InterviewSidebar() {
  const pathname = usePathname();

  const isActive = (item: (typeof MENU_ITEMS)[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <div className="flex h-full w-[220px] flex-col border-r bg-sidebar shrink-0">
      {/* 标题 */}
      <div className="flex h-14 items-center px-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">面试训练平台</span>
        </div>
      </div>

      {/* 菜单 */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <p className="text-[10px] text-muted-foreground/50 text-center">
          AI 智能面试训练平台
        </p>
      </div>
    </div>
  );
}
