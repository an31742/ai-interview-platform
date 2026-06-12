"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  FlaskConical,
  BookOpen,
  Cpu,
  Briefcase,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

/**
 * 全局导航栏
 */
const NAV_ITEMS = [
  { href: "/chat", label: "聊天", icon: MessageSquare },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/rag", label: "RAG 知识库", icon: BookOpen },
  { href: "/agent", label: "Agent", icon: Cpu },
  { href: "/interview", label: "面试", icon: Briefcase },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const isVisible = NAV_ITEMS.some((item) => pathname.startsWith(item.href));

  if (!isVisible) {
    return null;
  }

  return (
    <header className="flex h-11 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 shrink-0">
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {!loading && user ? (
          <>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" />
              {user.name}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-3 w-3" />
              退出
            </button>
          </>
        ) : !loading ? (
          <Link
            href="/auth/login"
            className="text-[11px] text-primary hover:underline"
          >
            登录
          </Link>
        ) : null}
        <span className="text-[10px] text-muted-foreground/40 ml-1">
          AI Chat · DeepSeek
        </span>
      </div>
    </header>
  );
}
