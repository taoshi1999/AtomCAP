/**
 * 前端认证状态：token 持久化 + 注入 api 客户端 + 路由守卫。
 *
 * 后端 settings.auth_dev_fallback 默认 False —— 不携带 JWT 的请求一律 401，
 * 故前端必须先登录拿 token 再访问任何业务 API。token 存 localStorage 跨刷新保留，
 * 启动时 bootstrapAuth() 先回灌进 api 客户端，保证首屏请求即带 Authorization。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { setAuthToken } from "./api";

const STORAGE_KEY = "atomcap.token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage 不可用（隐私模式等）：降级为仅内存态，刷新即丢失
    return null;
  }
}

/**
 * 模块加载后、React 渲染前调用（见 main.tsx），把已持久化的 token 回灌进 api 客户端，
 * 使首屏的数据请求也带上 Authorization 头。
 */
export function bootstrapAuth(): void {
  setAuthToken(readStoredToken());
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());

  // token 变化时同步进 api 客户端（signIn/signOut 已直接调 setAuthToken，
  // 这里兜底覆盖 StrictMode 双挂载等场景，保持单一事实源）
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const signIn = useCallback((next: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 仅内存态 */
    }
    setAuthToken(next);
    setToken(next);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 仅内存态 */
    }
    setAuthToken(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: token !== null, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}

/** 路由守卫：未登录跳转 /login，并记住来源路径以便登录后回跳。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
