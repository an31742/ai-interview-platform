// ============================================
// 认证系统类型定义
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

export interface UserWithPassword extends User {
  passwordHash: string;
  salt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}
