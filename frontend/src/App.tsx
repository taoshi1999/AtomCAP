import { Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      {/* 项目工作台：凡是绑定具体项目的深度动作（Pre-DD）都在这里进行 */}
      <Route path="/workspace/:dealId?" element={<WorkspacePage />} />
    </Routes>
  );
}
