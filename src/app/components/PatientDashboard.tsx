import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  ChevronRight,
  Plus,
  FileText,
  Calendar,
  Activity,
  Stethoscope,
  User,
  ClipboardList,
  Pill,
  Store,
  Bell,
  BellRing,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  X,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useNetworkStatus } from "../../components/useNetworkStatus";
import { useToast } from "../../contexts/ToastContext";

// Helper function to get service name from notes JSON
const extractServiceFromNotes = (notes: string | null): string => {
  if (!notes) return "Consultation";
  
  try {
    const parsed = JSON.parse(notes);
    if (parsed.service) {
      return parsed.service;
    }
  } catch (e) {
    const SERVICES = [
      "General Consultation", "Physical Check-up", "Pediatrics",
      "Vaccination / Immunization", "Eye Consultation", "Prescription Renewal"
    ];
    for (const service of SERVICES) {
      if (notes.includes(service)) {
        return service;
      }
    }
  }
  return "Consultation";
};

// Helper function to extract complaint from notes JSON
const extractComplaintFromNotes = (notes: string | null): string => {
  if (!notes) return "No complaint recorded";
  
  try {
    const parsed = JSON.parse(notes);
    if (parsed.complaint) {
      return parsed.complaint;
    }
  } catch (e) {
    if (notes.includes("Chief complaint:")) {
      const match = notes.match(/Chief complaint:\s*([^\n]*)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    if (notes.includes("Complaint:")) {
      const match = notes.match(/Complaint:\s*([^\n]*)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return notes;
  }
  return "No complaint recorded";
};

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wasOffline } = useNetworkStatus();
  const { showToast } = useToast();
  const [activeQueue, setActiveQueue] = useState<any>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalVisits: 0 });
  const [services, setServices] = useState<Record<string, string>>({});
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [viewAllVisits, setViewAllVisits] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("waiting");
  const [currentService, setCurrentService] = useState<string>("Consultation");
  const subscriptionRef = useRef<any>(null);
  const initialLoadDone = useRef(false);
  const [estimatedServiceTime, setEstimatedServiceTime] = useState(15);
  const [dailyCap, setDailyCap] = useState(80);
  const [todayCount, setTodayCount] = useState(0);

  // Clinic status states
  const [clinicStatus, setClinicStatus] = useState<{
    isOpen: boolean;
    isPaused: boolean;
    statusMessage: string;
    statusColor: string;
    statusIcon: React.ReactNode;
  }>({
    isOpen: true,
    isPaused: false,
    statusMessage: "Open",
    statusColor: "text-green-600 bg-green-50",
    statusIcon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
  });

  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // ========== Notification Detail View ==========
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);

  // ========== Called notification banner ==========
  const [showCalledToast, setShowCalledToast] = useState(false);
  const [calledMessage, setCalledMessage] = useState("");

  // ========== Delete All Confirmation Modal ==========
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // ========== FETCH CONFIGURATION ==========
  const fetchConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from("queue_settings")
        .select("estimated_service_time_minutes, max_queue_length")
        .limit(1)
        .single();
      
      if (!error && data) {
        setEstimatedServiceTime(data.estimated_service_time_minutes || 15);
        setDailyCap(data.max_queue_length || 80);
      }
    } catch (error) {
      console.error("Error fetching configuration:", error);
    }
  };

  // ========== FETCH TODAY'S COUNT ==========
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

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name");
      if (error) throw error;
      const serviceMap: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        serviceMap[s.id] = s.name;
      });
      setServices(serviceMap);
      return serviceMap;
    } catch (error) {
      console.error("Error fetching services:", error);
      return {};
    }
  };

  // Fetch clinic status
  const fetchClinicStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "queue_paused")
        .maybeSingle();

      if (error) {
        console.warn("Clinic status not found, defaulting to open");
        setClinicStatus({
          isOpen: true,
          isPaused: false,
          statusMessage: "Open",
          statusColor: "text-green-600 bg-green-50",
          statusIcon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
        });
        return;
      }

      const isPaused = data?.value === "true";
      updateClinicStatus(isPaused);
    } catch (error) {
      console.error("Error fetching clinic status:", error);
    }
  };

  // Update clinic status UI
  const updateClinicStatus = (isPaused: boolean) => {
    if (isPaused) {
      setClinicStatus({
        isOpen: true,
        isPaused: true,
        statusMessage: "Paused",
        statusColor: "text-amber-600 bg-amber-50",
        statusIcon: <PauseCircle className="w-5 h-5 text-amber-600" />,
      });
    } else {
      setClinicStatus({
        isOpen: true,
        isPaused: false,
        statusMessage: "Open",
        statusColor: "text-green-600 bg-green-50",
        statusIcon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      });
    }
  };

  // Subscribe to clinic status changes
  useEffect(() => {
    fetchClinicStatus();

    const channel = supabase
      .channel('clinic-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: "key=eq.queue_paused",
        },
        (payload) => {
          const isPaused = payload.new?.value === "true";
          updateClinicStatus(isPaused);
          
          if (isPaused) {
            showToast("The clinic queue has been paused. Please wait for updates.", "warning");
          } else {
            showToast("The clinic queue has resumed. You will be called shortly.", "success");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ========== REFRESH NOTIFICATIONS FUNCTION ==========
  const refreshNotifications = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error refreshing notifications:", error);
        return;
      }
      
      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
      
      // Check if there's a "patient_called" notification that's unread
      const calledNotification = data?.find(n => n.type === "patient_called" && !n.is_read);
      if (calledNotification) {
        setCalledMessage(calledNotification.message);
        setShowCalledToast(true);
        setTimeout(() => setShowCalledToast(false), 10000);
      }
      
      console.log(`📬 Refreshed notifications: ${data?.length || 0} total, ${unread} unread`);
    } catch (error) {
      console.error("Error refreshing notifications:", error);
    }
  };

  // Fetch notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          console.error("Error fetching notifications:", error);
          return;
        }
        
        setNotifications(data || []);
        const unread = data?.filter(n => !n.is_read).length || 0;
        setUnreadCount(unread);
        
        const calledNotification = data?.find(n => n.type === "patient_called" && !n.is_read);
        if (calledNotification) {
          setCalledMessage(calledNotification.message);
          setShowCalledToast(true);
          setTimeout(() => setShowCalledToast(false), 10000);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          if (newNotif.type === "patient_called") {
            setCalledMessage(newNotif.message);
            setShowCalledToast(true);
            setTimeout(() => setShowCalledToast(false), 10000);
            showToast("🩺 " + newNotif.message, "success");
          } else if (newNotif.type === "no_show") {
            showToast("⚠️ " + newNotif.message, "warning");
          } else if (newNotif) {
            showToast(newNotif.message, "info");
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Delete a single notification
  const deleteNotification = async (id: string) => {
    if (isDeleting) return;
    
    setIsDeleting(id);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      
      const deletedNotification = notifications.find(n => n.id === id);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      showToast("Notification deleted", "success");
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      showToast(error.message || "Failed to delete notification", "error");
    } finally {
      setIsDeleting(null);
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    if (isDeletingAll) return;
    
    setIsDeletingAll(true);
    setShowDeleteAllModal(false);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user?.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);

      showToast("All notifications deleted", "success");
    } catch (error: any) {
      console.error("Error deleting all notifications:", error);
      showToast(error.message || "Failed to delete all notifications", "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  // ========== MARK NOTIFICATION AS READ ==========
  const markAsRead = async (id: string) => {
    try {
      console.log(`📖 Marking notification ${id} as read...`);
      
      const { error } = await supabase
        .from("notifications")
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq("id", id);

      if (error) {
        console.error("❌ Error marking notification as read:", error);
        return;
      }

      console.log(`✅ Notification ${id} marked as read successfully`);
      await refreshNotifications();
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user?.id)
        .eq("is_read", false);

      if (error) throw error;

      await refreshNotifications();
      showToast("All notifications marked as read", "success");
    } catch (error) {
      console.error("Error marking all as read:", error);
      showToast("Failed to mark all as read", "error");
    }
  };

  // ========== Handle notification click ==========
  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setSelectedNotification(notification);
    setShowNotificationDetail(true);
    setShowNotifications(false);
  };

  // ========== LOAD DATA ==========
  const loadData = useCallback(async (serviceMap?: Record<string, string>) => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const currentServiceMap = serviceMap || services;

      // Fetch queue data - using patient_queues
      const { data: queueData, error: queueError } = await supabase
        .from("patient_queues")
        .select("*")
        .eq("patient_id", user.id)
        .in("status", ["waiting", "serving"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queueError) {
        console.error("Error fetching queue:", queueError);
      }

      if (queueData) {
        const newStatus = queueData.status || 'waiting';
        const serviceName = extractServiceFromNotes(queueData.notes);
        setCurrentStatus(newStatus);
        setCurrentService(serviceName);
        queueData.service_display = serviceName;
        queueData.chief_complaint_display = extractComplaintFromNotes(queueData.notes);
        setActiveQueue(queueData);
      } else {
        setActiveQueue(null);
        setCurrentStatus("none");
        setCurrentService("Consultation");
      }

      // Fetch visits
      const { data: visitsData, error: visitsError } = await supabase
        .from("medical_history")
        .select("*")
        .eq("patient_id", user.id)
        .order("visit_date", { ascending: false });

      if (visitsError) {
        console.error("Error fetching visits:", visitsError);
      }

      if (!visitsError && visitsData) {
        // Get staff names from the staff table
        const staffIds = visitsData
          .map((visit: any) => visit.staff_id)
          .filter((id: string) => id);

        let staffNameMap: Record<string, string> = {};

        if (staffIds.length > 0) {
          // Get staff names from user_profiles using staff_id
          const { data: staffProfiles, error: staffProfilesError } = await supabase
            .from("user_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", staffIds);

          if (!staffProfilesError && staffProfiles) {
            staffProfiles.forEach((p: any) => {
              staffNameMap[p.user_id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "MediFlow Staff";
            });
          }
        }

        // Also check if we have staff_name directly in the medical_history record
        const enrichedVisits = await Promise.all(visitsData.map(async (visit: any) => {
          let serviceName = "Consultation";
          if (visit.service_id && currentServiceMap[visit.service_id]) {
            serviceName = currentServiceMap[visit.service_id];
          } else if (visit.service) {
            serviceName = visit.service;
          } else if (visit.diagnosis) {
            serviceName = visit.diagnosis;
          }
          
          // Get the staff name - priority order:
          // 1. staff_name field directly from the record
          // 2. staff_id from staffNameMap
          // 3. fallback
          let staffName = "MediFlow Staff";
          
          if (visit.staff_name) {
            staffName = visit.staff_name;
          } else if (visit.staff_id && staffNameMap[visit.staff_id]) {
            staffName = staffNameMap[visit.staff_id];
          } else if (visit.staff_id) {
            // Try to fetch the staff's name from user_profiles directly
            try {
              const { data: profileData } = await supabase
                .from("user_profiles")
                .select("first_name, last_name")
                .eq("user_id", visit.staff_id)
                .single();
              
              if (profileData) {
                staffName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim() || "MediFlow Staff";
              }
            } catch (profileError) {
              console.warn("Could not fetch staff profile for:", visit.staff_id);
            }
          }

          return {
            ...visit,
            service_name: serviceName,
            doctor_name: staffName,
            formatted_date: new Date(visit.visit_date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric"
            }),
            formatted_time: new Date(visit.visit_date).toLocaleTimeString("en-PH", {
              hour: '2-digit',
              minute: '2-digit'
            })
          };
        }));
        
        setRecentVisits(enrichedVisits);
      }

      // Get total visits count
      const { count: totalVisits, error: countError } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact', head: true })
        .eq("patient_id", user.id);

      if (countError) {
        console.error("Error counting visits:", countError);
      }

      setStats({ totalVisits: totalVisits || 0 });
      initialLoadDone.current = true;
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, services]);

  // Initial load
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchServices().then((serviceMap) => {
        loadData(serviceMap);
      });
      fetchConfiguration();
      fetchTodayCount();
    }
  }, [user]);

  // Reload when coming back online
  useEffect(() => {
    if (wasOffline && user) {
      fetchServices().then((serviceMap) => {
        loadData(serviceMap);
      });
      fetchConfiguration();
      fetchTodayCount();
    }
  }, [wasOffline]);

  // ========== REAL-TIME SUBSCRIPTION ==========
  useEffect(() => {
    if (!user?.id) return;

    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    const channel = supabase
      .channel(`patient-queue-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patient_queues', filter: `patient_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            const newStatus = payload.new.status;
            const newService = extractServiceFromNotes(payload.new.notes);
            setCurrentStatus(newStatus);
            setCurrentService(newService);
            setActiveQueue((prev: any) => ({
              ...prev,
              status: newStatus,
              service_display: newService,
              chief_complaint_display: extractComplaintFromNotes(payload.new.notes),
            }));
            
            if (newStatus === "serving") {
              showToast("🩺 You are being called! Please proceed to the consultation room.", "success");
              setCalledMessage("You are being called! Please proceed to the consultation room.");
              setShowCalledToast(true);
              setTimeout(() => setShowCalledToast(false), 15000);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'patient_queues', filter: `patient_id=eq.${user.id}` },
        () => {
          setActiveQueue(null);
          setCurrentStatus("none");
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user?.id]);

  const quickActions = [
    { icon: Plus, label: "Join Queue", desc: "Get a queue token", path: "/patient/queue/join", color: "bg-gradient-to-br from-green-500 to-emerald-600", textColor: "text-white" },
    { icon: Clock, label: "Live Queue", desc: "Watch real-time", path: "/patient/queue/monitor", color: "bg-gradient-to-br from-blue-50 to-indigo-50", textColor: "text-blue-700", border: "border border-blue-100" },
    { icon: Calendar, label: "Settings", desc: "Update profile", path: "/patient/settings", color: "bg-gradient-to-br from-purple-50 to-violet-50", textColor: "text-purple-700", border: "border border-purple-100" },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayedVisits = viewAllVisits ? recentVisits : recentVisits.slice(0, 3);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'waiting': return { label: 'Waiting', color: 'bg-white/20 text-white', dotColor: 'bg-white' };
      case 'serving': return { label: '🔔 Being Called!', color: 'bg-green-500/30 text-green-100', dotColor: 'bg-green-400' };
      case 'completed': return { label: 'Completed', color: 'bg-green-500/30 text-green-100', dotColor: 'bg-green-400' };
      default: return { label: status.charAt(0).toUpperCase() + status.slice(1), color: 'bg-white/20 text-white', dotColor: 'bg-white' };
    }
  };

  const getServiceDisplay = () => {
    if (activeQueue?.service_display) return activeQueue.service_display;
    return currentService || "Consultation";
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  );

  const statusInfo = getStatusDisplay(currentStatus);
  const displayServiceName = getServiceDisplay();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* ========== PROMINENT "YOU'RE BEING CALLED" BANNER - ONLY SHOWS ONCE ========== */}
      <AnimatePresence>
        {showCalledToast && currentStatus === "serving" && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl mx-4"
          >
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-6 shadow-2xl border-2 border-green-400">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                  <BellRing className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold text-white">🩺 You're Being Called!</h3>
                  <p className="text-white/90 text-base mt-1">{calledMessage || "Please proceed to the consultation room."}</p>
                </div>
                <button
                  onClick={() => setShowCalledToast(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => {
                    setShowCalledToast(false);
                    navigate("/patient/queue/monitor");
                  }}
                  className="flex-1 bg-white text-green-700 font-bold py-3 rounded-xl text-base hover:bg-green-50 transition-colors"
                >
                  Track Your Visit
                </button>
                <button
                  onClick={() => setShowCalledToast(false)}
                  className="flex-1 bg-white/20 text-white font-semibold py-3 rounded-xl text-base hover:bg-white/30 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {getGreeting()}, {user?.first_name}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </motion.div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
          >
            {unreadCount > 0 ? (
              <BellRing className="w-5 h-5 text-green-600" />
            ) : (
              <Bell className="w-5 h-5 text-gray-500" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 z-50"
              >
                <div className="p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900">Notifications</h4>
                      {notifications.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-green-600 font-semibold hover:text-green-700 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={() => setShowDeleteAllModal(true)}
                          disabled={isDeletingAll}
                          className="text-xs text-red-500 font-semibold hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isDeletingAll ? (
                            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete all
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const isCallNotification = notification.type === "patient_called";
                      const isNoShowNotification = notification.type === "no_show";
                      const isHighlighted = (isCallNotification || isNoShowNotification) && !notification.is_read;
                      
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 transition-colors group cursor-pointer ${
                            !notification.is_read ? 'bg-green-50/50' : ''
                          } ${isHighlighted ? 'border-l-4 border-green-500' : ''}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${isCallNotification ? 'text-green-600' : isNoShowNotification ? 'text-red-600' : 'text-gray-900'}`}>
                                {isCallNotification ? '🩺 ' : ''}
                                {isNoShowNotification ? '⚠️ ' : ''}
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-gray-400">
                                  {new Date(notification.created_at).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                                {!notification.is_read && (
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCallNotification ? 'bg-green-500 animate-pulse' : isNoShowNotification ? 'bg-red-500' : 'bg-green-500'}`} />
                                )}
                                {isCallNotification && !notification.is_read && (
                                  <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    Calling
                                  </span>
                                )}
                                {isNoShowNotification && !notification.is_read && (
                                  <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    No-Show
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              disabled={isDeleting === notification.id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            >
                              {isDeleting === notification.id ? (
                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stats Grid with Clinic Status Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5, delay: 0.1 }} 
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        {/* Total Visits */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <Stethoscope className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-extrabold text-gray-900">{stats.totalVisits}</p>
          <p className="text-xs text-gray-500">Total Visits</p>
        </div>

        {/* Queue Status */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{activeQueue ? "Active" : "None"}</p>
          <p className="text-xs text-gray-500">Queue Status</p>
          {currentStatus === "serving" && (
            <p className="text-sm text-green-600 font-bold mt-1 animate-pulse">🔔 Being Called!</p>
          )}
        </div>

        {/* Clinic Status */}
        <div className={`bg-white rounded-2xl p-4 border shadow-sm ${clinicStatus.isPaused ? 'border-amber-200' : 'border-green-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${clinicStatus.isPaused ? 'bg-amber-50' : 'bg-green-50'}`}>
            {clinicStatus.isPaused ? (
              <PauseCircle className="w-5 h-5 text-amber-600" />
            ) : (
              <Store className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold text-gray-900">
              {clinicStatus.isPaused ? "Paused" : "Open"}
            </p>
            <span className={`w-2 h-2 rounded-full ${clinicStatus.isPaused ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          </div>
          <p className="text-xs text-gray-500">Clinic Status</p>
          {clinicStatus.isPaused && (
            <p className="text-[10px] text-amber-600 mt-1 font-medium">
              Queue temporarily paused
            </p>
          )}
        </div>

        {/* Patient ID */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-xl font-extrabold text-gray-900">{user?.id?.slice(0, 8) || "N/A"}</p>
          <p className="text-xs text-gray-500">Patient ID</p>
        </div>
      </motion.div>

      {/* Queue Paused Banner */}
      <AnimatePresence>
        {clinicStatus.isPaused && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Queue is Temporarily Paused</p>
                <p className="text-sm text-amber-700">
                  The clinic has temporarily paused the queue. You will be notified when the queue resumes.
                  Please wait for your turn.
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200/50 rounded-full text-xs font-semibold text-amber-700">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Paused
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeQueue && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="mb-6">
          <div className={`rounded-3xl p-6 text-white shadow-xl relative overflow-hidden ${currentStatus === "serving" ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-2 border-green-400 shadow-lg shadow-green-500/30' : 'bg-gradient-to-r from-green-600 to-emerald-600'}`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full translate-y-8" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-200" />
                  <span className="text-base font-semibold text-green-100">
                    {currentStatus === "serving" ? "🔔 You're Being Called!" : "Active Queue Token"}
                  </span>
                </div>
                <span className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full ${statusInfo.color}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${statusInfo.dotColor}`} />
                  {currentStatus === "serving" ? "🔔 Called!" : statusInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-200 text-sm uppercase tracking-widest mb-1">Your Token</p>
                  <p className="text-7xl font-black leading-none">{String(activeQueue.queue_number).padStart(3, '0')}</p>
                  <p className="text-green-200 text-base mt-2 font-semibold">{displayServiceName}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-200 text-sm">Status</p>
                  <p className="text-4xl font-black mt-1 capitalize">
                    {currentStatus === "serving" ? "🔔 Called!" : statusInfo.label}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <button 
                  onClick={() => navigate("/patient/queue/monitor")} 
                  className="w-full bg-white text-green-700 font-bold py-3.5 rounded-2xl text-base hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={clinicStatus.isPaused}
                >
                  {clinicStatus.isPaused ? "Queue Paused - Please Wait" : currentStatus === "serving" ? "🔔 Track Your Visit" : "Track Live Queue"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => {
            const isDisabled = action.label === "Join Queue" && clinicStatus.isPaused;
            
            return (
              <motion.button 
                key={i} 
                whileHover={{ y: isDisabled ? 0 : -3 }} 
                whileTap={{ scale: isDisabled ? 1 : 0.97 }} 
                onClick={() => {
                  if (isDisabled) {
                    showToast("The clinic queue is currently paused. Please try again later.", "warning");
                    return;
                  }
                  navigate(action.path);
                }} 
                className={`${action.color} ${action.border || ""} ${action.textColor} rounded-3xl p-5 text-left shadow-sm hover:shadow-md transition-all ${
                  isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <action.icon className="w-7 h-7 mb-3" />
                <p className="font-bold text-sm">{action.label}</p>
                <p className={`text-xs mt-0.5 ${i === 0 ? "text-green-100" : "opacity-70"}`}>
                  {isDisabled ? "Currently Paused" : action.desc}
                </p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-1 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">
                  {viewAllVisits ? "All Visits" : "Recent Visits"}
                </h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">
                  {recentVisits.length}
                </span>
              </div>
              <button 
                onClick={() => setViewAllVisits(!viewAllVisits)} 
                className="text-xs text-green-600 font-semibold hover:text-green-700 flex items-center gap-1"
              >
                {viewAllVisits ? (
                  <>Show Less <ChevronRight className="w-3.5 h-3.5 rotate-90" /></>
                ) : (
                  <>View All <ChevronRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {displayedVisits.length > 0 ? (
                displayedVisits.map((visit, index) => (
                  <motion.div 
                    key={visit.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.05 }} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <div 
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                    >
                      <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Activity className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {visit.service_name}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            {visit.formatted_date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          <span className="truncate font-medium text-gray-700">{visit.doctor_name}</span>
                          {visit.diagnosis && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-400 truncate max-w-[120px]">{visit.diagnosis}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${expandedVisit === visit.id ? 'rotate-90' : ''}`} />
                    </div>

                    {expandedVisit === visit.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 bg-gray-50/50 rounded-b-2xl mx-4 mb-2 border border-gray-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chief Complaint</p>
                              <p className="text-sm font-medium text-gray-700">{visit.diagnosis || "Not recorded"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Staff</p>
                              <p className="text-sm font-medium text-gray-700">{visit.doctor_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date & Time</p>
                              <p className="text-sm font-medium text-gray-700">{visit.formatted_date} at {visit.formatted_time}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Service</p>
                              <p className="text-sm font-medium text-gray-700">{visit.service_name}</p>
                            </div>
                          </div>
                          
                          {/* Treatment / Notes */}
                          {visit.treatment && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-green-600" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Treatment / Notes</p>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{visit.treatment}</p>
                            </div>
                          )}
                          
                          {/* PRESCRIPTION - Always shown if it exists */}
                          {visit.prescription && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <Pill className="w-4 h-4 text-blue-600" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prescription</p>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{visit.prescription}</p>
                            </div>
                          )}
                          
                          {/* Staff Notes */}
                          {visit.notes && visit.notes !== "Visit completed" && visit.notes !== "Completed consultation" && !visit.notes.includes("No-Show") && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Staff Notes</p>
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{visit.notes}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold mb-1">No medical records yet</h4>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Your visit history will appear here after your first consultation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ========== NOTIFICATION DETAIL VIEW MODAL ========== */}
      <AnimatePresence>
        {showNotificationDetail && selectedNotification && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotificationDetail(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className={`p-6 ${
                selectedNotification.type === 'patient_called'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                  : selectedNotification.type === 'no_show'
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : selectedNotification.type === 'queue_paused' || selectedNotification.type === 'queue_resumed'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                  : selectedNotification.type === 'cancelled'
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : selectedNotification.type === 'queue_reset'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600'
              } text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      {selectedNotification.type === 'patient_called' ? (
                        <BellRing className="w-5 h-5 animate-pulse" />
                      ) : selectedNotification.type === 'no_show' ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <Bell className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{selectedNotification.title}</h3>
                      <p className="text-white/80 text-xs">
                        {new Date(selectedNotification.created_at).toLocaleString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNotificationDetail(false)}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <div className={`rounded-2xl p-5 ${
                  selectedNotification.type === 'patient_called' ? 'bg-green-50 border-2 border-green-200' :
                  selectedNotification.type === 'no_show' ? 'bg-red-50 border-2 border-red-200' :
                  'bg-gray-50'
                }`}>
                  <p className={`text-base leading-relaxed ${
                    selectedNotification.type === 'patient_called' ? 'text-green-800 font-medium' :
                    selectedNotification.type === 'no_show' ? 'text-red-800 font-medium' :
                    'text-gray-700'
                  }`}>
                    {selectedNotification.message}
                  </p>
                  {selectedNotification.type === 'patient_called' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setShowNotificationDetail(false);
                          navigate("/patient/queue/monitor");
                        }}
                        className="flex-1 bg-green-600 text-white font-bold py-2 rounded-xl text-sm hover:bg-green-700 transition-colors"
                      >
                        Track Visit
                      </button>
                    </div>
                  )}
                  {selectedNotification.type === 'no_show' && (
                    <div className="mt-3">
                      <p className="text-xs text-red-600">
                        Please contact the clinic if you believe this is a mistake.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                    selectedNotification.is_read
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedNotification.is_read ? 'Read' : 'Unread'}
                  </span>
                  <button
                    onClick={() => {
                      deleteNotification(selectedNotification.id);
                      setShowNotificationDetail(false);
                    }}
                    disabled={isDeleting === selectedNotification.id}
                    className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors flex items-center gap-1.5"
                  >
                    {isDeleting === selectedNotification.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>

                <button
                  onClick={() => setShowNotificationDetail(false)}
                  className="w-full mt-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========== DELETE ALL CONFIRMATION MODAL ========== */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteAllModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delete All Notifications?</h3>
                    <p className="text-sm text-gray-500">
                      {notifications.length} notification{notifications.length > 1 ? 's' : ''} will be deleted
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed">
                  Are you sure you want to permanently delete all your notifications? 
                  This action cannot be undone.
                </p>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowDeleteAllModal(false)}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAllNotifications}
                    disabled={isDeletingAll}
                    className={`flex-1 px-4 py-3 text-white font-bold rounded-2xl transition-colors text-sm flex items-center justify-center gap-2 ${
                      isDeletingAll
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isDeletingAll ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete All
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
