import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Shield, CheckCircle2, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

export default function StaffVerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendOtp, isAuthenticated, userRole } = useAuth();
  const { showToast } = useToast();
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // Get email from location state or localStorage
  useEffect(() => {
    const emailFromState = location.state?.email || "";
    const params = new URLSearchParams(location.search);
    const emailFromQuery = params.get("email") || "";
    const finalEmail = emailFromState || emailFromQuery || "";
    
    if (finalEmail) {
      setEmail(finalEmail);
      localStorage.setItem("staff_verify_email", finalEmail);
    } else {
      const savedEmail = localStorage.getItem("staff_verify_email");
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, [location]);

  // Timer for resend cooldown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === "admin") {
        navigate("/admin/dashboard");
      } else if (userRole === "staff") {
        navigate("/staff/dashboard");
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (value && index === 5) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        setTimeout(() => {
          handleVerify(fullOtp);
        }, 300);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      const fullOtp = otp.join("");
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      } else {
        showToast("Error", "Please enter all 6 digits.", "error");
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);
    
    if (digits.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < digits.length; i++) {
        newOtp[i] = digits[i];
      }
      setOtp(newOtp);
      setError(null);
      
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      if (digits.length === 6) {
        setTimeout(() => {
          handleVerify(digits);
        }, 300);
      }
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const token = otpCode || otp.join("");
    
    if (token.length !== 6) {
      showToast("Error", "Please enter a valid 6-digit OTP.", "error");
      return;
    }

    if (!email) {
      showToast("Error", "Email is required.", "error");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await verifyOtp(email, token);
      
      localStorage.removeItem("staff_verify_email");
      
      navigate("/staff/login", {
        state: {
          verified: true,
          email: email
        }
      });
    } catch (error: any) {
      const errorMessage = error.message || "OTP verification failed. Please try again.";
      setError(errorMessage);
      showToast("Verification Failed", errorMessage, "error");
      
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    
    if (!email) {
      showToast("Error", "Please enter your email address first.", "error");
      return;
    }

    setResending(true);
    setError(null);
    
    try {
      await resendOtp(email);
      showToast("Success", "A new OTP has been sent to your email.", "success");
      setTimeLeft(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to resend OTP. Please try again.";
      setError(errorMessage);
      showToast("Error", errorMessage, "error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-green-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />

      <button
        onClick={() => {
          localStorage.removeItem("staff_verify_email");
          navigate("/staff/login");
        }}
        className="fixed top-6 left-6 flex items-center gap-2 text-gray-300 hover:text-white font-medium text-sm bg-white/10 rounded-2xl px-4 py-2.5 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Verify Your Email</h1>
          <p className="text-gray-400 text-sm mt-2">
            Enter the 6-digit OTP sent to your email
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200/80">{error}</p>
            </motion.div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="staff@spdizon-clinic.ph"
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex justify-center gap-3 mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`w-12 h-14 text-center text-2xl font-bold text-white bg-white/10 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all ${
                  error ? "border-red-500/50" : "border-white/10"
                }`}
                autoFocus={index === 0}
                disabled={loading}
              />
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleVerify()}
            disabled={loading || otp.join("").length !== 6}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Verify Email</span>
              </>
            )}
          </motion.button>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Didn't receive the code?{" "}
              <button
                onClick={handleResend}
                disabled={!canResend || resending}
                className={`font-semibold transition-colors ${
                  canResend && !resending
                    ? "text-green-400 hover:text-green-300"
                    : "text-gray-500 cursor-not-allowed"
                }`}
              >
                {resending ? (
                  <>
                    <div className="inline-block w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mr-1" />
                    Sending...
                  </>
                ) : canResend ? (
                  "Resend OTP"
                ) : (
                  `Resend in ${timeLeft}s`
                )}
              </button>
            </p>
          </div>

          <div className="mt-4 p-3 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs text-gray-400 text-center">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-green-400" />
              A 6-digit OTP has been sent to your email address. Please check your inbox or spam folder.
            </p>
          </div>

          <div className="mt-3 p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <p className="text-xs text-blue-400 text-center">
              <Shield className="w-3.5 h-3.5 inline mr-1" />
              After verification, you can log in with your email and password.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This portal is for authorized staff and admin personnel only.
        </p>
      </motion.div>
    </div>
  );
}