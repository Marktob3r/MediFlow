import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, X } from "lucide-react";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

type PasswordConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionTitle: string;
  actionDescription: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
};

export default function PasswordConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  actionDescription,
  confirmButtonText = "Confirm Action",
  isDestructive = false,
}: PasswordConfirmModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast("Required", "Please enter your password to continue.", "error");
      return;
    }

    setVerifying(true);
    
    // Re-authenticate to verify identity
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password,
    });

    setVerifying(false);

    if (error) {
      showToast("Authentication Failed", "Incorrect password. Action denied.", "error");
      setPassword("");
    } else {
      setPassword("");
      onConfirm();
    }
  };

  const handleClose = () => {
    setPassword("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-slate-900 text-white'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-base leading-tight">Security Verification</h2>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{actionTitle}</h3>
                  <p className="text-sm text-gray-500 mb-5">{actionDescription}</p>

                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Enter Admin Password
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className={`flex-1 py-3 text-white font-bold text-sm rounded-2xl shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] ${
                      isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    {verifying ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Verifying...</span></>
                    ) : (
                      <span>{confirmButtonText}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
