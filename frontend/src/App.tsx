import { Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import WorkspacePage from "./pages/WorkspacePage";
import PreferencePage from "./pages/PreferencePage";
import LoginPage from "./pages/LoginPage";
import { RequireAuth } from "./lib/auth";

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
      {/* 投资偏好：用户自建命名偏好卡片的 列表 / 创建 / 详情编辑 */}
      <Route
        path="/preferences"
        element={
          <RequireAuth>
            <PreferencePage />
          </RequireAuth>
        }
      />
      <Route
        path="/preferences/:profileId"
        element={
          <RequireAuth>
            <PreferencePage />
          </RequireAuth>
        }
      />
      {/* 项目工作台：凡是绑定具体项目的深度动作（Pre-DD）都在这里进行 */}
      <Route
        path="/workspace/:dealId?"
        element={
          <RequireAuth>
            <WorkspacePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
