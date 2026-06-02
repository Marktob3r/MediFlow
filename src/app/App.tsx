import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import { ToastProvider } from "../contexts/ToastContext";
import ToastContainer from "../components/ToastContainer";
import "../styles/fonts.css";
import { useNetworkStatus } from "../components/useNetworkStatus";
import OfflineBanner from "../components/OfflineBanner";

function AppContent() {
  const { isOnline, wasOffline } = useNetworkStatus();
  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} />
      <ToastContainer />
      <RouterProvider router={router} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
