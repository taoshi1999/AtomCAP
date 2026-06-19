import { Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import WorkspacePage from "./pages/WorkspacePage";
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
