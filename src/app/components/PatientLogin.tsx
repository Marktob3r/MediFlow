import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Eye, EyeOff, Mail, Lock, User, ArrowLeft, CheckCircle, AlertCircle, Phone, X, ScrollText, Shield } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

type Tab = "login" | "register";

const CLINIC_NAME = "Samuel P. Dizon Medical Clinic";

export default function PatientLogin() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated, userRole } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<"terms" | "privacy" | null>(null);

  // Redirect if already logged in as a patient
  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === "patient") {
        navigate("/patient/dashboard");
      } else {
        setError("This account is registered as staff/admin. Please use the Staff Portal.");
        setLoading(false);
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!loginForm.email || !loginForm.password) {
        throw new Error("Please fill in all fields");
      }

      await signIn(loginForm.email, loginForm.password);
      // Navigation is now handled by the useEffect above
    } catch (err: any) {
      setError(err.message || "Sign in failed. Please check your credentials.");
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

      const { needsEmailConfirmation } = await signUp(regForm.email, regForm.password, {
        first_name: regForm.first_name,
        last_name: regForm.last_name,
        phone: regForm.phone,
      });

      // Route based on whether Supabase has email confirmation enabled
      if (needsEmailConfirmation) {
        setLoading(false);
        navigate("/patient/verify", { state: { email: regForm.email } });
      } else {
        // Email confirmation is disabled in Supabase — go straight to dashboard
        // Wait for useEffect to navigate
      }

    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
      console.error("Registration error:", err);
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
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Patient Portal</h1>
          <p className="text-gray-500 text-sm mt-1">{CLINIC_NAME}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden">
          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}

          {/* Tab switcher */}
          <div className="flex border-b border-gray-100">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
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
              {/* ── LOGIN FORM ── */}
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
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

              {/* ── REGISTER FORM ── */}
              {tab === "register" && !success && (
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        First Name *
                      </label>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Last Name *
                      </label>
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Email *
                    </label>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Password *
                      </label>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Confirm *
                      </label>
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

                  {/* Terms */}
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
                      <span 
                        onClick={() => setModalContent("terms")}
                        className="text-green-600 font-semibold cursor-pointer hover:underline"
                      >
                        Terms of Service
                      </span>{" "}
                      and{" "}
                      <span 
                        onClick={() => setModalContent("privacy")}
                        className="text-green-600 font-semibold cursor-pointer hover:underline"
                      >
                        Privacy Policy
                      </span>
                      . My data will be used for medical record purposes only.
                    </span>
                  </label>

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

              {/* ── SUCCESS STATE ── */}
              {tab === "register" && success && (
                <motion.div
                  key="success"
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
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h3>
                  <p className="text-gray-500 text-sm">
                    Your patient account has been successfully created.
                    <br />
                    Redirecting to dashboard...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── TERMS & PRIVACY MODAL ── */}
      <AnimatePresence>
        {modalContent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalContent(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    {modalContent === "terms" ? <ScrollText className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {modalContent === "terms" ? "Terms of Service" : "Privacy Policy"}
                  </h3>
                </div>
                <button
                  onClick={() => setModalContent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-gray-600 space-y-4">
                {modalContent === "terms" ? (
                  <>
                    <p className="font-semibold text-gray-900">1. Acceptance of Terms</p>
                    <p>By creating an account and accessing the MediFlow patient portal for {CLINIC_NAME}, you agree to be bound by these Terms of Service. If you do not agree, please do not use this service.</p>
                    
                    <p className="font-semibold text-gray-900 mt-4">2. Medical Information Disclaimer</p>
                    <p>This system is designed for queue management, appointment scheduling, and accessing personal medical records. The information provided through this portal does not substitute professional medical advice, diagnosis, or treatment.</p>
                    
                    <p className="font-semibold text-gray-900 mt-4">3. Account Security</p>
                    <p>You are responsible for maintaining the confidentiality of your login credentials. Any activity occurring under your account is your responsibility. Please notify clinic staff immediately of any unauthorized use.</p>

                    <p className="font-semibold text-gray-900 mt-4">4. Queue & Appointment Rules</p>
                    <p>Generating a queue token does not guarantee an exact consultation time. Wait times are estimates. Patients must be present at the clinic when their number is called, otherwise they may forfeit their position.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-900">1. Information We Collect</p>
                    <p>We collect personal information necessary for providing medical care, including your name, contact details, date of birth, gender, and medical history. We also collect usage data to improve our digital services.</p>
                    
                    <p className="font-semibold text-gray-900 mt-4">2. How We Use Your Data</p>
                    <p>Your data is used strictly for facilitating medical consultations, maintaining accurate health records at {CLINIC_NAME}, and sending important notifications regarding your queue status or appointments.</p>
                    
                    <p className="font-semibold text-gray-900 mt-4">3. Data Protection & Security</p>
                    <p>We implement industry-standard security measures to protect your personal health information. Your data is encrypted and stored securely. We comply with all applicable national data privacy laws regarding medical records.</p>
                    
                    <p className="font-semibold text-gray-900 mt-4">4. Sharing of Information</p>
                    <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties without your explicit consent, except when required by law or necessary for emergency medical treatment.</p>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setModalContent(null)}
                  className="bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}