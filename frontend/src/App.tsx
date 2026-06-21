import { Navigate, Route, Routes, useParams } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import { RequireAuth } from "./lib/auth";

function WorkspaceRedirect() {
  const { dealId } = useParams();
  const target = dealId ? `/?view=deals&dealId=${dealId}` : "/?view=deals";
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      {/* 兼容旧链接：投资偏好已并入首页内部模式，/preferences 重定向到首页并切到该模式 */}
      <Route path="/preferences" element={<Navigate to="/?view=preference" replace />} />
      <Route path="/preferences/:profileId" element={<Navigate to="/?view=preference" replace />} />
      {/* 项目工作台：凡是绑定具体项目的深度动作（Pre-DD）都在这里进行 */}
      <Route
        path="/workspace/:dealId?"
        element={
          <RequireAuth>
            <WorkspaceRedirect />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
