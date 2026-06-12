"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, MessageSquare } from "lucide-react";

/**
 * 侧边栏 - 会话列表
 *
 * 职责:
 * 1. 展示所有历史会话
 * 2. 新建对话
 * 3. 切换当前会话
 * 4. 删除会话
 * 5. 移动端通过 Sheet 打开
 */
export function Sidebar() {
  const router = useRouter();
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const addConversation = useChatStore((s) => s.addConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  // 按最后更新时间倒序排列（最新的在最上面）
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const handleNewChat = useCallback(() => {
    const id = addConversation();
    router.push(`/chat/c/${id}`);
  }, [addConversation, router]);

  const handleSelect = useCallback(
    (id: string) => {
      selectConversation(id);
      router.push(`/chat/c/${id}`);
    },
    [selectConversation, router]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteConversation(id);
      // 如果删除后没有当前会话，跳转到 /chat
      const state = useChatStore.getState();
      if (!state.currentConversationId) {
        router.push("/chat");
      } else {
        router.push(`/chat/c/${state.currentConversationId}`);
      }
    },
    [deleteConversation, router]
  );

  return (
    <div className="flex h-full w-[260px] flex-col border-r bg-sidebar">
      {/* 顶部：新建对话按钮 */}
      <div className="flex items-center gap-2 p-3">
        <Button
          onClick={handleNewChat}
          className="flex-1 gap-2"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          新对话
        </Button>
      </div>

      <Separator />

      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {sortedConversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              暂无历史会话
            </div>
          ) : (
            sortedConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(conv.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  conv.id === currentConversationId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                <span className="flex-1 truncate">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  aria-label="删除会话"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* 底部信息 */}
      <Separator />
      <div className="p-3 text-[10px] text-muted-foreground/50 text-center">
        AI Chat · {conversations.length} 个会话
      </div>
    </div>
  );
}
