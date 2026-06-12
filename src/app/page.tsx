import { redirect } from "next/navigation";

/**
 * 根路径：重定向到 /chat 页面
 */
export default function Home() {
  redirect("/chat");
}
