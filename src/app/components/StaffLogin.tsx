import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const CLINIC_NAME = "Samuel P. Dizon Medical Clinic";

export default function StaffLogin() {
  const navigate = useNavigate();
  const { signIn, user, userRole, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in as staff/admin
  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === "admin") {
        navigate("/admin/dashboard");
      } else if (userRole === "staff") {
        navigate("/staff/dashboard");
      } else if (userRole === "patient") {
        setError("This account is registered as a patient. Please use the Patient Portal.");
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.email || !form.password) {
        throw new Error("Please fill in all fields");
      }

      await signIn(form.email, form.password);
      // Navigation and role checking is now handled by the useEffect above

    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your credentials.");
      console.error("Staff login error:", err);
      setLoading(false);
    }
    // Note: We don't set loading to false in a finally block here because if successful, 
    // we want the button to stay in the loading state until the redirect happens.
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-green-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />

      {/* Floating Medical Doodles */}
      {[
        { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", x: "7%", y: "12%", size: 120, delay: 0, duration: 7 },
        { icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", x: "87%", y: "9%", size: 96, delay: 1.2, duration: 8 },
        { icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", x: "5%", y: "72%", size: 108, delay: 0.7, duration: 9 },
        { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", x: "88%", y: "65%", size: 102, delay: 2.2, duration: 7 },
        { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", x: "91%", y: "35%", size: 84, delay: 1.5, duration: 8 },
        { icon: "M13 10V3L4 14h7v7l9-11h-7z", x: "3%", y: "40%", size: 78, delay: 0.3, duration: 6 },
        { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", x: "76%", y: "87%", size: 90, delay: 2.8, duration: 10 },
        { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", x: "17%", y: "86%", size: 72, delay: 3.2, duration: 7.5 },
        { icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", x: "58%", y: "4%", size: 84, delay: 1.9, duration: 9.5 },
        { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", x: "36%", y: "92%", size: 66, delay: 0.6, duration: 8 },
      ].map((d, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ left: d.x, top: d.y }}
          animate={{ y: [0, -16, 0], rotate: [0, 8, -8, 0], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d={d.icon} />
          </svg>
        </motion.div>
      ))}

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

        <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@spdizon-clinic.ph"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400"
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

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-start gap-2 px-4 py-3 rounded-2xl text-sm ${error.includes("patient")
                  ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="pointer-events-none">Authenticating...</span>
                </>
              ) : (
                <span className="pointer-events-none">Sign In</span>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}