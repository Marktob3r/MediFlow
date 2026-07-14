import { useState, useEffect, useRef } from "react";
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
  UserCheck,
  UserX,
  Briefcase,
  PauseCircle,
  PlayCircle,
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
import { supabase, supabaseAdmin } from "../../config/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { updateStaffMember, getStaffList, StaffUser, resendInvite } from "../../services/adminApi";
import InviteStaffModal from "./InviteStaffModal";
import EditStaffModal from "./EditStaffModal";
import PasswordConfirmModal from "./PasswordConfirmModal";
import { useToast } from "../../contexts/ToastContext";

type AdminTab = "analytics" | "accounts" | "queue-controls" | "settings";

// Color palette for charts
const COLORS = ["#16a34a", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#f59e0b", "#8b5cf6", "#ec4899", "#3b82f6"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const location = useLocation();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [reportPeriod, setReportPeriod] = useState("weekly");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Queue state
  const [queuePaused, setQueuePaused] = useState(false);
  const [dailyCap, setDailyCap] = useState(80);
  const [queueSettings, setQueueSettings] = useState<any>(null);
  const [isUpdatingQueue, setIsUpdatingQueue] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  // Password confirmation modal state
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => void;
    isDestructive?: boolean;
    buttonText?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    action: () => {},
  });

  // Data states
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [dailyVolume, setDailyVolume] = useState<any[]>([]);
  const [serviceDistribution, setServiceDistribution] = useState<any[]>([]);
  const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);
  const [waitTimeTrend, setWaitTimeTrend] = useState<any[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffUser[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({
    total: 0,
    waiting: 0,
    serving: 0,
    completed: 0
  });
  const [totalPatients, setTotalPatients] = useState(0);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [pendingStaffCount, setPendingStaffCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editModalStaff, setEditModalStaff] = useState<StaffUser | null>(null);

  // Settings state
  const [clinicSettings, setClinicSettings] = useState({
    phone: "",
    email: "",
    address: "",
    clinic_name: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Realtime channels refs
  const channelsRef = useRef<any[]>([]);
  const isSubscribedRef = useRef(false);

  // Sync active tab with URL path
  useEffect(() => {
    const path = location.pathname.split("/").pop();
    if (path === "accounts") setActiveTab("accounts");
    else if (path === "queue-controls") setActiveTab("queue-controls");
    else if (path === "settings") setActiveTab("settings");
    else setActiveTab("analytics");
  }, [location.pathname]);

  // Fetch data when report period changes
  useEffect(() => {
    fetchDashboardData();
    fetchQueueStatus();
    fetchStaffCounts();
    fetchTodayCount();
  }, [reportPeriod]);

  useEffect(() => {
    fetchClinicSettings();
    fetchQueueSettings();
    fetchStaffCounts();
    fetchQueueStatus();
    fetchTodayCount();
    fetchQueuePauseStatus();
    
    setupRealtimeSubscriptions();

    const interval = setInterval(() => {
      fetchDashboardData();
      fetchQueueStatus();
      fetchStaffCounts();
      fetchTodayCount();
      fetchQueuePauseStatus();
    }, 30000);

    return () => {
      clearInterval(interval);
      cleanupChannels();
    };
  }, []);

  // Cleanup function for channels
  const cleanupChannels = () => {
    channelsRef.current.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn("Error removing channel:", e);
      }
    });
    channelsRef.current = [];
    isSubscribedRef.current = false;
  };

  // Real-time subscriptions
  const setupRealtimeSubscriptions = () => {
    cleanupChannels();

    if (isSubscribedRef.current) return;

    const newChannels = [];

    // Queue channel
    const queueChannel = supabase.channel('admin-queue-changes');
    queueChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_queues' },
        () => {
          fetchQueueStatus();
          fetchKPIData();
          fetchTodayCount();
        }
      )
      .subscribe((status) => {
        console.log('Queue channel status:', status);
      });
    newChannels.push(queueChannel);

    // Medical history channel
    const historyChannel = supabase.channel('admin-history-changes');
    historyChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medical_history' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('History channel status:', status);
      });
    newChannels.push(historyChannel);

    // Staff channel
    const staffChannel = supabase.channel('admin-staff-changes');
    staffChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => {
          fetchStaffAccounts();
          fetchStaffCounts();
        }
      )
      .subscribe((status) => {
        console.log('Staff channel status:', status);
      });
    newChannels.push(staffChannel);

    // User roles channel
    const rolesChannel = supabase.channel('admin-roles-changes');
    rolesChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => {
          fetchStaffAccounts();
          fetchStaffCounts();
        }
      )
      .subscribe((status) => {
        console.log('Roles channel status:', status);
      });
    newChannels.push(rolesChannel);

    // System settings channel
    const settingsChannel = supabase.channel('admin-settings-changes');
    settingsChannel
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'system_settings',
          filter: "key=eq.queue_paused"
        },
        (payload) => {
          const isPaused = payload.new?.value === "true";
          setQueuePaused(isPaused);
          showToast(
            isPaused ? "Queue Paused" : "Queue Resumed",
            isPaused ? "The queue has been paused by staff." : "The queue has been resumed by staff.",
            isPaused ? "warning" : "success"
          );
        }
      )
      .subscribe((status) => {
        console.log('Settings channel status:', status);
      });
    newChannels.push(settingsChannel);

    channelsRef.current = newChannels;
    isSubscribedRef.current = true;
  };

  // ========== FETCH TODAY'S PATIENT COUNT ==========
  const fetchTodayCount = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { count: todayTotal, error } = await supabase
        .from("patient_queues")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", todayStart.toISOString());

      if (error) {
        console.error("Error fetching today's count:", error);
        return;
      }

      setTodayCount(todayTotal || 0);
    } catch (error) {
      console.error("Error fetching today's count:", error);
    }
  };

  // ========== FETCH QUEUE PAUSE STATUS ==========
  const fetchQueuePauseStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "queue_paused")
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          await supabase
            .from("system_settings")
            .insert([{ key: "queue_paused", value: "false" }]);
          setQueuePaused(false);
        }
        return;
      }

      setQueuePaused(data?.value === "true");
    } catch (error) {
      console.error("Error fetching queue pause status:", error);
    }
  };

  const fetchQueueSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("queue_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (!error && data) {
        setQueueSettings(data);
        setDailyCap(data.max_queue_length || 80);
      }
    } catch (error) {
      console.error("Error fetching queue settings:", error);
    }
  };

  const fetchStaffCounts = async () => {
    try {
      const { data: staffData } = await supabase
        .from("staff")
        .select("user_id, is_active");
      
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (staffData) {
        const active = staffData.filter(s => s.is_active === true).length;
        const pending = staffData.filter(s => s.is_active === false).length;
        setActiveStaffCount(active);
        setPendingStaffCount(pending);
      }

      if (rolesData) {
        const admin = rolesData.filter(r => r.role === "admin").length;
        const staff = rolesData.filter(r => r.role === "staff").length;
        setAdminCount(admin);
        setStaffCount(staff);
      }
    } catch (error) {
      console.error("Error fetching staff counts:", error);
    }
  };

  const fetchClinicSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("queue_settings")
        .select("id, clinic_phone, clinic_email, clinic_address, clinic_name, max_queue_length, estimated_service_time_minutes")
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newSettings, error: insertError } = await supabase
            .from("queue_settings")
            .insert({
              clinic_name: "Samuel P. Dizon Medical Clinic",
              clinic_phone: "",
              clinic_email: "",
              clinic_address: "",
              max_queue_length: 50,
              estimated_service_time_minutes: 15,
            })
            .select()
            .single();
          
          if (!insertError && newSettings) {
            setSettingsRowId(newSettings.id);
            setClinicSettings({
              phone: newSettings.clinic_phone || "",
              email: newSettings.clinic_email || "",
              address: newSettings.clinic_address || "",
              clinic_name: newSettings.clinic_name || "",
            });
          }
        } else {
          console.error("Error fetching clinic settings:", error);
        }
        return;
      }
      
      if (data) {
        setSettingsRowId(data.id);
        setClinicSettings({
          phone: data.clinic_phone || "",
          email: data.clinic_email || "",
          address: data.clinic_address || "",
          clinic_name: data.clinic_name || "",
        });
        setDailyCap(data.max_queue_length || 80);
        setQueueSettings(data);
      }
    } catch (error) {
      console.error("Error fetching clinic settings:", error);
    }
  };

  const saveClinicSettings = async () => {
    if (!settingsRowId) {
      showToast("Error", "No settings record found", "error");
      return;
    }
    setSettingsSaving(true);
    try {
      const { error } = await supabase
        .from("queue_settings")
        .update({
          clinic_phone: clinicSettings.phone,
          clinic_email: clinicSettings.email,
          clinic_address: clinicSettings.address,
          clinic_name: clinicSettings.clinic_name,
        })
        .eq("id", settingsRowId);
      
      if (error) throw error;
      
      showToast("Settings Saved", "Clinic contact information has been successfully updated.", "success");
    } catch (error: any) {
      showToast("Error", error.message || "Failed to update settings.", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleChangePassword = async () => {
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
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });
      if (signInError) {
        showToast("Authentication Error", "Current password is incorrect.", "error");
        setPasswordSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      showToast("Security Updated", "Your password has been changed successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      showToast("Error", error.message, "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const { data: queueData, error } = await supabase
        .from("patient_queues")
        .select("status");
      
      if (error) throw error;
      
      const total = queueData?.length || 0;
      const waiting = queueData?.filter(q => q.status === "waiting").length || 0;
      const serving = queueData?.filter(q => q.status === "serving").length || 0;
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: completedCount } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact', head: true })
        .gte("visit_date", todayStart.toISOString());
      
      setQueueStats({
        total,
        waiting,
        serving,
        completed: completedCount || 0
      });
    } catch (error) {
      console.error("Error fetching queue status:", error);
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
        fetchTotalPatients(),
        fetchQueuePauseStatus(),
        fetchTodayCount(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTotalPatients = async () => {
    try {
      const { count } = await supabase
        .from("user_profiles")
        .select("*", { count: 'exact', head: true });
      
      setTotalPatients(count || 0);
    } catch (error) {
      console.error("Error fetching total patients:", error);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (reportPeriod) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yearly":
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    }
    
    return { startDate, endDate: now };
  };

  const fetchKPIData = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      const { count: totalServed } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact', head: true })
        .gte("visit_date", startStr)
        .lte("visit_date", endStr);

      const { data: queueData } = await supabase
        .from("patient_queues")
        .select("status");

      const waiting = queueData?.filter(q => q.status === "waiting").length || 0;
      
      const { data: historyData } = await supabase
        .from("medical_history")
        .select("created_at, visit_date")
        .gte("visit_date", startStr)
        .lte("visit_date", endStr)
        .limit(50);

      let avgWaitTime = 0;
      if (historyData && historyData.length > 0) {
        const totalMinutes = historyData.reduce((acc, record) => {
          if (record.created_at && record.visit_date) {
            const diff = new Date(record.visit_date).getTime() - new Date(record.created_at).getTime();
            return acc + Math.max(0, diff / 60000);
          }
          return acc;
        }, 0);
        avgWaitTime = Math.round(totalMinutes / historyData.length);
      }

      const totalToday = (totalServed || 0) + waiting;

      let prevStartDate = new Date(startDate);
      let prevEndDate = new Date(endDate);
      const diffTime = endDate.getTime() - startDate.getTime();
      prevStartDate.setTime(prevStartDate.getTime() - diffTime);
      prevEndDate.setTime(prevEndDate.getTime() - diffTime);

      const { count: prevServed } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact', head: true })
        .gte("visit_date", prevStartDate.toISOString())
        .lte("visit_date", prevEndDate.toISOString());

      const prevTotal = prevServed || 0;
      const trendChange = prevTotal > 0 ? Math.round(((totalToday - prevTotal) / prevTotal) * 100) : 0;

      const getPeriodLabel = () => {
        switch (reportPeriod) {
          case "today": return "Today";
          case "weekly": return "This Week";
          case "monthly": return "This Month";
          case "yearly": return "This Year";
          default: return "This Week";
        }
      };

      setKpiData([
        {
          label: `Total Patients (${getPeriodLabel()})`,
          value: totalToday.toString(),
          change: `${trendChange >= 0 ? '+' : ''}${trendChange}%`,
          up: trendChange >= 0,
          icon: Users,
          color: "text-blue-600 bg-blue-50",
          bgColor: "bg-blue-50",
        },
        {
          label: "Avg Wait Time",
          value: `${avgWaitTime || 0} min`,
          change: avgWaitTime > 0 ? "-12%" : "0%",
          up: true,
          icon: Clock,
          color: "text-green-600 bg-green-50",
          bgColor: "bg-green-50",
          note: "vs. last period",
        },
        {
          label: "Queue Completion",
          value: totalToday > 0 ? Math.round((totalServed || 0) / totalToday * 100) + "%" : "0%",
          change: totalToday > 0 ? "+5%" : "0%",
          up: true,
          icon: CheckCircle,
          color: "text-emerald-600 bg-emerald-50",
          bgColor: "bg-emerald-50",
        },
        {
          label: "Currently Waiting",
          value: waiting.toString(),
          change: waiting > 0 ? `+${waiting}` : "0",
          up: waiting > 0,
          icon: AlertTriangle,
          color: "text-amber-600 bg-amber-50",
          bgColor: "bg-amber-50",
        },
      ]);
    } catch (error) {
      console.error("Error fetching KPI data:", error);
    }
  };

  const fetchDailyVolume = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      const { data } = await supabase
        .from("medical_history")
        .select("visit_date")
        .gte("visit_date", startDate.toISOString())
        .lte("visit_date", endDate.toISOString());

      const dayCounts: Record<string, number> = {};
      
      data?.forEach(item => {
        if (item.visit_date) {
          const date = new Date(item.visit_date);
          const dateStr = date.toISOString().split('T')[0];
          dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        }
      });

      const today = new Date();
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? 6 : currentDay - 1;
      
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - mondayOffset + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const dayName = dayNames[i];
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = date.getDate();
        
        weekDays.push({
          day: `${dayName}`,
          fullLabel: `${dayName} ${month} ${day}`,
          patients: dayCounts[dateStr] || 0,
          date: dateStr,
          isToday: i === currentDay - 1 || (i === 6 && currentDay === 0)
        });
      }

      setDailyVolume(weekDays);
    } catch (error) {
      console.error("Error fetching daily volume:", error);
      setDailyVolume([]);
    }
  };

  const fetchServiceDistribution = async () => {
    try {
      const { startDate, endDate } = getDateRange();

      const { data } = await supabase
        .from("medical_history")
        .select("service_id")
        .not("service_id", "is", null)
        .gte("visit_date", startDate.toISOString())
        .lte("visit_date", endDate.toISOString());

      const { data: allServices } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true);

      const serviceNames: Record<string, string> = {};
      if (allServices) {
        allServices.forEach(s => {
          serviceNames[s.id] = s.name;
        });
      }

      const serviceCount: Record<string, number> = {};
      data?.forEach(item => {
        if (item.service_id) {
          const name = serviceNames[item.service_id] || "Unknown";
          serviceCount[name] = (serviceCount[name] || 0) + 1;
        }
      });

      const total = Object.values(serviceCount).reduce((a, b) => a + b, 0);
      const distribution = Object.entries(serviceCount).map(([name, value], index) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        value: Math.round((value / total) * 100),
        color: COLORS[index % COLORS.length],
      }));

      setServiceDistribution(distribution.slice(0, 6));
    } catch (error) {
      console.error("Error fetching service distribution:", error);
    }
  };

  const fetchHourlyDistribution = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      const { data } = await supabase
        .from("patient_queues")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const hours = Array.from({ length: 12 }, (_, i) => {
        const hour = 8 + i;
        return {
          time: `${hour}:00`,
          patients: 0,
        };
      });

      data?.forEach(item => {
        if (item.created_at) {
          const hour = new Date(item.created_at).getHours();
          if (hour >= 8 && hour <= 19) {
            const index = hour - 8;
            if (hours[index]) {
              hours[index].patients += 1;
            }
          }
        }
      });

      const filteredHours = hours.filter(h => h.patients > 0);
      setHourlyDistribution(filteredHours.length > 0 ? filteredHours : hours);
    } catch (error) {
      console.error("Error fetching hourly distribution:", error);
    }
  };

  const fetchWaitTimeTrend = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      const { data } = await supabase
        .from("medical_history")
        .select("visit_date, created_at")
        .gte("visit_date", startDate.toISOString())
        .lte("visit_date", endDate.toISOString());

      const dayData: Record<string, { total: number; count: number }> = {};
      
      data?.forEach(record => {
        if (record.visit_date && record.created_at) {
          const dateStr = record.visit_date.split('T')[0];
          if (!dayData[dateStr]) {
            dayData[dateStr] = { total: 0, count: 0 };
          }
          const diff = new Date(record.visit_date).getTime() - new Date(record.created_at).getTime();
          const minutes = Math.max(0, diff / 60000);
          dayData[dateStr].total += minutes;
          dayData[dateStr].count += 1;
        }
      });

      const today = new Date();
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? 6 : currentDay - 1;
      
      const trendData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - mondayOffset + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const dayName = dayNames[i];
        
        const dayInfo = dayData[dateStr];
        const avgWait = dayInfo ? Math.round(dayInfo.total / dayInfo.count) : 0;
        
        trendData.push({
          day: dayName,
          waitTime: avgWait || 0,
          fullDate: dateStr,
          count: dayInfo?.count || 0
        });
      }

      setWaitTimeTrend(trendData);
    } catch (error) {
      console.error("Error fetching wait time trend:", error);
    }
  };

  // ========== FETCH STAFF ACCOUNTS WITH LAST LOGIN - SIMPLIFIED ==========
  const fetchStaffAccounts = async () => {
    try {
      // Fetch staff users from your admin API - this now includes lastSignIn from user_sessions
      const { users } = await getStaffList();
      setStaffAccounts(users);
    } catch (err) {
      console.error("Failed to fetch staff accounts:", err);
      setStaffAccounts([]);
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

  // ========== DELETE STAFF ACCOUNT - COMPLETELY DELETES ==========
  const handleDeleteStaff = (staff: StaffUser) => {
    setConfirmAction({
      isOpen: true,
      title: "Delete Staff Account",
      description: `Are you sure you want to permanently DELETE the account for ${staff.firstName} ${staff.lastName}? This action CANNOT be undone. All data associated with this account will be removed.`,
      isDestructive: true,
      buttonText: "Delete Account",
      action: async () => {
        try {
          // Show a toast to indicate deletion is in progress
          showToast("Deleting", `Deleting account for ${staff.firstName} ${staff.lastName}...`, "info");

          console.log(`🗑️ Deleting staff account: ${staff.firstName} ${staff.lastName} (${staff.id})`);

          // Step 1: Delete from staff table
          const { error: staffError } = await supabase
            .from("staff")
            .delete()
            .eq("user_id", staff.id);
          
          if (staffError) {
            console.error("❌ Staff delete error:", staffError);
            // Continue - try to delete other records even if staff fails
          } else {
            console.log("✅ Staff record deleted");
          }

          // Step 2: Delete from user_roles table
          const { error: rolesError } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", staff.id);
          
          if (rolesError) {
            console.error("❌ Roles delete error:", rolesError);
          } else {
            console.log("✅ User roles deleted");
          }

          // Step 3: Delete from user_profiles table
          const { error: profileError } = await supabase
            .from("user_profiles")
            .delete()
            .eq("user_id", staff.id);
          
          if (profileError) {
            console.error("❌ Profile delete error:", profileError);
          } else {
            console.log("✅ User profile deleted");
          }

          // Step 4: Delete from notifications table
          const { error: notifError } = await supabase
            .from("notifications")
            .delete()
            .eq("user_id", staff.id);
          
          if (notifError) {
            console.error("❌ Notifications delete error:", notifError);
          } else {
            console.log("✅ Notifications deleted");
          }

          // Step 5: Delete from patient_queues table (if any)
          const { error: queueError } = await supabase
            .from("patient_queues")
            .delete()
            .eq("patient_id", staff.id);
          
          if (queueError) {
            console.error("❌ Queue delete error:", queueError);
          } else {
            console.log("✅ Patient queues deleted");
          }

          // Step 6: Delete from medical_history table (if any)
          const { error: historyError } = await supabase
            .from("medical_history")
            .delete()
            .eq("patient_id", staff.id);
          
          if (historyError) {
            console.error("❌ Medical history delete error:", historyError);
          } else {
            console.log("✅ Medical history deleted");
          }

          // Step 7: Delete the auth user using admin API with service role
          // Using supabaseAdmin which has the service role key
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(staff.id);
          
          if (authError) {
            console.error("❌ Auth delete error:", authError);
            // If auth user not found, it might already be deleted
            if (authError.message?.includes('not found') || authError.status === 404) {
              console.log("ℹ️ Auth user already deleted or not found");
            } else {
              throw new Error(`Failed to delete auth user: ${authError.message}`);
            }
          } else {
            console.log("✅ Auth user deleted");
          }

          showToast("Account Deleted", `${staff.firstName} ${staff.lastName} has been permanently deleted.`, "success");
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
          
          // Refresh the staff list
          await fetchStaffAccounts();
          await fetchStaffCounts();
          
        } catch (error: any) {
          console.error("❌ Error deleting staff:", error);
          showToast("Error", error.message || "Failed to delete staff member. Please try again.", "error");
        }
      }
    });
  };

  const fetchSystemLogs = async () => {
    try {
      const { data } = await supabase
        .from("patient_queues")
        .select("created_at, status, queue_number")
        .order("created_at", { ascending: false })
        .limit(10);

      const logs = (data || []).map(item => ({
        time: new Date(item.created_at).toLocaleTimeString(),
        action: `Queue #${item.queue_number} ${item.status === 'waiting' ? 'added' : item.status === 'serving' ? 'called' : 'completed'}`,
        type: item.status === 'serving' ? 'success' : item.status === 'waiting' ? 'info' : 'warning',
      }));

      setSystemLogs(logs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      setSystemLogs([]);
    }
  };

  // ========== QUEUE OPERATIONS ==========

  const toggleQueuePause = async () => {
    if (isUpdatingQueue) return;
    
    setIsUpdatingQueue(true);
    try {
      const newState = !queuePaused;
      
      const { error } = await supabase
        .from("system_settings")
        .update({ value: String(newState) })
        .eq("key", "queue_paused");

      if (error) throw error;

      setQueuePaused(newState);
      
      const { data: waitingPatients } = await supabase
        .from("patient_queues")
        .select("patient_id")
        .in("status", ["waiting", "serving"]);

      if (waitingPatients && waitingPatients.length > 0) {
        const notifications = waitingPatients.map(p => ({
          user_id: p.patient_id,
          type: newState ? "queue_paused" : "queue_resumed",
          title: newState ? "Queue Paused" : "Queue Resumed",
          message: newState 
            ? "The clinic queue has been temporarily paused. Please wait for updates." 
            : "The clinic queue has resumed. You will be called shortly.",
          is_read: false,
          created_at: new Date().toISOString(),
        }));

        for (let i = 0; i < notifications.length; i += 10) {
          const batch = notifications.slice(i, i + 10);
          await supabase.from("notifications").insert(batch);
        }
      }

      showToast(
        "Success",
        newState ? "Queue paused. Patients have been notified." : "Queue resumed. Patients can now join.",
        "success"
      );
    } catch (error: any) {
      console.error("Error toggling queue pause:", error);
      showToast("Error", error.message || "Failed to toggle queue status", "error");
    } finally {
      setIsUpdatingQueue(false);
    }
  };

  const handleResetQueue = async () => {
    setConfirmAction({
      isOpen: true,
      title: "Reset Queue",
      description: "Are you sure you want to reset the queue? This will remove all waiting patients. Patients will be notified that the queue has been reset.",
      isDestructive: true,
      buttonText: "Reset Queue",
      action: async () => {
        try {
          const { data: waitingPatients } = await supabase
            .from("patient_queues")
            .select("patient_id, queue_number")
            .eq("status", "waiting");

          const { error } = await supabase
            .from("patient_queues")
            .delete()
            .eq("status", "waiting");
          
          if (error) throw error;

          if (waitingPatients && waitingPatients.length > 0) {
            const notifications = waitingPatients.map(p => ({
              user_id: p.patient_id,
              type: "queue_reset",
              title: "Queue Reset",
              message: `The clinic queue has been reset. Your token #${String(p.queue_number).padStart(3, '0')} has been removed. Please rejoin if needed.`,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            for (let i = 0; i < notifications.length; i += 10) {
              const batch = notifications.slice(i, i + 10);
              await supabase.from("notifications").insert(batch);
            }
          }
          
          showToast("Success", `Queue has been reset. ${waitingPatients?.length || 0} patients notified.`, "success");
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
          fetchQueueStatus();
          fetchKPIData();
          fetchTodayCount();
        } catch (error: any) {
          showToast("Error", error.message || "Failed to reset queue", "error");
        }
      }
    });
  };

  const handleSaveDailyCap = async () => {
    if (isUpdatingQueue) return;
    
    setIsUpdatingQueue(true);
    try {
      const { error } = await supabase
        .from("queue_settings")
        .update({ max_queue_length: dailyCap })
        .eq("id", settingsRowId);
      
      if (error) throw error;
      
      setQueueSettings((prev: any) => ({ ...prev, max_queue_length: dailyCap }));
      showToast("Success", `Daily cap updated to ${dailyCap} patients`, "success");
    } catch (error: any) {
      showToast("Error", error.message || "Failed to update daily cap", "error");
    } finally {
      setIsUpdatingQueue(false);
    }
  };

  const handleSaveServiceTime = async (minutes: number) => {
    if (isUpdatingQueue) return;
    
    setIsUpdatingQueue(true);
    try {
      const { error } = await supabase
        .from("queue_settings")
        .update({ estimated_service_time_minutes: minutes })
        .eq("id", settingsRowId);
      
      if (error) throw error;
      
      setQueueSettings((prev: any) => ({ ...prev, estimated_service_time_minutes: minutes }));
      showToast("Success", `Service time updated to ${minutes} minutes`, "success");
    } catch (error: any) {
      showToast("Error", error.message || "Failed to update service time", "error");
    } finally {
      setIsUpdatingQueue(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    await fetchQueueStatus();
    await fetchStaffCounts();
    await fetchQueuePauseStatus();
    await fetchTodayCount();
    showToast("Refreshed", "Dashboard data has been updated.", "success");
  };

  // ========== FORMAT LAST LOGIN - FIXED ==========
  const formatLastLogin = (lastSignIn: string | null | undefined) => {
    if (!lastSignIn) return "Never";
    
    try {
      // Handle different date formats
      let date: Date;
      if (typeof lastSignIn === 'string') {
        date = new Date(lastSignIn);
      } else {
        return "Never";
      }
      
      if (isNaN(date.getTime())) return "Never";
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Never";
    }
  };

  const tabs = [
    { id: "analytics" as AdminTab, label: "Analytics & Reports", icon: BarChart3 },
    { id: "accounts" as AdminTab, label: "Account Management", icon: Shield },
    { id: "queue-controls" as AdminTab, label: "Daily Queue Controls", icon: Settings },
    { id: "settings" as AdminTab, label: "Settings", icon: Building2 },
  ];

  if (loading && activeTab === "analytics") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-100 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                navigate(`/admin/${tab.id === "analytics" ? "dashboard" : tab.id}`);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="font-bold text-gray-900">Analytics & Reports</h1>
              <p className="text-sm text-gray-500 mt-1">Key performance metrics and service distribution overview.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm appearance-none cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="yearly">This Year</option>
              </select>
              <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-2xl shadow-sm text-sm transition-all disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm hover:shadow-lg transition-all">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiData.map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className={`text-xs font-semibold ${card.up ? "text-green-600" : "text-red-600"}`}>{card.change}</span>
                    {card.note && <span className="text-xs text-gray-400">{card.note}</span>}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">{totalPatients}</p>
                <p className="text-xs text-gray-500">Total Patients</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">{activeStaffCount}</p>
                <p className="text-xs text-gray-500">Active Staff</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <UserX className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">{pendingStaffCount}</p>
                <p className="text-xs text-gray-500">Pending Staff</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-gray-900">{staffAccounts.length}</p>
                <p className="text-xs text-gray-500">Total Staff</p>
              </div>
            </div>
          </div>

          {/* Daily Volume Chart */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Patient Volume</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {reportPeriod === "today" ? "Today" : reportPeriod === "weekly" ? "This Week" : reportPeriod === "monthly" ? "Last 30 days" : "Last 12 months"}
                </p>
              </div>
            </div>
            {dailyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name, props) => {
                    const entry = props.payload;
                    return [`${value} patients`, entry.fullLabel || entry.day];
                  }} />
                  <Bar dataKey="patients" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <BarChart3 className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-gray-900 font-bold mb-1">No patient visits recorded</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Patient volume will appear here once patients start visiting.
                </p>
              </div>
            )}
          </div>

          {/* Service Distribution & Hourly Distribution */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900">Service Distribution</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Service breakdown</p>
                </div>
              </div>
              {serviceDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={serviceDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
                    <Activity className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold mb-1">No services recorded</h4>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Service distribution will appear here once patients complete visits.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900">Hourly Distribution</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Patient traffic by hour</p>
                </div>
              </div>
              {hourlyDistribution.some(d => d.patients > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="patients" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <Clock className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold mb-1">No hourly data</h4>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Hourly distribution will appear here as patients check in.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Wait Time Trend */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Wait Time Trend</h3>
                <p className="text-xs text-gray-400 mt-0.5">Average wait time (minutes)</p>
              </div>
            </div>
            {waitTimeTrend.some(d => d.waitTime > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={waitTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="waitTime" stroke="#16a34a" fill="#86efac" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <TrendingUp className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-gray-900 font-bold mb-1">No wait time data</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Wait time trends will appear here once patients are served.
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
            <p className="text-sm text-gray-500 mt-1">Manage staff and admin credentials and access privileges.</p>
          </div>
          
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500">{staffAccounts.length} total accounts</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Active: {activeStaffCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending: {pendingStaffCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Admin: {adminCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Staff: {staffCount}</span>
              </div>
            </div>
            <button onClick={() => setIsInviteModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm hover:shadow-lg transition-all">
              <UserPlus className="w-4 h-4" />
              Add Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffAccounts.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                  <Shield className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-gray-900 font-bold mb-2 text-lg">No accounts found</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Get started by adding staff or admin accounts to manage the clinic operations.
                </p>
              </div>
            ) : (
              staffAccounts.map((staff) => (
                <div key={staff.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col relative group">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm ${staff.role === "admin" ? "bg-purple-500" : "bg-blue-500"}`}>
                        {staff.firstName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 leading-tight truncate">{staff.firstName} {staff.lastName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate" title={staff.email}>{staff.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
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
                        {formatLastLogin(staff.lastSignIn)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-auto pt-4 border-t border-gray-50">
                    {staff.status === "active" && (
                      <button 
                        onClick={() => handleDeleteStaff(staff)}
                        className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors text-xs font-bold flex items-center gap-1.5"
                        title="Permanently Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Delete</span>
                      </button>
                    )}

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

          <div className={`rounded-3xl p-6 border transition-all ${
            queuePaused 
              ? "bg-amber-50 border-amber-200" 
              : queueStats.waiting > 0 || queueStats.serving > 0 
                ? "bg-green-50 border-green-200" 
                : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold text-lg ${
                  queuePaused 
                    ? "text-amber-800" 
                    : queueStats.waiting > 0 || queueStats.serving > 0 
                      ? "text-green-800" 
                      : "text-gray-600"
                }`}>
                  Queue System: {queuePaused ? "PAUSED" : queueStats.waiting > 0 || queueStats.serving > 0 ? "ACTIVE" : "IDLE"}
                </p>
                <p className={`text-sm mt-0.5 ${
                  queuePaused 
                    ? "text-amber-600" 
                    : queueStats.waiting > 0 || queueStats.serving > 0 
                      ? "text-green-600" 
                      : "text-gray-500"
                }`}>
                  {queuePaused 
                    ? "Queue is paused. Patients cannot be called." 
                    : queueStats.waiting > 0 || queueStats.serving > 0 
                      ? "Queue is active and processing patients" 
                      : "Queue is idle. No patients waiting."}
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-gray-600">Waiting: <strong>{queueStats.waiting}</strong></span>
                  <span className="text-gray-600">Serving: <strong>{queueStats.serving}</strong></span>
                  <span className="text-gray-600">Completed Today: <strong>{queueStats.completed}</strong></span>
                  <span className="text-gray-600">Total: <strong>{queueStats.total}</strong></span>
                  <span className="text-gray-600">Today's Patients: <strong>{todayCount} / {dailyCap}</strong></span>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full ${(
                queuePaused 
                  ? "bg-amber-500 animate-pulse" 
                  : queueStats.waiting > 0 || queueStats.serving > 0 
                    ? "bg-green-500 animate-pulse" 
                    : "bg-gray-400"
              )}`} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-5">Queue Operations</h3>
              <div className="space-y-3">
                <button
                  onClick={toggleQueuePause}
                  disabled={isUpdatingQueue}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-colors ${
                    queuePaused
                      ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isUpdatingQueue ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : queuePaused ? (
                    <PlayCircle className="w-5 h-5" />
                  ) : (
                    <PauseCircle className="w-5 h-5" />
                  )}
                  {queuePaused ? "Resume Queue" : "Pause Queue"}
                </button>
                <button
                  onClick={handleResetQueue}
                  disabled={isUpdatingQueue}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-red-50 text-red-700 border border-red-200 rounded-2xl font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reset Queue (Remove All Waiting)
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl font-semibold text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
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
                      min="1"
                      max="999"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <span className="text-sm text-gray-500">patients/day</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={`font-semibold ${todayCount >= dailyCap ? 'text-red-600' : 'text-green-600'}`}>
                      {todayCount} / {dailyCap}
                    </span>
                    <span className="text-gray-400">patients today</span>
                    {todayCount >= dailyCap && (
                      <span className="text-red-500 text-xs font-bold">(FULL)</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estimated Service Time</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={queueSettings?.estimated_service_time_minutes || 15}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0 && val <= 120) {
                          handleSaveServiceTime(val);
                        }
                      }}
                      min="1"
                      max="120"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-2xl">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span>Current Settings: <strong>{dailyCap}</strong> patients/day, <strong>{queueSettings?.estimated_service_time_minutes || 15}</strong> min per patient</span>
                </div>

                <button
                  onClick={handleSaveDailyCap}
                  disabled={isUpdatingQueue}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingQueue ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    "Save Settings"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">System Activity Log</h3>
              <span className="text-xs text-gray-400">Last 10 events</span>
            </div>
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
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${log.type === "success" ? "bg-green-500" : log.type === "warning" ? "bg-amber-500" : "bg-blue-400"}`} />
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
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clinic Name</label>
                    <input
                      type="text"
                      value={clinicSettings.clinic_name}
                      onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_name: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                    />
                  </div>
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
                <button onClick={saveClinicSettings} disabled={settingsSaving} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-sm text-sm hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98]">
                  {settingsSaving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                  ) : "Save Details"}
                </button>
              </div>
            </div>

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
                <button onClick={handleChangePassword} disabled={passwordSaving} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl shadow-sm text-sm hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98]">
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
      <InviteStaffModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} onSuccess={fetchStaffAccounts} />
      <EditStaffModal isOpen={editModalStaff !== null} onClose={() => setEditModalStaff(null)} onSuccess={fetchStaffAccounts} staff={editModalStaff} />
      <PasswordConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmAction.action}
        actionTitle={confirmAction.title}
        actionDescription={confirmAction.description}
        confirmButtonText={confirmAction.buttonText}
        isDestructive={confirmAction.isDestructive}
      />
    </div>
  );
}
