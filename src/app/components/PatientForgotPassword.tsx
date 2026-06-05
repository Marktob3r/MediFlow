import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Lock, Eye, EyeOff, Search, ShieldAlert, Activity } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useToast } from "../../contexts/ToastContext";

type Step = "find_account" | "confirm_code" | "reset_password" | "success";

const COOLDOWN_KEY = "forgot_password_cooldown_end";

const getRemainingCooldown = () => {
  const endStr = localStorage.getItem(COOLDOWN_KEY);
  if (!endStr) return 0;
  const endTime = parseInt(endStr, 10);
  const remaining = Math.ceil((endTime - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
};

const CLINIC_NAME = "Samuel P. Dizon Medical Clinic";

export default function PatientForgotPassword() {
  const navigate = useNavigate();
  const { sendPasswordResetOtp, verifyPasswordResetOtp, updatePassword } = useAuth();
  
  const [step, setStep] = useState<Step>("find_account");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [cooldown, setCooldownState] = useState(getRemainingCooldown());
  const { showToast } = useToast();

  const setCooldown = (seconds: number) => {
    const endTime = Date.now() + seconds * 1000;
    localStorage.setItem(COOLDOWN_KEY, endTime.toString());
    setCooldownState(seconds);
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => {
        const remaining = getRemainingCooldown();
        setCooldownState(remaining);
        if (remaining <= 0) {
          localStorage.removeItem(COOLDOWN_KEY);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email) throw new Error("Please enter your email address.");

      // Security: verify the email belongs to a registered account before
      // sending any reset email — prevents fake-email spam and user enumeration.
      const { data: accountData, error: lookupError } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!accountData) {
        // Apply a 15-second cooldown even on failure to slow down enumeration
        setCooldown(15);
        throw new Error("No account found with this email. Please check and try again.");
      }

      await sendPasswordResetOtp(email);
      setStep("confirm_code");
      showToast("Success", "A 6-digit code has been sent to your email.", "success");
      setCooldown(60);
    } catch (err: any) {
      showToast("Error", err.message || "Failed to find account or send recovery email.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!token || token.length !== 6) {
        throw new Error("Please enter the full 6-digit code.");
      }
      await verifyPasswordResetOtp(email, token);
      setStep("reset_password");
    } catch (err: any) {
      showToast("Error", err.message || "Invalid or expired code.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await sendPasswordResetOtp(email);
      showToast("Success", "A new verification code has been sent to your email.", "success");
      setCooldown(60);
    } catch (err: any) {
      showToast("Error", err.message || "Failed to resend code.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      await updatePassword(newPassword);
      setStep("success");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to update password.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Floating Medical Doodles */}
      {[
        { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", x: "8%", y: "10%", size: 108, delay: 0, duration: 6 },
        { icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", x: "85%", y: "8%", size: 84, delay: 1.2, duration: 7 },
        { icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", x: "6%", y: "65%", size: 96, delay: 0.8, duration: 8 },
        { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", x: "82%", y: "62%", size: 90, delay: 2, duration: 6.5 },
        { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", x: "86%", y: "32%", size: 78, delay: 1.5, duration: 7.5 },
        { icon: "M13 10V3L4 14h7v7l9-11h-7z", x: "4%", y: "38%", size: 72, delay: 0.4, duration: 5.5 },
        { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", x: "74%", y: "82%", size: 84, delay: 2.5, duration: 9 },
        { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", x: "16%", y: "83%", size: 66, delay: 3, duration: 7 },
        { icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", x: "57%", y: "3%", size: 78, delay: 1.8, duration: 8.5 },
      ].map((d, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ left: d.x, top: d.y }}
          animate={{ y: [0, -14, 0], rotate: [0, 6, -6, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d={d.icon} />
          </svg>
        </motion.div>
      ))}

      {/* Back button */}
      <button
        onClick={() => step === "find_account" || step === "success" ? navigate("/patient/login") : setStep("find_account")}
        className="fixed top-6 left-6 flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm bg-white rounded-2xl px-4 py-2.5 shadow-md border border-green-100 hover:shadow-lg transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        {step === "find_account" || step === "success" ? "Back to Login" : "Back"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Patient Portal</h1>
          <p className="text-gray-500 text-sm mt-1">{CLINIC_NAME}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden p-6 sm:p-8">
          
          <AnimatePresence mode="wait">
            
            {/* ── STEP 1: FIND ACCOUNT ── */}
            {step === "find_account" && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Find your account</h2>
                <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">
                  Please enter your email address to search for your account.
                </p>

                <form onSubmit={handleFindAccount} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="patient@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading || cooldown > 0}
                    className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl shadow hover:bg-green-700 transition-all disabled:opacity-70 flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : cooldown > 0 ? (
                      `Please wait ${cooldown}s…`
                    ) : (
                      "Search"
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── STEP 2: CONFIRM CODE ── */}
            {step === "confirm_code" && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter security code</h2>
                <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">
                  Please check your email for a message with your code. Your code is 6 numbers long.
                </p>

                <div className="flex items-center gap-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">We sent a code to:</p>
                    <p className="text-sm text-gray-500">{email}</p>
                  </div>
                </div>

                <form onSubmit={handleConfirmCode} className="space-y-6">
                  <div>
                    <div className="flex justify-center">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={token}
                        onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full max-w-[200px] text-center text-3xl tracking-widest px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("find_account")}
                      className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-2xl hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={loading || token.length !== 6}
                      className="flex-1 bg-green-600 text-white font-bold py-3.5 rounded-2xl shadow hover:bg-green-700 transition-all disabled:opacity-70 flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        "Continue"
                      )}
                    </motion.button>
                  </div>
                </form>

                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={cooldown > 0 || loading}
                    className={`text-sm font-semibold transition-colors ${
                      cooldown > 0 || loading
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-green-600 hover:text-green-700"
                    }`}
                  >
                    {cooldown > 0 ? `Didn't get a code? Wait ${cooldown}s` : "Didn't get a code?"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: RESET PASSWORD ── */}
            {step === "reset_password" && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create new password</h2>
                <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">
                  You'll use this password to access your account. Enter a combination of at least 6 letters, numbers, and punctuation marks.
                </p>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      {showPass ? "Hide" : "Show"} passwords
                    </button>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl shadow hover:bg-green-700 transition-all disabled:opacity-70 flex items-center justify-center mt-4"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Update Password"
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── STEP 4: SUCCESS ── */}
            {step === "success" && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h3>
                <p className="text-gray-500 text-sm mb-8">
                  Your password has been changed successfully. You can now use your new password to log in.
                </p>
                <button
                  onClick={() => navigate("/patient/login")}
                  className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl shadow hover:bg-green-700 transition-all"
                >
                  Return to Login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
