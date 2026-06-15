/**
 * 登录 / 注册页。
 *
 * 注册即机构引导（bootstrap）：创建机构 + 首个用户（后端 /api/auth/register）。
 * 后续成员加入同一机构走邀请流程（README 待办，尚未实装）。
 * 成功后拿 JWT 存入 AuthProvider 并回跳来源页（默认首页）。
 */
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, login, register } from "../lib/api";
import { useAuth } from "../lib/auth";

type Mode = "login" | "register";

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [institutionName, setInstitutionName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  const isRegister = mode === "register";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    // 客户端预校验，呼应后端 schema 约束（密码 8–72 字节）
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (isRegister && !institutionName.trim()) {
      setError("请填写机构名称");
      return;
    }

    setBusy(true);
    try {
      const res = isRegister
        ? await register({
            institution_name: institutionName.trim(),
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await login({ email: email.trim(), password });
      signIn(res.access_token);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("无法连接后端（请确认 uvicorn app.main:app 已启动）");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-slate-900">AtomCAP</div>
          <p className="mt-1 text-sm text-slate-500">一级市场投资多 Agent 系统</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-md py-1.5 transition ${
              !isRegister ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-md py-1.5 transition ${
              isRegister ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            注册机构
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <Field
                label="机构名称"
                value={institutionName}
                onChange={setInstitutionName}
                placeholder="例：某某创投"
                autoFocus
              />
              <Field
                label="你的姓名"
                value={name}
                onChange={setName}
                placeholder="例：张三"
              />
            </>
          )}
          <Field
            label="邮箱"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus={!isRegister}
          />
          <Field
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="至少 8 位"
          />

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "处理中…" : isRegister ? "创建机构并登录" : "登录"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          {isRegister
            ? "注册将创建一个新机构并成为首位成员"
            : "还没有机构？切换到「注册机构」"}
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

function Field({ label, value, onChange, type = "text", placeholder, autoFocus }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
    </label>
  );
}
