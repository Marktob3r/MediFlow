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
  const [onboardingStep, setOnboardingStep] = useState(1);
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

  // ── Full-Page Onboarding Wizard ──────────────────────────────────────────
  if (showOnboarding) {
    const steps = [
      { id: 1, title: "Personal Info", icon: User },
      { id: 2, title: "Medical Info", icon: Heart },
      { id: 3, title: "Emergency Contact", icon: Users },
    ];
    const TOTAL_STEPS = 3;

    const canProceedStep1 =
      onboardingForm.date_of_birth &&
      onboardingForm.gender &&
      onboardingForm.phone.length === 11;
    const canProceedStep2 =
      onboardingForm.blood_type && onboardingForm.address.trim().length > 0;

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col overflow-y-auto">
        {/* Ambient background circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 rounded-full opacity-40 -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100 rounded-full opacity-40 translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-gray-900 text-lg">MediFlow</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-lg">

            {/* Header */}
            <motion.div
              key={`header-${onboardingStep}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <p className="text-sm font-semibold text-green-600 mb-1">Step {onboardingStep} of {TOTAL_STEPS}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {onboardingStep === 1 && "Tell us about yourself"}
                {onboardingStep === 2 && "Medical details"}
                {onboardingStep === 3 && "Who should we call?"}
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                {onboardingStep === 1 && "We need your basic personal information to create your patient record."}
                {onboardingStep === 2 && "Your medical information helps our staff provide better care."}
                {onboardingStep === 3 && "Add an emergency contact in case we need to reach someone on your behalf."}
              </p>
            </motion.div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    s.id < onboardingStep
                      ? "bg-green-500 text-white"
                      : s.id === onboardingStep
                      ? "bg-gray-900 text-white ring-4 ring-gray-900/10"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {s.id < onboardingStep ? <CheckCircle className="w-4 h-4" /> : s.id}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-gray-100">
                      <motion.div
                        className="h-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: s.id < onboardingStep ? "100%" : "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Form card */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Personal Info ── */}
                {onboardingStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                    className="p-6 sm:p-7 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={onboardingForm.date_of_birth}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, date_of_birth: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Biological Sex</label>
                      <div className="grid grid-cols-2 gap-3">
                        {["Male", "Female"].map((sex) => (
                          <button
                            key={sex}
                            type="button"
                            onClick={() => setOnboardingForm({ ...onboardingForm, gender: sex })}
                            className={`py-3 rounded-2xl border-2 font-semibold text-sm transition-all ${
                              onboardingForm.gender === sex
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {sex === "Male" ? "♂ Male" : "♀ Female"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Phone Number</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono">🇵🇭</span>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          value={onboardingForm.phone}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                          placeholder="09XXXXXXXXX"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                        />
                      </div>
                      {onboardingForm.phone.length > 0 && onboardingForm.phone.length < 11 && (
                        <p className="text-xs text-amber-500 mt-1.5 ml-1">{11 - onboardingForm.phone.length} more digits needed</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── Step 2: Medical Info ── */}
                {onboardingStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                    className="p-6 sm:p-7 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Blood Type</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bt) => (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => setOnboardingForm({ ...onboardingForm, blood_type: bt })}
                            className={`py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                              onboardingForm.blood_type === bt
                                ? "border-red-400 bg-red-50 text-red-600"
                                : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {bt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Home Address</label>
                      <textarea
                        required
                        rows={3}
                        value={onboardingForm.address}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, address: e.target.value })}
                        placeholder="House No., Street, Barangay, City/Municipality, Province"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all resize-none"
                      />
                    </div>
                  </motion.div>
                )}

                {/* ── Step 3: Emergency Contact ── */}
                {onboardingStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                    className="p-6 sm:p-7 space-y-4"
                  >
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        Please provide someone we can contact in case of an emergency — a family member, spouse, or close friend.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Full Name</label>
                      <input
                        type="text"
                        required
                        value={onboardingForm.emergency_contact}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_contact: e.target.value })}
                        placeholder="e.g. Maria Santos"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Phone Number</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono">🇵🇭</span>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          value={onboardingForm.emergency_phone}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                          placeholder="09XXXXXXXXX"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                        />
                      </div>
                      {onboardingForm.emergency_phone.length > 0 && onboardingForm.emergency_phone.length < 11 && (
                        <p className="text-xs text-amber-500 mt-1.5 ml-1">{11 - onboardingForm.emergency_phone.length} more digits needed</p>
                      )}
                    </div>
                    {onboardingError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{onboardingError}</p>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Navigation footer */}
              <div className="px-6 sm:px-7 pb-6 flex gap-3">
                {onboardingStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(s => s - 1)}
                    className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
                  >
                    ← Back
                  </button>
                )}
                {onboardingStep < TOTAL_STEPS ? (
                  <button
                    type="button"
                    disabled={
                      (onboardingStep === 1 && !canProceedStep1) ||
                      (onboardingStep === 2 && !canProceedStep2)
                    }
                    onClick={() => setOnboardingStep(s => s + 1)}
                    className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={savingOnboarding || !onboardingForm.emergency_contact || onboardingForm.emergency_phone.length < 11}
                    onClick={handleSaveOnboarding}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingOnboarding ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                    ) : (
                      "Complete Setup ✓"
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Your information is stored securely and is only accessible to authorised clinic staff.
            </p>
          </div>
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────
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