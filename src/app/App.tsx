import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import "../styles/fonts.css";
import { useNetworkStatus } from "../components/useNetworkStatus";
import OfflineBanner from "../components/OfflineBanner";

function AppContent() {
  const { isOnline, wasOffline } = useNetworkStatus();
  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} />
      <RouterProvider router={router} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
