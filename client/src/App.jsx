import { Navigate, Route, Routes } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import DashboardPage from "./pages/DashboardPage";
import PlayerPage from "./pages/PlayerPage";

export default function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/player/:role" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SocketProvider>
  );
}
