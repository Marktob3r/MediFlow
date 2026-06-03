import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Lock, Eye, EyeOff, Search, ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";

type Step = "find_account" | "confirm_code" | "reset_password" | "success";

export default function PatientForgotPassword() {
  const navigate = useNavigate();
  const { sendPasswordResetOtp, verifyPasswordResetOtp, updatePassword } = useAuth();
  
  const [step, setStep] = useState<Step>("find_account");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      setMessage("A 6-digit code has been sent to your email.");
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to find account or send recovery email.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (!token || token.length !== 6) {
        throw new Error("Please enter the full 6-digit code.");
      }
      await verifyPasswordResetOtp(email, token);
      setStep("reset_password");
    } catch (err: any) {
      setError(err.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendPasswordResetOtp(email);
      setMessage("A new verification code has been sent to your email.");
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
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
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden p-6 sm:p-8">
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 mb-6"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}
            
            {message && (
              <motion.div
                key="message"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3 mb-6"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{message}</p>
              </motion.div>
            )}
          </AnimatePresence>

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
