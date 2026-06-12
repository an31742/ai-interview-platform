import { Navbar } from "@/components/shared/navbar";

/**
 * Agent 页面布局
 */
export default function AgentLayout({
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
