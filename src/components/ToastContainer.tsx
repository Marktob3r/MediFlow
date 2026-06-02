import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useToast, ToastType } from "../contexts/ToastContext";

const toastStyles: Record<ToastType, { bg: string; border: string; icon: any; iconColor: string }> = {
  success: {
    bg: "bg-white",
    border: "border-green-100",
    icon: CheckCircle,
    iconColor: "text-green-600",
  },
  error: {
    bg: "bg-white",
    border: "border-red-100",
    icon: XCircle,
    iconColor: "text-red-500",
  },
  info: {
    bg: "bg-white",
    border: "border-blue-100",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          const Icon = style.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-start gap-3 w-80 p-4 rounded-2xl shadow-xl border ${style.bg} ${style.border}`}
            >
              {/* Icon */}
              <div className={`mt-0.5 flex-shrink-0 ${style.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-gray-900">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-gray-500 mt-0.5 break-words">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
