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

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    date_of_birth: "",
    gender: "",
    blood_type: "",
    address: "",
    phone: "",
    emergency_contact: "",
    emergency_phone: "",
  });
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
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

      // Fetch active queue entry
      const { data: queueData } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("patient_id", user?.id)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setActiveQueue(queueData);

      // Check onboarding status
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      const { data: patientData } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      const isProfileComplete =
        profileData?.date_of_birth &&
        profileData?.gender &&
        profileData?.address &&
        profileData?.phone &&
        patientData?.blood_type &&
        patientData?.emergency_contact &&
        patientData?.emergency_phone;

      if (!isProfileComplete) {
        setShowOnboarding(true);
        setOnboardingForm({
          date_of_birth: profileData?.date_of_birth || "",
          gender: profileData?.gender || "",
          blood_type: patientData?.blood_type || "",
          address: profileData?.address || "",
          phone: profileData?.phone || "",
          emergency_contact: patientData?.emergency_contact || "",
          emergency_phone: patientData?.emergency_phone || "",
        });
      }

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
    setOnboardingForm({
      date_of_birth: "",
      gender: "",
      blood_type: "",
      address: "",
      phone: "",
      emergency_contact: "",
      emergency_phone: "",
    });
    await signOut();
    navigate("/");
  };

  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOnboarding(true);
    setOnboardingError(null);
    try {
      if (!onboardingForm.date_of_birth || !onboardingForm.gender || !onboardingForm.blood_type || !onboardingForm.address || !onboardingForm.phone || !onboardingForm.emergency_contact || !onboardingForm.emergency_phone) {
        throw new Error("Please fill in all required fields to continue.");
      }

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          date_of_birth: onboardingForm.date_of_birth,
          gender: onboardingForm.gender,
          address: onboardingForm.address,
          phone: onboardingForm.phone,
        })
        .eq("user_id", user?.id);

      if (profileError) throw profileError;

      const { error: patientError } = await supabase
        .from("patients")
        .update({
          blood_type: onboardingForm.blood_type,
          emergency_contact: onboardingForm.emergency_contact,
          emergency_phone: onboardingForm.emergency_phone,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user?.id);

      if (patientError) throw patientError;

      setShowOnboarding(false);
      showToast("Profile Completed!", "Your information has been saved successfully.", "success");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to complete onboarding", "error");
      setOnboardingError(err.message);
    } finally {
      setSavingOnboarding(false);
    }
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto relative">

      {/* Onboarding Modal Overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-4 sm:my-8"
          >
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-5 sm:p-6 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold mb-1">Complete Your Profile</h2>
              <p className="text-green-100 text-sm">
                Welcome to MediFlow! We need a few more details to complete your patient record before you can join the queue.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              {onboardingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{onboardingError}</p>
                </div>
              )}

              <form onSubmit={handleSaveOnboarding} className="space-y-4">

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date of Birth *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        required
                        value={onboardingForm.date_of_birth}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, date_of_birth: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sex *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        required
                        value={onboardingForm.gender}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, gender: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none"
                      >
                        <option value="">Select Sex</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        maxLength={11}
                        pattern="\d{11}"
                        title="Must be exactly 11 digits"
                        value={onboardingForm.phone}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        placeholder="09XXXXXXXXX"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Blood Type *</label>
                    <div className="relative">
                      <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        required
                        value={onboardingForm.blood_type}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, blood_type: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none"
                      >
                        <option value="">Select Blood Type</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Home Address *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={onboardingForm.address}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, address: e.target.value })}
                        placeholder="Full Address"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-3">Emergency Contact</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact Name *</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={onboardingForm.emergency_contact}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_contact: e.target.value })}
                          placeholder="Full Name"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact Phone *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          maxLength={11}
                          pattern="\d{11}"
                          title="Must be exactly 11 digits"
                          value={onboardingForm.emergency_phone}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                          placeholder="09XXXXXXXXX"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <LogOut className="w-4 h-4" /> Cancel & Logout
                  </button>
                  <button
                    type="submit"
                    disabled={savingOnboarding}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
                  >
                    {savingOnboarding ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Complete Setup"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

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