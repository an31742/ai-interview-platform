"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Loader2, Eye, EyeOff } from "lucide-react";

// ============================================
// 注册页面
// ============================================

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const err = await register(email.trim(), password, name.trim());
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      router.push("/interview");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
          <p className="text-sm text-muted-foreground mt-1">注册开始使用面试训练平台</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">姓名</label>
            <Input
              placeholder="你的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">邮箱</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">密码</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />注册中...</>
            ) : (
              "注册"
            )}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          已有账号？{" "}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
