import { Navbar } from "@/components/shared/navbar";

/**
 * RAG 知识库布局
 */
export default function RagLayout({
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
