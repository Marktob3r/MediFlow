import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../contexts/ToastContext";

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  // Guard against undefined toasts
  if (!toasts || toasts.length === 0) {
    return null;
  }

  const getToastStyles = (type: string) => {
    switch (type) {
      case "success":
        return {
          icon: "✓",
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
          border: "border-green-300/50",
          titleColor: "text-green-800",
          messageColor: "text-green-600/80",
          closeColor: "text-green-400 hover:text-green-600",
          closeBg: "hover:bg-green-100/50",
        };
      case "warning":
        return {
          icon: "⚠",
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
          border: "border-amber-300/50",
          titleColor: "text-amber-800",
          messageColor: "text-amber-600/80",
          closeColor: "text-amber-400 hover:text-amber-600",
          closeBg: "hover:bg-amber-100/50",
        };
      case "error":
        return {
          icon: "✕",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          border: "border-red-300/50",
          titleColor: "text-red-800",
          messageColor: "text-red-600/80",
          closeColor: "text-red-400 hover:text-red-600",
          closeBg: "hover:bg-red-100/50",
        };
      case "info":
      default:
        return {
          icon: "ℹ",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          border: "border-blue-300/50",
          titleColor: "text-blue-800",
          messageColor: "text-blue-600/80",
          closeColor: "text-blue-400 hover:text-blue-600",
          closeBg: "hover:bg-blue-100/50",
        };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-[380px] max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {toasts.map((toast: any) => {
          if (!toast) return null;
          
          const styles = getToastStyles(toast.type || "info");
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-white/95 backdrop-blur-md border rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 w-full"
            >
              <div className={`w-9 h-9 ${styles.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 text-xl font-bold ${styles.iconColor}`}>
                {styles.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${styles.titleColor}`}>{toast.title || "Notification"}</p>
                <p className={`text-xs ${styles.messageColor} truncate`}>{toast.message || ""}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={`w-7 h-7 rounded-xl ${styles.closeBg} ${styles.closeColor} transition-colors flex items-center justify-center flex-shrink-0 text-lg`}
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
