import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, Eye, EyeOff, Mail, Lock, ArrowLeft, Shield, 
  KeyRound, CheckCircle, AlertTriangle, UserPlus
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase, supabaseAdmin } from "../../config/supabase";

type Tab = "login" | "verify-setup";

const CLINIC_NAME = "Samuel P. Dizon Medical Clinic";

export default function StaffLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, userRole, isAuthenticated, verifyOtp, resendOtp, updatePassword } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasShownDeactivatedToast, setHasShownDeactivatedToast] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpResendTimeLeft, setOtpResendTimeLeft] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [verifyForm, setVerifyForm] = useState({ email: "" });
  const [passwordForm, setPasswordForm] = useState({ 
    newPassword: "", 
    confirmPassword: "" 
  });

  // OTP resend timer - only runs when otpResendTimeLeft > 0
  useEffect(() => {
    if (otpResendTimeLeft > 0) {
      const timer = setTimeout(() => setOtpResendTimeLeft(otpResendTimeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendTimeLeft]);

  // Check for email verified state from navigation
  useEffect(() => {
    if (location.state?.verified) {
      showToast("Success", "Email verified successfully! You can now log in.", "success");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, showToast]);

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      setCheckingAuth(true);
      
      if (isAuthenticated) {
        if (userRole === "admin") {
          navigate("/admin/dashboard");
          setCheckingAuth(false);
          return;
        } else if (userRole === "staff") {
          try {
            const { data, error } = await supabaseAdmin
              .from("staff")
              .select("user_id")
              .eq("user_id", user?.id)
              .single();
            
            if (error || !data) {
              console.log("No staff record found");
              setCheckingAuth(false);
            } else {
              navigate("/staff/dashboard");
              setCheckingAuth(false);
              return;
            }
          } catch (error) {
            console.error("Error checking staff profile:", error);
            setCheckingAuth(false);
          }
        } else if (userRole === "patient") {
          showToast("Wrong Portal", "This account is registered as a patient. Please use the Patient Portal.", "error");
          await supabase.auth.signOut();
          setCheckingAuth(false);
          return;
        } else {
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [isAuthenticated, userRole, user, navigate, showToast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasShownDeactivatedToast(false);

    try {
      if (!loginForm.email || !loginForm.password) {
        throw new Error("Please fill in all fields");
      }

      const email = loginForm.email.trim().toLowerCase();
      console.log("Attempting sign in with:", email);
      
      // ============================================================
      // CHECK IF ACCOUNT IS DEACTIVATED
      // ============================================================
      let isDeactivated = false;
      let userId = null;
      
      try {
        const { data: users, error: usersError } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id, email")
          .eq("email", email)
          .maybeSingle();

        if (usersError) {
          console.error("Error fetching user by email:", usersError);
        } else if (users) {
          userId = users.user_id;
        }
        
        if (userId) {
          const { data: staffData, error: staffError } = await supabaseAdmin
            .from("staff")
            .select("user_id, is_active")
            .eq("user_id", userId)
            .maybeSingle();

          if (staffError) {
            console.error("Error checking staff status:", staffError);
          } else if (staffData && staffData.is_active === false) {
            // ✅ Account is deactivated - show warning toast (like Welcome Back! but different)
            isDeactivated = true;
            if (!hasShownDeactivatedToast) {
              setHasShownDeactivatedToast(true);
              showToast("Account Deactivated", "Your account has been deactivated. Please contact the administrator.", "warning");
            }
            setLoading(false);
            return;
          } else if (!staffData) {
            isDeactivated = true;
            if (!hasShownDeactivatedToast) {
              setHasShownDeactivatedToast(true);
              showToast("Account Error", "No staff record found. Please contact the administrator.", "error");
            }
            setLoading(false);
            return;
          }
        }
      } catch (checkError) {
        console.error("Error checking staff status:", checkError);
      }

      // ============================================================
      // If account is NOT deactivated, proceed with login
      // ============================================================
      if (!isDeactivated) {
        try {
          await signIn(email, loginForm.password);
          console.log("Sign in successful!");
          // ✅ "Welcome Back!" toast appears here (success type)
          setLoading(false);
          return;
        } catch (loginError: any) {
          if (loginError.message === "EMAIL_NOT_VERIFIED") {
            console.log("Email not verified - switching to verify/setup tab");
            showToast("Email Not Verified", "Please verify your email first.", "info");
            setTab("verify-setup");
            setVerifyForm({ email: email });
            setOtpCode("");
            setOtpError(null);
            setOtpResendTimeLeft(0);
            setIsEmailVerified(false);
            setPasswordForm({ newPassword: "", confirmPassword: "" });
            setPasswordError(null);
            setLoading(false);
            return;
          }
          throw loginError;
        }
      }

    } catch (err: any) {
      const errorMessage = err.message || "";
      console.error("Login error:", errorMessage);
      
      if (errorMessage.toLowerCase().includes("email not confirmed") || 
          errorMessage.toLowerCase().includes("verify your email") ||
          errorMessage.toLowerCase().includes("confirm your email")) {
        showToast("Verification Required", "Please verify your account first.", "info");
        setTab("verify-setup");
        setVerifyForm({ email: loginForm.email.trim().toLowerCase() });
        setOtpCode("");
        setOtpError(null);
        setOtpResendTimeLeft(0);
        setIsEmailVerified(false);
        setPasswordForm({ newPassword: "", confirmPassword: "" });
        setPasswordError(null);
        setLoading(false);
        return;
      }
      
      if (errorMessage.toLowerCase().includes("invalid login credentials")) {
        showToast("Login Failed", "Invalid email or password. Please check your credentials.", "error");
        setLoading(false);
        return;
      }
      
      if (errorMessage.toLowerCase().includes("user not found")) {
        showToast("Login Failed", "No account found with this email. Please check your email or contact the admin.", "error");
        setLoading(false);
        return;
      }
      
      showToast("Login Failed", errorMessage || "Authentication failed. Please try again.", "error");
      console.error("Staff login error:", err);
      setLoading(false);
    }
  };

  // STEP 1: Verify OTP only
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const email = verifyForm.email.trim().toLowerCase();
    
    if (!email) {
      showToast("Error", "Please enter your email address.", "error");
      return;
    }

    if (otpCode.length !== 6) {
      showToast("Error", "Please enter a valid 6-digit OTP code.", "error");
      return;
    }

    setVerifying(true);
    setOtpError(null);
    
    try {
      console.log("🔍 Verifying OTP for:", email);
      console.log("🔑 OTP Code:", otpCode);
      
      await verifyOtp(email, otpCode);
      
      console.log("✅ OTP verified successfully!");
      showToast("Success", "Email verified! Now set your password.", "success");
      
      setIsEmailVerified(true);
      setOtpError(null);
      setOtpCode("");
      
      setTimeout(() => {
        const passwordInput = document.querySelector('input[name="newPassword"]') as HTMLInputElement;
        if (passwordInput) passwordInput.focus();
      }, 300);
      
    } catch (err: any) {
      console.error("❌ Verification error:", err);
      const errorMessage = err.message || "Invalid OTP. Please check the code and try again.";
      setOtpError(errorMessage);
      showToast("Verification Failed", errorMessage, "error");
      setOtpCode("");
    } finally {
      setVerifying(false);
    }
  };

  // STEP 2: Set password after OTP is verified
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { newPassword, confirmPassword } = passwordForm;
    
    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const email = verifyForm.email.trim().toLowerCase();
    if (!email) {
      setPasswordError("Email not found. Please go back and verify your email.");
      return;
    }

    setSettingPassword(true);
    setPasswordError(null);
    
    try {
      await updatePassword(newPassword);
      
      console.log("✅ Password set successfully!");
      showToast("Success", "Password set successfully! You can now log in.", "success");
      
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setOtpCode("");
      setIsEmailVerified(false);
      setOtpResendTimeLeft(0);
      
      setTab("login");
      setLoginForm({ email: email, password: "" });
      
      setTimeout(() => {
        const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        if (passwordInput) passwordInput.focus();
      }, 300);
      
    } catch (err: any) {
      console.error("❌ Password setup error:", err);
      const errorMessage = err.message || "Failed to set password. Please try again.";
      setPasswordError(errorMessage);
      showToast("Error", errorMessage, "error");
    } finally {
      setSettingPassword(false);
    }
  };

  const handleResendOTP = async () => {
    if (otpResendTimeLeft > 0 || resendingOtp) return;
    
    const email = verifyForm.email.trim().toLowerCase();
    if (!email) {
      showToast("Error", "Please enter your email address first.", "error");
      return;
    }

    setResendingOtp(true);
    setOtpError(null);
    
    try {
      console.log("📧 Resending OTP to:", email);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin + "/staff/login",
        },
      });

      if (error) {
        console.error("❌ Resend OTP error:", error);
        throw error;
      }
      
      console.log("✅ New OTP sent successfully!");
      showToast("Success", "A new 6-digit OTP has been sent to your email. Check your spam folder.", "success");
      setOtpResendTimeLeft(60);
      setOtpCode("");
    } catch (err: any) {
      console.error("❌ Resend OTP error:", err);
      const errorMessage = err.message || "Failed to resend OTP. Please try again.";
      setOtpError(errorMessage);
      showToast("Error", errorMessage, "error");
    } finally {
      setResendingOtp(false);
    }
  };

  const handleSwitchToVerifySetup = () => {
    setTab("verify-setup");
    setVerifyForm({ email: loginForm.email.trim().toLowerCase() || "" });
    setOtpCode("");
    setOtpError(null);
    setOtpResendTimeLeft(0);
    setIsEmailVerified(false);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setPasswordError(null);
  };

  const handleSwitchToLogin = () => {
    setTab("login");
    setOtpError(null);
    setPasswordError(null);
    setIsEmailVerified(false);
    setOtpResendTimeLeft(0);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-green-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />

      <button
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 flex items-center gap-2 text-gray-300 hover:text-white font-medium text-sm bg-white/10 rounded-2xl px-4 py-2.5 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Authorized Personnel Portal</h1>
          <p className="text-gray-400 text-sm mt-1">{CLINIC_NAME}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-xs text-green-400 font-semibold">Secure Access · Authorized Personnel Only</span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="flex border-b border-white/10">
            {(["login", "verify-setup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === "verify-setup") {
                    setVerifyForm({ email: loginForm.email.trim().toLowerCase() || "" });
                    setOtpCode("");
                    setOtpError(null);
                    setOtpResendTimeLeft(0);
                    setIsEmailVerified(false);
                    setPasswordForm({ newPassword: "", confirmPassword: "" });
                    setPasswordError(null);
                  } else {
                    setOtpError(null);
                    setPasswordError(null);
                  }
                }}
                className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  tab === t
                    ? "text-green-400 border-b-2 border-green-500 bg-white/5"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                {t === "login" ? (
                  <><Lock className="w-4 h-4" /> Sign In</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Verify & Setup</>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {tab === "login" && (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        placeholder="your-email@gmail.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-gray-300">Password</label>
                      <button
                        type="button"
                        onClick={() => navigate("/staff/forgot-password")}
                        className="text-xs text-green-400 hover:text-green-300 font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        placeholder="Enter your account password"
                        className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="pointer-events-none">Signing in...</span>
                      </>
                    ) : (
                      <span className="pointer-events-none">Sign In</span>
                    )}
                  </motion.button>

                  <div className="text-center">
                    <p className="text-xs text-gray-400">
                      Need to verify your account and set up a password?{" "}
                      <button
                        type="button"
                        onClick={handleSwitchToVerifySetup}
                        className="text-green-400 hover:text-green-300 font-semibold"
                      >
                        Verify & Setup
                      </button>
                    </p>
                  </div>
                </motion.form>
              )}

              {tab === "verify-setup" && (
                <div className="space-y-5">
                  {!isEmailVerified ? (
                    <motion.form
                      key="verify"
                      initial={{ opacity: 0, x: 0 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 0 }}
                      onSubmit={handleVerifyOTP}
                      className="space-y-5"
                    >
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-500/20">
                          <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Verify Your Email</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Enter the 6-digit OTP code sent to your email
                        </p>
                      </div>

                      {otpError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="bg-red-500/20 border border-red-500/30 rounded-2xl p-3 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200/80">{otpError}</p>
                        </motion.div>
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={verifyForm.email}
                            onChange={(e) => {
                              setVerifyForm({ ...verifyForm, email: e.target.value });
                              setOtpError(null);
                            }}
                            placeholder="your-email@gmail.com"
                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">6-Digit OTP Code</label>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setOtpCode(val);
                              setOtpError(null);
                            }}
                            placeholder="Enter 6-digit code"
                            className={`w-full pl-10 pr-4 py-3 bg-white/10 border rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-center text-2xl tracking-widest font-mono ${
                              otpError ? "border-red-500/50" : "border-white/10"
                            }`}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-400">
                            Enter the 6-digit OTP code sent to your email
                          </p>
                          <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={otpResendTimeLeft > 0 || resendingOtp}
                            className={`text-xs font-semibold transition-colors ${
                              otpResendTimeLeft > 0 || resendingOtp
                                ? "text-gray-500 cursor-not-allowed"
                                : "text-green-400 hover:text-green-300"
                            }`}
                          >
                            {resendingOtp ? (
                              <>
                                <div className="inline-block w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mr-1" />
                                Sending...
                              </>
                            ) : otpResendTimeLeft > 0 ? (
                              `Resend in ${otpResendTimeLeft}s`
                            ) : (
                              "Resend OTP"
                            )}
                          </button>
                        </div>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={verifying || otpCode.length !== 6}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                      >
                        {verifying ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Verifying OTP...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4" />
                            <span>Verify OTP</span>
                          </>
                        )}
                      </motion.button>

                      <div className="p-3 bg-white/5 rounded-2xl border border-green-500/20">
                        <p className="text-xs text-gray-400 text-center">
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1 text-green-400" />
                          Enter the OTP code from your email to verify your account.
                        </p>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="set-password"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      onSubmit={handleSetPassword}
                      className="space-y-5"
                    >
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-500/20">
                          <CheckCircle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Set Your Password</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Create a password for <span className="text-green-400">{verifyForm.email}</span>
                        </p>
                      </div>

                      {passwordError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="bg-red-500/20 border border-red-500/30 rounded-2xl p-3 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-200/80">{passwordError}</p>
                        </motion.div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">New Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type={showNewPass ? "text" : "password"}
                              name="newPassword"
                              required
                              value={passwordForm.newPassword}
                              onChange={(e) => {
                                setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                                setPasswordError(null);
                              }}
                              placeholder="Min. 6 chars"
                              className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(!showNewPass)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                            >
                              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type={showConfirmPass ? "text" : "password"}
                              required
                              value={passwordForm.confirmPassword}
                              onChange={(e) => {
                                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                                setPasswordError(null);
                              }}
                              placeholder="Confirm"
                              className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPass(!showConfirmPass)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                            >
                              {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEmailVerified(false);
                            setOtpCode("");
                            setOtpResendTimeLeft(0);
                          }}
                          className="flex-1 py-3.5 text-sm font-semibold text-gray-400 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
                        >
                          Back
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="submit"
                          disabled={settingPassword}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                          {settingPassword ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Setting...</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Set Password</span>
                            </>
                          )}
                        </motion.button>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-green-500/20">
                        <p className="text-xs text-gray-400 text-center">
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1 text-green-400" />
                          Create a secure password for your account.
                        </p>
                      </div>
                    </motion.form>
                  )}

                  <div className="text-center">
                    <p className="text-xs text-gray-400">
                      Already have a password?{" "}
                      <button
                        type="button"
                        onClick={handleSwitchToLogin}
                        className="text-green-400 hover:text-green-300 font-semibold"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This portal is for authorized staff and admin personnel only.
        </p>
      </motion.div>
    </div>
  );
}
