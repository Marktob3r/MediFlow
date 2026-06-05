import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Bell,
  ChevronRight,
  Plus,
  FileText,
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Stethoscope,
  LogOut,
  MapPin,
  User,
  Heart,
  Users,
  Phone,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useNetworkStatus } from "../../components/useNetworkStatus";
import { useToast } from "../../contexts/ToastContext";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isOnline, wasOffline } = useNetworkStatus();
  const [activeQueue, setActiveQueue] = useState<any>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVisits: 0,
    prescriptions: 0,
    upcomingAppointments: 0,
  });

  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Re-fetch automatically when internet reconnects
  useEffect(() => {
    if (wasOffline && user) {
      fetchDashboardData();
    }
  }, [wasOffline]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Dashboard data is now fetched securely as the RequireOnboarding route guard
      // ensures the user's profile is fully complete before reaching this component.
      const { data: queueData } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("patient_id", user?.id)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setActiveQueue(queueData);

      // Fetch recent medical records (last 3)
      const { data: visitsData } = await supabase
        .from("medical_records")
        .select("*")
        .eq("patient_id", user?.id)
        .order("visit_date", { ascending: false })
        .limit(3);

      setRecentVisits(visitsData || []);

      // Fetch unread notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("patient_id", user?.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      setNotifications(notifData || []);

      // Fetch stats
      const { count: totalVisits } = await supabase
        .from("medical_records")
        .select("*", { count: 'exact', head: true })
        .eq("patient_id", user?.id);

      setStats({
        totalVisits: totalVisits || 0,
        prescriptions: 0,
        upcomingAppointments: 0,
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };



  const quickActions = [
    {
      icon: Plus,
      label: "Join Queue",
      desc: "Get a queue token",
      path: "/patient/queue/join",
      color: "bg-gradient-to-br from-green-500 to-emerald-600",
      textColor: "text-white",
    },
    {
      icon: Clock,
      label: "Live Queue",
      desc: "Watch real-time",
      path: "/patient/queue/monitor",
      color: "bg-gradient-to-br from-blue-50 to-indigo-50",
      textColor: "text-blue-700",
      border: "border border-blue-100",
    },
    {
      icon: FileText,
      label: "Medical History",
      desc: "View past records",
      path: "/patient/medical-history",
      color: "bg-gradient-to-br from-amber-50 to-orange-50",
      textColor: "text-amber-700",
      border: "border border-amber-100",
    },
    {
      icon: Calendar,
      label: "Settings",
      desc: "Update profile",
      path: "/patient/settings",
      color: "bg-gradient-to-br from-purple-50 to-violet-50",
      textColor: "text-purple-700",
      border: "border border-purple-100",
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      <div className="flex justify-between items-center mb-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {getGreeting()}, {user?.first_name}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
          </p>
        </motion.div>

      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <Stethoscope className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{stats.totalVisits}</p>
          <p className="text-xs text-gray-500">Total Visits</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{activeQueue ? "Active" : "None"}</p>
          <p className="text-xs text-gray-500">Queue Status</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{user?.patient_id || "N/A"}</p>
          <p className="text-xs text-gray-500">Patient ID</p>
        </div>
      </motion.div>

      {/* Active Queue Card */}
      {activeQueue && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full translate-y-8" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-200" />
                  <span className="text-sm font-semibold text-green-100">Active Queue Token</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Active
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-green-200 text-xs uppercase tracking-widest mb-1">Your Token</p>
                  <p className="text-6xl font-black leading-none">{activeQueue.token}</p>
                  <p className="text-green-200 text-sm mt-2">{activeQueue.service}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-200 text-xs">Position in Queue</p>
                  <p className="text-4xl font-black">#{activeQueue.position || "~"}</p>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => navigate("/patient/queue/monitor")}
                  className="w-full bg-white text-green-700 font-bold py-3 rounded-2xl text-sm hover:bg-green-50 transition-colors"
                >
                  Track Live Queue
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-6"
      >
        <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(action.path)}
              className={`${action.color} ${action.border || ""} ${action.textColor} rounded-3xl p-5 text-left shadow-sm hover:shadow-md transition-all`}
            >
              <action.icon className="w-7 h-7 mb-3" />
              <p className="font-bold text-sm">{action.label}</p>
              <p className={`text-xs mt-0.5 ${i === 0 ? "text-green-100" : "opacity-70"}`}>{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Visits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">Recent Visits</h3>
              </div>
              <button
                onClick={() => navigate("/patient/medical-history")}
                className="text-xs text-green-600 font-semibold hover:text-green-700 flex items-center gap-1"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentVisits.length > 0 ? (
                recentVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate("/patient/medical-history")}
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{visit.service || "Consultation"}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {visit.doctor_name || "Clinic Doctor"} · {new Date(visit.visit_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{visit.diagnosis || "No diagnosis recorded"}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Done
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold mb-1">No medical records yet</h4>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Your visit history, diagnoses, and prescriptions will securely appear here after your first consultation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >


          {/* Health Tip */}
          <div className="mt-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl p-5 border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Health Tip</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Stay hydrated! Drink at least 8 glasses of water daily to maintain good health. 💧
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}