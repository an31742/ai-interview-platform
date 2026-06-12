import { Navbar } from "@/components/shared/navbar";

/**
 * Playground 布局 — 三栏结构 + 顶部导航
 */
export default function PlaygroundLayout({
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
