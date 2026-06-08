import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Activity,
  Download,
  Calendar,
  Shield,
  Building2,
  UserPlus,
  Trash2,
  Edit2,
  Settings,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { getStaffList, StaffUser, resendInvite } from "../../services/adminApi";
import InviteStaffModal from "./InviteStaffModal";
import EditStaffModal from "./EditStaffModal";
import { useToast } from "../../contexts/ToastContext";

type AdminTab = "analytics" | "accounts" | "queue-controls" | "settings";

// Color palette for charts
const COLORS = ["#16a34a", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [reportPeriod, setReportPeriod] = useState("weekly");
  const [queueStarted, setQueueStarted] = useState(true);
  const [dailyCap, setDailyCap] = useState(80);
  const [loading, setLoading] = useState(true);

  // State for dynamic data
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [dailyVolume, setDailyVolume] = useState<any[]>([]);
  const [serviceDistribution, setServiceDistribution] = useState<any[]>([]);
  const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);
  const [waitTimeTrend, setWaitTimeTrend] = useState<any[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffUser[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  
  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editModalStaff, setEditModalStaff] = useState<StaffUser | null>(null);
  
  const { showToast } = useToast();
  const location = useLocation();

  // Settings state
  const [clinicSettings, setClinicSettings] = useState({
    phone: "0950 331 3347",
    email: "thebuj29@yahoo.com.ph",
    address: "2/F RM Centrepoint Bldg. Magsaysay Drive cor. Rizal Ave. East Tapinac, Olongapo, Philippines, 2200",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Sync active tab with URL path
  useEffect(() => {
    const path = location.pathname.split("/").pop();
    if (path === "accounts") setActiveTab("accounts");
    else if (path === "queue-controls") setActiveTab("queue-controls");
    else if (path === "settings") setActiveTab("settings");
    else setActiveTab("analytics"); // default for /admin/dashboard
  }, [location.pathname]);

  useEffect(() => {
    fetchDashboardData();
    fetchClinicSettings();
  }, [reportPeriod]);

  const fetchClinicSettings = async () => {
    const { data } = await supabase
      .from("queue_settings")
      .select("id, clinic_phone, clinic_email, clinic_address")
      .limit(1)
      .single();
    if (data) {
      setSettingsRowId(data.id);
      setClinicSettings({
        phone: data.clinic_phone || "",
        email: data.clinic_email || "",
        address: data.clinic_address || "",
      });
    }
  };

  const saveClinicSettings = async () => {
    if (!settingsRowId) return;
    setSettingsSaving(true);
    const { error } = await supabase
      .from("queue_settings")
      .update({
        clinic_phone: clinicSettings.phone,
        clinic_email: clinicSettings.email,
        clinic_address: clinicSettings.address,
      })
      .eq("id", settingsRowId);
    setSettingsSaving(false);
    if (!error) {
      showToast("Settings Saved", "Clinic contact information has been successfully updated.", "success");
    } else {
      showToast("Error", error.message || "Failed to update settings.", "error");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Validation Error", "Please fill in all password fields.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Validation Error", "New password must be at least 6 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Validation Error", "Passwords do not match.", "error");
      return;
    }
    setPasswordSaving(true);
    // Re-authenticate with current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (signInError) {
      setPasswordSaving(false);
      showToast("Authentication Error", "Current password is incorrect.", "error");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      showToast("Error", error.message, "error");
    } else {
      showToast("Security Updated", "Your password has been changed successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKPIData(),
        fetchDailyVolume(),
        fetchServiceDistribution(),
        fetchHourlyDistribution(),
        fetchWaitTimeTrend(),
        fetchStaffAccounts(),
        fetchSystemLogs(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIData = async () => {
    // Get queue statistics
    const { data: queueData } = await supabase
      .from("queue_entries")
      .select("*");

    const totalPatients = queueData?.length || 0;
    const waiting = queueData?.filter(q => q.status === "waiting").length || 0;
    const served = queueData?.filter(q => q.status === "completed").length || 0;
    const avgWaitTime = Math.round((totalPatients * 8) / 60) || 0;

    setKpiData([
      {
        label: "Total Patients Today",
        value: totalPatients.toString(),
        change: "+8%",
        up: true,
        icon: Users,
        color: "text-blue-600 bg-blue-50",
      },
      {
        label: "Avg Wait Time",
        value: `${avgWaitTime} min`,
        change: "-45%",
        up: false,
        icon: Clock,
        color: "text-green-600 bg-green-50",
        note: "vs. last week",
      },
      {
        label: "Queue Completion",
        value: totalPatients > 0 ? Math.round((served / totalPatients) * 100) + "%" : "0%",
        change: "+2.1%",
        up: true,
        icon: CheckCircle,
        color: "text-emerald-600 bg-emerald-50",
      },
      {
        label: "Currently Waiting",
        value: waiting.toString(),
        change: waiting > 0 ? `+${waiting}` : "0",
        up: waiting > 0,
        icon: AlertTriangle,
        color: "text-amber-600 bg-amber-50",
      },
    ]);
  };

  const fetchDailyVolume = async () => {
    // Get last 7 days of data
    const { data } = await supabase
      .from("queue_entries")
      .select("created_at, status")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const volumeData = days.map(day => ({
      day,
      patients: 0,
      served: 0,
      avgWait: 0,
    }));

    setDailyVolume(volumeData);
  };

  const fetchServiceDistribution = async () => {
    const { data } = await supabase
      .from("queue_entries")
      .select("service")
      .eq("status", "completed");

    const serviceCount: Record<string, number> = {};
    data?.forEach(item => {
      if (item.service) {
        serviceCount[item.service] = (serviceCount[item.service] || 0) + 1;
      }
    });

    const total = Object.values(serviceCount).reduce((a, b) => a + b, 0);
    const distribution = Object.entries(serviceCount).map(([name, value], index) => ({
      name: name.split(" ").slice(0, 2).join(" "),
      value: Math.round((value / total) * 100),
      color: COLORS[index % COLORS.length],
    }));

    setServiceDistribution(distribution.slice(0, 6));
  };

  const fetchHourlyDistribution = async () => {
    // Set to empty array to show beautiful empty state until connected to backend
    setHourlyDistribution([]);
  };

  const fetchWaitTimeTrend = async () => {
    // Set to empty array to show beautiful empty state until connected to backend
    setWaitTimeTrend([]);
  };

  const fetchStaffAccounts = async () => {
    try {
      const { users } = await getStaffList();
      setStaffAccounts(users);
    } catch (err) {
      console.error("Failed to fetch staff accounts:", err);
    }
  };

  const handleResendInvite = async (email: string) => {
    try {
      await resendInvite(email);
      showToast("Success", `Invitation resent to ${email}`, "success");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to resend invite", "error");
    }
  };

  const fetchSystemLogs = async () => {
    // Placeholder logs - replace with actual system logs table later
    setSystemLogs([]);
  };

  const tabs = [
    { id: "analytics" as AdminTab, label: "Analytics & Reports", icon: BarChart3 },
    { id: "accounts" as AdminTab, label: "Account Management", icon: Shield },
    { id: "queue-controls" as AdminTab, label: "Daily Queue Controls", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">




      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="font-bold text-gray-900">Analytics & Reports</h1>
              <p className="text-sm text-gray-500 mt-1">Key performance metrics and service distribution overview.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm"
              >
                <option value="today">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
              </select>
              <button className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiData.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
              >
                <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                {card.change && (
                  <div className="flex items-center gap-1 mt-2">
                    {card.up ? (
                      <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                    )}
                    <span className="text-xs font-semibold text-green-600">{card.change}</span>
                    <span className="text-xs text-gray-400">vs last week</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Service Distribution */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Service Distribution</h3>
                <p className="text-xs text-gray-400 mt-0.5">Today's service breakdown</p>
              </div>
            </div>
            {serviceDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={serviceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {serviceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <BarChart3 className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-gray-900 font-bold mb-1">No services recorded</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Service distribution charts will appear here once patients complete their visits.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ACCOUNT MANAGEMENT TAB */}
      {activeTab === "accounts" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="mb-2">
            <h1 className="font-bold text-gray-900">Account Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage staff credentials and access privileges.</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{staffAccounts.length} staff accounts</p>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm hover:shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffAccounts.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                  <Shield className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-gray-900 font-bold mb-2 text-lg">No staff accounts found</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Get started by adding staff accounts to manage the clinic operations.
                </p>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="mt-6 bg-green-500 text-white font-semibold px-6 py-2.5 rounded-2xl shadow-sm text-sm hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff Account
                </button>
              </div>
            ) : (
              staffAccounts.map((staff) => (
                <div key={staff.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3 items-center">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm ${staff.role === "admin" ? "bg-purple-500" : "bg-blue-500"}`}>
                        {staff.firstName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 leading-tight">{staff.firstName} {staff.lastName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{staff.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${staff.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {staff.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5 mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
                       <span className={`flex items-center gap-1.5 text-xs font-semibold ${staff.status === "active" ? "text-green-600" : staff.status === "pending" ? "text-amber-600" : "text-gray-400"}`}>
                         <span className={`w-2 h-2 rounded-full ${staff.status === "active" ? "bg-green-500" : staff.status === "pending" ? "bg-amber-500" : "bg-gray-300"}`} />
                         {staff.status === "active" ? "Active" : staff.status === "pending" ? "Pending" : "Inactive"}
                       </span>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Last Login</p>
                       <p className="text-xs font-medium text-gray-600">
                         {staff.lastSignIn ? new Date(staff.lastSignIn).toLocaleDateString() : "Never"}
                       </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-auto pt-4 border-t border-gray-50">
                    {staff.status === "pending" && (
                      <button 
                        onClick={() => handleResendInvite(staff.email)}
                        className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors text-xs font-bold"
                      >
                        Resend Invite
                      </button>
                    )}
                    <button 
                      onClick={() => setEditModalStaff(staff)}
                      className="px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors text-xs font-bold flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* QUEUE CONTROLS TAB */}
      {activeTab === "queue-controls" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="mb-2">
            <h1 className="font-bold text-gray-900">Daily Queue Controls</h1>
            <p className="text-sm text-gray-500 mt-1">Configure and manage the daily patient queue system operations.</p>
          </div>
          <div className={`rounded-3xl p-6 border ${queueStarted ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold text-lg ${queueStarted ? "text-green-800" : "text-red-800"}`}>
                  Queue System: {queueStarted ? "RUNNING" : "STOPPED"}
                </p>
                <p className={`text-sm mt-0.5 ${queueStarted ? "text-green-600" : "text-red-600"}`}>
                  {queueStarted ? "Queue is active and accepting patients" : "Queue is currently stopped"}
                </p>
              </div>
              <div className={`w-4 h-4 rounded-full ${queueStarted ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-5">Queue Operations</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setQueueStarted(true)}
                  disabled={queueStarted}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-semibold text-sm hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  Start Daily Queue
                </button>
                <button
                  onClick={() => setQueueStarted(false)}
                  disabled={!queueStarted}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-red-50 text-red-700 border border-red-200 rounded-2xl font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Square className="w-5 h-5" />
                  Stop Queue
                </button>
                <button className="w-full flex items-center gap-3 px-5 py-3.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl font-semibold text-sm hover:bg-amber-100 transition-colors">
                  <RotateCcw className="w-5 h-5" />
                  Reset Queue
                </button>
                <button className="w-full flex items-center gap-3 px-5 py-3.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl font-semibold text-sm hover:bg-blue-100 transition-colors">
                  <RefreshCw className="w-5 h-5" />
                  Refresh Display
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-5">Queue Configuration</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Daily Patient Cap</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={dailyCap}
                      onChange={(e) => setDailyCap(Number(e.target.value))}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <span className="text-sm text-gray-500">patients/day</span>
                  </div>
                </div>
                <button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md text-sm">
                  Save Settings
                </button>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">System Activity Log</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {systemLogs.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-gray-100">
                    <Activity className="w-5 h-5 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold text-sm mb-1">No system activity</h4>
                  <p className="text-xs text-gray-500">
                    System logs and events will appear here once the system is active.
                  </p>
                </div>
              ) : (
                systemLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">{log.time}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${log.type === "success" ? "bg-green-500" : log.type === "warning" ? "bg-amber-500" : "bg-blue-400"
                      }`} />
                    <span className="text-gray-600 text-xs leading-relaxed">{log.action}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === "settings" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="mb-2">
            <h1 className="font-bold text-gray-900 text-2xl tracking-tight">System Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage global clinic configurations and admin security.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clinic Configurations */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-50 flex-grow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">Clinic Details</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Contact and location info</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        value={clinicSettings.phone}
                        onChange={(e) => setClinicSettings(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Support Email</label>
                      <input
                        type="email"
                        value={clinicSettings.email}
                        onChange={(e) => setClinicSettings(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location Address</label>
                    <textarea
                      rows={2}
                      value={clinicSettings.address}
                      onChange={(e) => setClinicSettings(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50/50 p-4 border-t border-gray-100 mt-auto">
                <button
                  onClick={saveClinicSettings}
                  disabled={settingsSaving}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-sm text-sm hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {settingsSaving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                  ) : "Save Details"}
                </button>
              </div>
            </div>

            {/* Admin Security */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-50 flex-grow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">Admin Security</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Update your master password</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 chars"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirm New</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50/50 p-4 border-t border-gray-100 mt-auto">
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl shadow-sm text-sm hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {passwordSaving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Updating...</span></>
                  ) : "Update Security"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      {/* Modals */}
      <InviteStaffModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        onSuccess={fetchStaffAccounts} 
      />
      <EditStaffModal 
        isOpen={editModalStaff !== null} 
        onClose={() => setEditModalStaff(null)} 
        onSuccess={fetchStaffAccounts} 
        staff={editModalStaff} 
      />
    </div>
  );
}