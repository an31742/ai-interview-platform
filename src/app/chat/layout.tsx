import { Navbar } from "@/components/shared/navbar";

/**
 * Chat 路由组布局
 * 提供聊天界面的整体布局结构，包含顶部导航
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
