import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendOtp, isAuthenticated, userRole } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { showToast } = useToast();
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Redirect if successfully verified and authenticated
  useEffect(() => {
    if (isAuthenticated && userRole === "patient") {
      navigate("/patient/dashboard");
    }
  }, [isAuthenticated, userRole, navigate]);

  // Email is passed via React Router state from the signup page
  const email = location.state?.email || "";

  if (!email) {
    // If there's no email in state, redirect back to login
    navigate("/patient/login");
    return null;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!token || token.length !== 6) {
        throw new Error("Please enter the full 6-digit code from your email.");
      }

      await verifyOtp(email, token);

      // On success, AuthContext handles the session and navigation is handled by the useEffect above
    } catch (err: any) {
      showToast("Verification Failed", err.message || "Invalid verification code. Please try again.", "error");
      console.error("Verification error:", err);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await resendOtp(email);
      showToast("Code Sent", "A new verification code has been sent to your email.", "success");
      setCooldown(60);
    } catch (err: any) {
      showToast("Resend Failed", err.message || "Failed to resend code. Please try again.", "error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      {/* Back button */}
      <button
        onClick={() => navigate("/patient/login")}
        className="fixed top-6 left-6 flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm bg-white rounded-2xl px-4 py-2.5 shadow-md border border-green-100 hover:shadow-lg transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Verify Your Email</h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed px-4">
            We've sent a 6-digit verification code to <br />
            <span className="font-semibold text-gray-800">{email}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 p-6 sm:p-8">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="flex justify-center">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={token}
                  onChange={(e) => {
                    // Only allow numbers
                    const val = e.target.value.replace(/\D/g, '');
                    setToken(val);
                  }}
                  placeholder="000000"
                  className="w-48 text-center text-3xl tracking-widest px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading || token.length !== 6}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Didn't receive the email?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className={`font-semibold transition-colors ${
                cooldown > 0 || resending
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-green-600 hover:text-green-700"
              }`}
            >
              {resending ? "Sending..." : cooldown > 0 ? `Resend Code in ${cooldown}s` : "Resend Code"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
