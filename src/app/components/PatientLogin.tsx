import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Eye, EyeOff, Mail, Lock, User, ArrowLeft, Shield, X, Calendar, Cake, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../config/supabase";

type Tab = "login" | "register";

const CLINIC_NAME = "Samuel P. Dizon Medical Clinic";

export default function PatientLogin() {
  const navigate = useNavigate();
  const { signIn, signUp, verifyOtp, resendOtp, isAuthenticated, userRole, user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalContent, setModalContent] = useState<"terms" | "privacy" | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState(false);

  // Listen for auth state changes to navigate after OTP verification
  useEffect(() => {
    if (pendingNavigation && isAuthenticated && userRole === "patient") {
      console.log("✅ User authenticated after OTP, navigating to onboarding...");
      setPendingNavigation(false);
      navigate("/patient/onboarding", { replace: true });
    }
  }, [isAuthenticated, userRole, pendingNavigation, navigate]);

  // Redirect if already logged in as a patient
  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === "patient") {
        // Check if profile is complete
        checkProfileComplete();
      } else {
        showToast("Wrong Portal", "This account is registered as staff/admin. Please use the Staff Portal.", "error");
        setLoading(false);
      }
    }
  }, [isAuthenticated, userRole, navigate, showToast]);

  const checkProfileComplete = async () => {
    try {
      // Use maybeSingle() to handle missing records gracefully
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("date_of_birth, gender, address, phone")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Profile fetch error:", profileError);
        navigate("/patient/onboarding", { replace: true });
        return;
      }

      const isComplete = 
        profileData?.date_of_birth && 
        profileData?.gender && 
        profileData?.address && 
        profileData?.phone;

      if (isComplete) {
        // Check patients table for additional info
        try {
          const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("blood_type, emergency_contact, emergency_phone")
            .eq("user_id", user?.id)
            .maybeSingle();

          // If patient data exists and has all required fields, go to dashboard
          if (patientData?.blood_type && 
              patientData?.emergency_contact && 
              patientData?.emergency_phone) {
            navigate("/patient/dashboard", { replace: true });
            return;
          }
        } catch (patientErr) {
          console.warn("Patient fetch error (non-critical):", patientErr);
        }
        
        // If patient data missing, go to onboarding to complete
        navigate("/patient/onboarding", { replace: true });
      } else {
        navigate("/patient/onboarding", { replace: true });
      }
    } catch (error) {
      console.error("Error checking profile:", error);
      navigate("/patient/onboarding", { replace: true });
    }
  };

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!loginForm.email || !loginForm.password) {
        throw new Error("Please fill in all fields");
      }

      await signIn(loginForm.email, loginForm.password);
    } catch (err: any) {
      const errorMessage = err.message || "";
      if (errorMessage.toLowerCase().includes("email not confirmed") || 
          errorMessage.toLowerCase().includes("verify your email") ||
          errorMessage.toLowerCase().includes("email not verified")) {
        setOtpEmail(loginForm.email);
        setShowOTPModal(true);
        setLoading(false);
        try {
          await resendOtp(loginForm.email);
        } catch (resendError) {
          console.error("Resend error:", resendError);
        }
        return;
      }
      showToast("Sign In Failed", err.message || "Invalid credentials. Please check your email and password.", "error");
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailError(null);

    try {
      if (!regForm.first_name || !regForm.last_name || !regForm.email || !regForm.password) {
        throw new Error("Please fill in all required fields");
      }

      if (regForm.password !== regForm.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (regForm.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (!regForm.agreeTerms) {
        throw new Error("You must agree to the terms and conditions");
      }

      console.log("🚀 Attempting to create account for:", regForm.email);
      
      const { needsEmailConfirmation } = await signUp(regForm.email, regForm.password, {
        first_name: regForm.first_name,
        last_name: regForm.last_name,
        role: "patient",
      });

      setLoading(false);

      if (needsEmailConfirmation) {
        console.log("📧 Email confirmation required. OTP should be sent to:", regForm.email);
        
        // Show OTP modal for verification
        setOtpEmail(regForm.email);
        setRegisteredEmail(regForm.email);
        setResendCount(0);
        setShowOTPModal(true);
        
        showToast(
          "Verification Code Sent", 
          `We've sent a 6-digit OTP to ${regForm.email}. Please check your email (including spam folder).`, 
          "info"
        );
        
        // Reset form
        setRegForm({
          first_name: "",
          last_name: "",
          email: "",
          password: "",
          confirmPassword: "",
          agreeTerms: false,
        });
      } else {
        showToast("Welcome!", "Account created successfully! Please complete your profile.", "success");
        navigate("/patient/onboarding");
      }

    } catch (err: any) {
      console.error("❌ Registration error:", err);
      
      // Check if it's a rate limit error
      if (err.message?.includes("rate limit") || err.message?.includes("too many")) {
        setEmailError("Too many attempts. Please wait a few minutes before trying again.");
        showToast("Rate Limited", "Too many attempts. Please wait a few minutes.", "error");
      } else {
        setEmailError(err.message || "Registration failed. Please try again.");
        showToast("Registration Failed", err.message || "Registration failed. Please try again.", "error");
      }
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      showToast("Error", "Please enter a valid 6-digit OTP code.", "error");
      return;
    }

    setVerifying(true);
    try {
      console.log("🔐 Verifying OTP for:", otpEmail);
      
      // Verify the OTP
      await verifyOtp(otpEmail, otpCode);
      
      // Close the OTP modal
      setShowOTPModal(false);
      setOtpCode("");
      
      showToast("Success", "Email verified successfully!", "success");
      
      // Set pending navigation flag - this will trigger the useEffect when auth state updates
      setPendingNavigation(true);
      
      // Also try to navigate immediately with a small delay to let session establish
      setTimeout(() => {
        // Check if we already have a session
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            console.log("✅ Session found after OTP, navigating to onboarding...");
            setPendingNavigation(false);
            navigate("/patient/onboarding", { replace: true });
          } else {
            console.log("⏳ Waiting for session to be established...");
          }
        });
      }, 1500);
      
    } catch (err: any) {
      console.error("❌ OTP verification error:", err);
      showToast("Verification Failed", err.message || "Invalid OTP. Please try again.", "error");
      setPendingNavigation(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCount >= 5) {
      showToast("Limit Reached", "You've requested too many OTPs. Please try again later.", "error");
      return;
    }

    setResending(true);
    try {
      console.log(`📧 Resending OTP (attempt ${resendCount + 1}) to:`, otpEmail);
      await resendOtp(otpEmail);
      setResendCount(prev => prev + 1);
      showToast("Success", `OTP resent successfully! (Attempt ${resendCount + 1}/5)`, "success");
    } catch (err: any) {
      console.error("❌ Resend OTP error:", err);
      showToast("Error", err.message || "Failed to resend OTP. Please try again.", "error");
    } finally {
      setResending(false);
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
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm bg-white rounded-2xl px-4 py-2.5 shadow-md border border-green-100 hover:shadow-lg transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Patient Portal</h1>
          <p className="text-gray-500 text-sm mt-1">{CLINIC_NAME}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${tab === t
                  ? "text-green-700 border-b-2 border-green-500 bg-green-50/50"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        placeholder="patient@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-gray-700">Password</label>
                      <button
                        type="button"
                        onClick={() => navigate("/patient/forgot-password")}
                        className="text-xs text-green-600 hover:text-green-700 font-medium"
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
                        placeholder="••••••••"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
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
                </motion.form>
              )}

              {tab === "register" && (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={regForm.first_name}
                          onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })}
                          placeholder="Juan"
                          className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={regForm.last_name}
                        onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })}
                        placeholder="Dela Cruz"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={regForm.email}
                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                        placeholder="juan@email.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password *</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          value={regForm.password}
                          onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                          placeholder="••••••"
                          className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm *</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          value={regForm.confirmPassword}
                          onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                          placeholder="••••••"
                          className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        required
                        checked={regForm.agreeTerms}
                        onChange={(e) => setRegForm({ ...regForm, agreeTerms: e.target.checked })}
                        className="w-4 h-4 rounded-md border-gray-300 text-green-600"
                      />
                    </div>
                    <span className="text-xs text-gray-500 leading-relaxed">
                      I agree to the{" "}
                      <span onClick={() => setModalContent("terms")} className="text-green-600 font-semibold cursor-pointer hover:underline">
                        Terms of Service
                      </span>{" "}
                      and{" "}
                      <span onClick={() => setModalContent("privacy")} className="text-green-600 font-semibold cursor-pointer hover:underline">
                        Privacy Policy
                      </span>
                      . My data will be used for medical record purposes only.
                    </span>
                  </label>

                  {emailError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{emailError}</p>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="pointer-events-none">Creating Account...</span>
                      </>
                    ) : (
                      <span className="pointer-events-none">Create Patient Account</span>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Terms & Privacy Modal */}
      <AnimatePresence>
        {modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModalContent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-xl font-extrabold text-gray-900">
                  {modalContent === "terms" ? "Terms of Service" : "Privacy Policy"}
                </h3>
                <button
                  onClick={() => setModalContent(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm text-gray-600 leading-relaxed">
                {modalContent === "terms" ? (
                  <>
                    <p className="font-semibold text-gray-800">Last Updated: January 2026</p>
                    <p>Welcome to MediFlow, a digital health platform operated by <strong>Samuel P. Dizon Medical Clinic</strong>. By using this platform, you agree to the following terms:</p>

                    <h4 className="font-bold text-gray-800 mt-4">1. Medical Disclaimer</h4>
                    <p>All information and services provided through MediFlow are for informational and administrative purposes only. This platform does not replace professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions regarding a medical condition.</p>

                    <h4 className="font-bold text-gray-800 mt-4">2. Use of Platform</h4>
                    <p>You agree to use MediFlow solely for lawful purposes related to scheduling, managing appointments, and accessing your personal health records. You are responsible for maintaining the confidentiality of your account credentials.</p>

                    <h4 className="font-bold text-gray-800 mt-4">3. Data Privacy</h4>
                    <p>Your personal and health information is collected, stored, and processed in accordance with applicable data protection laws and our Privacy Policy. We take reasonable measures to protect your data from unauthorized access or disclosure.</p>

                    <h4 className="font-bold text-gray-800 mt-4">4. Consent to Electronic Communication</h4>
                    <p>By registering, you consent to receiving electronic communications from the clinic regarding appointments, health reminders, and administrative updates.</p>

                    <h4 className="font-bold text-gray-800 mt-4">5. Limitation of Liability</h4>
                    <p>MediFlow and Samuel P. Dizon Medical Clinic are not liable for any damages arising from the use or inability to use the platform, including but not limited to any errors or omissions in the content.</p>

                    <h4 className="font-bold text-gray-800 mt-4">6. Changes to Terms</h4>
                    <p>We reserve the right to update these terms at any time. Continued use of the platform constitutes acceptance of the revised terms.</p>

                    <p className="mt-4 text-gray-400 text-xs">If you have any questions, please contact us at <a href="mailto:support@mediflow.com" className="text-green-600">support@mediflow.com</a>.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-800">Last Updated: January 2026</p>
                    <p>Your privacy is important to us. This Privacy Policy explains how MediFlow and Samuel P. Dizon Medical Clinic collect, use, and protect your personal information.</p>

                    <h4 className="font-bold text-gray-800 mt-4">1. Information We Collect</h4>
                    <p>We collect the following types of information: (a) Personal identification information such as name, email, phone number, date of birth, and address; (b) Health information such as medical history, diagnoses, treatments, and prescriptions; (c) Appointment and queue data; (d) Technical data such as IP addresses and device information.</p>

                    <h4 className="font-bold text-gray-800 mt-4">2. How We Use Your Information</h4>
                    <p>Your information is used to: (a) Provide medical services and manage your care; (b) Schedule and manage appointments; (c) Send you important updates regarding your health and clinic operations; (d) Improve our services and user experience.</p>

                    <h4 className="font-bold text-gray-800 mt-4">3. Data Security</h4>
                    <p>We implement industry-standard security measures, including encryption and access controls, to protect your information from unauthorized access, disclosure, or loss.</p>

                    <h4 className="font-bold text-gray-800 mt-4">4. Data Sharing</h4>
                    <p>Your information is shared only with authorized personnel at the clinic and third-party service providers necessary for the operation of the platform (e.g., hosting, email services). We do not sell or rent your personal information to third parties.</p>

                    <h4 className="font-bold text-gray-800 mt-4">5. Your Rights</h4>
                    <p>You have the right to access, correct, or delete your personal information at any time. You may also request a copy of your medical records in accordance with applicable laws.</p>

                    <h4 className="font-bold text-gray-800 mt-4">6. Data Retention</h4>
                    <p>We retain your information only for as long as necessary to provide you with services and to comply with legal obligations.</p>

                    <h4 className="font-bold text-gray-800 mt-4">7. Contact Us</h4>
                    <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@mediflow.com" className="text-green-600">support@mediflow.com</a>.</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOTPModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowOTPModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Verify Your Email</h3>
                    <p className="text-green-200 text-sm">Enter the 6-digit OTP sent to your email</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtpCode(val);
                    }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We sent a code to <span className="font-semibold">{otpEmail}</span>
                  </p>
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs text-blue-700">
                      <strong>💡 Troubleshooting:</strong> Check your spam/junk folder. 
                      If you don't see the email, click "Resend OTP" below.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleVerifyOTP}
                  disabled={verifying || otpCode.length !== 6}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" /> Verifying...</>
                  ) : (
                    "Verify OTP"
                  )}
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Didn't receive the code?{" "}
                    <button
                      onClick={handleResendOTP}
                      disabled={resending || resendCount >= 5}
                      className={`font-semibold transition-colors ${
                        resendCount >= 5 
                          ? "text-gray-400 cursor-not-allowed" 
                          : "text-green-600 hover:text-green-700"
                      }`}
                    >
                      {resending ? "Sending..." : resendCount >= 5 ? "Limit Reached" : "Resend OTP"}
                    </button>
                  </p>
                  {resendCount > 0 && resendCount < 5 && (
                    <p className="text-xs text-gray-400 mt-1">Attempt {resendCount}/5</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
