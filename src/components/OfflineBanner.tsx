import { motion, AnimatePresence } from "motion/react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

interface OfflineBannerProps {
  isOnline: boolean;
  wasOffline: boolean; // briefly true right after reconnection
}

/**
 * A sticky top banner that appears when the user loses internet
 * and shows a "Back online" confirmation when they reconnect.
 */
export default function OfflineBanner({ isOnline, wasOffline }: OfflineBannerProps) {
  return (
    <AnimatePresence>
      {/* ── Offline Banner ── */}
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2.5 bg-red-600 text-white text-sm font-semibold px-4 py-3 shadow-lg"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>You're offline. Queue data may be outdated.</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Reconnected Banner (flashes briefly) ── */}
      {isOnline && wasOffline && (
        <motion.div
          key="back-online"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2.5 bg-emerald-600 text-white text-sm font-semibold px-4 py-3 shadow-lg"
        >
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Back online — refreshing data…</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
