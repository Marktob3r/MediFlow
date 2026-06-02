import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Activity,
  UserPlus,
  SkipForward,
  X,
  Bell,
  FileText,
  Stethoscope,
  ArrowUp,
  MoreVertical,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useNetworkStatus } from "../../components/useNetworkStatus";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, wasOffline } = useNetworkStatus();
  const [queue, setQueue] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState({
    totalToday: 0,
    served: 0,
    waiting: 0,
    absent: 0,
    currentlyServing: "",
    avgWaitTime: 0,
  });
  const [queuePaused, setQueuePaused] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingToken, setCompletingToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [diagnosisNotes, setDiagnosisNotes] = useState("");

  useEffect(() => {
    fetchQueueData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchQueueData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch automatically when internet reconnects
  useEffect(() => {
    if (wasOffline) {
      fetchQueueData();
    }
  }, [wasOffline]);

  const fetchQueueData = async () => {
    try {
      // Fetch all active queue entries
      const { data: queueData, error } = await supabase
        .from("queue_entries")
        .select("*")
        .in("status", ["waiting", "serving"])
        .order("queue_number", { ascending: true });

      if (error) throw error;

      // Format queue data
      const formattedQueue = (queueData || []).map((item, index) => ({
        token: item.token,
        name: item.patient_name || `Patient ${index + 1}`,
        service: item.service,
        chiefComplaint: item.chief_complaint || "No complaint recorded",
        waitTime: index === 0 ? "Now" : `~${index * 8} min`,
        status: item.status,
        urgent: false, // You can add an urgent flag to the table
        joinedAt: new Date(item.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));

      setQueue(formattedQueue);

      // Calculate stats
      const serving = formattedQueue.filter(q => q.status === "serving");
      const waiting = formattedQueue.filter(q => q.status === "waiting");
      
      setQueueStats({
        totalToday: queueData?.length || 0,
        served: 0, // You'll need a separate table for completed visits
        waiting: waiting.length,
        absent: 0,
        currentlyServing: serving[0]?.token || "",
        avgWaitTime: waiting.length * 8,
      });

    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = async () => {
    try {
      const currentServing = queue.find(q => q.status === "serving");
      const nextPatient = queue.find(q => q.status === "waiting");
      
      if (currentServing) {
        // Mark current as completed
        await supabase
          .from("queue_entries")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("token", currentServing.token);
      }
      
      if (nextPatient) {
        // Mark next as serving
        await supabase
          .from("queue_entries")
          .update({ status: "serving", updated_at: new Date().toISOString() })
          .eq("token", nextPatient.token);
      }
      
      fetchQueueData();
    } catch (error) {
      console.error("Error calling next patient:", error);
    }
  };

  const handleComplete = (token: string) => {
    setCompletingToken(token);
    setDiagnosisNotes("");
    setShowCompleteModal(true);
  };

  const handleCompleteVisit = async () => {
    try {
      // Mark as completed
      await supabase
        .from("queue_entries")
        .update({ 
          status: "completed", 
          updated_at: new Date().toISOString(),
          diagnosis_notes: diagnosisNotes 
        })
        .eq("token", completingToken);
      
      setShowCompleteModal(false);
      fetchQueueData();
      handleCallNext();
    } catch (error) {
      console.error("Error completing visit:", error);
    }
  };

  const stats = [
    { label: "Total Today", value: queueStats.totalToday, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Waiting", value: queueStats.waiting, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Avg Wait", value: `${queueStats.avgWaitTime} min`, icon: Activity, color: "text-green-600 bg-green-50" },
    { label: "Serving", value: queueStats.currentlyServing || "None", icon: CheckCircle, color: "text-purple-600 bg-purple-50" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPatient = queue.find(q => q.status === "serving");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Staff Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQueuePaused(!queuePaused)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              queuePaused
                ? "bg-green-500 text-white shadow-md hover:bg-green-600"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            {queuePaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            {queuePaused ? "Resume Queue" : "Pause Queue"}
          </button>
          <button
            onClick={() => navigate("/staff/walkin")}
            className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Walk-in
          </button>
        </div>
      </div>

      {/* Queue Paused Alert */}
      <AnimatePresence>
        {queuePaused && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 mb-5"
          >
            <PauseCircle className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-semibold text-amber-800">Queue is currently PAUSED — no new notifications will be sent to patients.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
          >
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-3xl font-black text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Current Patient + Queue */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Currently Serving Panel */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-200 text-sm font-semibold">Currently Serving</span>
              <span className="flex items-center gap-1.5 text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live
              </span>
            </div>

            <p className="text-7xl font-black mb-2">
              {queueStats.currentlyServing || "---"}
            </p>

            {currentPatient ? (
              <div className="bg-white/15 rounded-2xl p-4 mb-4">
                <p className="font-bold text-lg">{currentPatient.name}</p>
                <p className="text-green-200 text-sm">{currentPatient.service}</p>
                <p className="text-green-100 text-xs mt-1 italic">"{currentPatient.chiefComplaint}"</p>
                <div className="flex gap-3 mt-3 text-xs text-green-200">
                  <span>In at {currentPatient.joinedAt}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleComplete(currentPatient.token)}
                    className="flex-1 bg-white text-green-700 font-bold py-2 rounded-xl text-sm hover:bg-green-50 transition-colors"
                  >
                    Complete Visit
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8 mb-4 text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-green-100" />
                </div>
                <p className="font-bold text-white text-lg mb-1">Ready for next patient</p>
                <p className="text-green-200 text-sm">Call the next patient when you are ready.</p>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCallNext}
              className="w-full bg-white text-green-700 font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              Call Next Patient
            </motion.button>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="bg-white/10 rounded-2xl py-2">
                <p className="text-green-200 text-xs">Avg Wait</p>
                <p className="font-bold">{queueStats.avgWaitTime} min</p>
              </div>
              <div className="bg-white/10 rounded-2xl py-2">
                <p className="text-green-200 text-xs">In Queue</p>
                <p className="font-bold">{queueStats.waiting}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Queue List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">Active Queue</h3>
              </div>
              <span className="text-xs text-gray-400">
                {queue.filter(q => q.status === "waiting").length} patients waiting
              </span>
            </div>

            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {queue.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
                    <Users className="w-10 h-10 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold text-lg mb-2">Queue is empty</h4>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                    There are currently no patients waiting in the live queue.
                  </p>
                  <button
                    onClick={() => navigate("/staff/walkin")}
                    className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded-2xl hover:bg-gray-50 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register Walk-in Patient
                  </button>
                </div>
              ) : (
                queue.map((patient, i) => (
                  <motion.div
                    key={patient.token}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${
                      patient.urgent ? "border-l-4 border-red-400 bg-red-50/30" : ""
                    }`}
                  >
                    <div
                      className={`w-14 text-center py-2 rounded-xl font-black text-sm flex-shrink-0 ${
                        patient.status === "serving"
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {patient.token}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
                        {patient.urgent && (
                          <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            URGENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{patient.service}</p>
                      <p className="text-xs text-gray-400 italic truncate mt-0.5">"{patient.chiefComplaint}"</p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                        patient.status === "serving" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {patient.status === "serving" ? "Serving" : patient.waitTime}
                      </span>
                    </div>

                    {patient.status === "waiting" && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setSelectedPatient(selectedPatient?.token === patient.token ? null : patient)}
                          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {selectedPatient?.token === patient.token && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-100 z-10 w-44 py-2 overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  navigate(`/staff/records?patient=${patient.name}`);
                                  setSelectedPatient(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View Record
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Complete Visit Modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Complete Visit?</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Mark token <strong>{completingToken}</strong> as completed.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Diagnosis / Notes
                </label>
                <textarea
                  rows={3}
                  value={diagnosisNotes}
                  onChange={(e) => setDiagnosisNotes(e.target.value)}
                  placeholder="Enter diagnosis, treatment notes..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteVisit}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md text-sm"
                >
                  Complete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}