import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Users,
  CheckCircle,
  Activity,
  UserPlus,
  SkipForward,
  PauseCircle,
  PlayCircle,
  FileText,
  X,
  Stethoscope,
  Calendar,
  User,
  ClipboardList,
  Bell,
  Pill,
  AlertCircle,
  Heart,
  Timer,
  Sparkles,
  UserX,
  AlertTriangle,
  Star,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase, supabaseAdmin } from "../../config/supabase";
import { useNetworkStatus } from "../../components/useNetworkStatus";
import { useToast } from "../../contexts/ToastContext";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wasOffline } = useNetworkStatus();
  const { showToast } = useToast();
  
  const [queue, setQueue] = useState<any[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalToday, setTotalToday] = useState(0);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("MediFlow Staff");
  const [viewingPatient, setViewingPatient] = useState<any>(null);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [estimatedServiceTime, setEstimatedServiceTime] = useState(15);
  
  // ========== DIAGNOSIS INPUT STATE ==========
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [treatmentInput, setTreatmentInput] = useState("");
  const [prescriptionInput, setPrescriptionInput] = useState("");
  
  // ========== CONFIRMATION MODAL STATE ==========
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: "warning" | "danger" | "info";
    onConfirm: () => void;
    patientName: string;
    patientToken: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    onConfirm: () => {},
    patientName: "",
    patientToken: "",
  });

  // ========== FETCH ESTIMATED SERVICE TIME ==========
  const fetchEstimatedServiceTime = async () => {
    try {
      const { data, error } = await supabase
        .from("queue_settings")
        .select("estimated_service_time_minutes")
        .limit(1)
        .single();
      
      if (!error && data) {
        setEstimatedServiceTime(data.estimated_service_time_minutes || 15);
      }
    } catch (error) {
      console.error("Error fetching estimated service time:", error);
    }
  };

  // ========== FETCH STAFF ID AND NAME ==========
  useEffect(() => {
    const fetchStaffInfo = async () => {
      if (!user?.id) return;
      
      try {
        console.log("🔍 Fetching staff info for user:", user.id);
        
        // Get staff record
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("user_id")
          .eq("user_id", user.id)
          .single();
        
        if (staffError) {
          console.warn("⚠️ Staff record not found for user:", user.id);
          setStaffId(null);
        } else {
          console.log("✅ Staff record found:", staffData);
          setStaffId(staffData.user_id);
        }

        // Get staff name from user_profiles
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();
        
        if (!profileError && profileData) {
          const fullName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
          console.log("✅ Staff profile found:", profileData);
          console.log("✅ Full name:", fullName);
          
          if (fullName) {
            setStaffName(fullName);
            console.log("✅ Staff name set to:", fullName);
          } else {
            console.warn("⚠️ Full name is empty, using fallback");
            setStaffName("MediFlow Staff");
          }
        } else {
          console.warn("⚠️ Profile not found for user:", user.id);
          console.warn("Profile error:", profileError);
          
          // Try to get from auth user metadata
          try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (!authError && authData?.user?.user_metadata) {
              const metadata = authData.user.user_metadata;
              const firstName = metadata?.first_name || "";
              const lastName = metadata?.last_name || "";
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) {
                console.log("✅ Found name in auth metadata:", fullName);
                setStaffName(fullName);
                return;
              }
            }
          } catch (authError) {
            console.warn("Could not fetch auth metadata:", authError);
          }
          
          // Fallback: use email
          const fallbackName = user?.email?.split('@')[0] || "MediFlow Staff";
          console.log("✅ Using fallback name:", fallbackName);
          setStaffName(fallbackName);
        }
      } catch (error) {
        console.error("❌ Error fetching staff info:", error);
        setStaffId(null);
        setStaffName("MediFlow Staff");
      }
    };
    
    fetchStaffInfo();
    fetchEstimatedServiceTime();
  }, [user]);

  // ========== FETCH SERVICES ==========
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from("services")
          .select("id, name")
          .eq("is_active", true);
        
        if (error) throw error;
        setServices(data || []);
      } catch (error) {
        console.error("Error fetching services:", error);
      }
    };
    fetchServices();
  }, []);

  // ========== FETCH QUEUE PAUSE STATUS ==========
  const fetchQueuePauseStatus = useCallback(async () => {
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
      console.error("Error fetching queue status:", error);
    }
  }, []);

  // ========== SUBSCRIBE TO QUEUE PAUSE CHANGES ==========
  useEffect(() => {
    fetchQueuePauseStatus();

    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: "key=eq.queue_paused",
        },
        (payload) => {
          const newValue = payload.new?.value === "true";
          setQueuePaused(newValue);
          
          if (newValue) {
            showToast("Queue Paused", "The queue has been paused. Patients will be notified.", "info");
          } else {
            showToast("Queue Resumed", "The queue has been resumed. Patients can now join.", "success");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueuePauseStatus, showToast]);

  // ========== TOGGLE QUEUE PAUSE ==========
  const toggleQueuePause = async () => {
    if (isTogglingPause) return;
    
    setIsTogglingPause(true);
    try {
      const newState = !queuePaused;
      
      const { error } = await supabase
        .from("system_settings")
        .update({ value: String(newState) })
        .eq("key", "queue_paused");

      if (error) {
        console.error("Error updating queue status:", error);
        showToast("Update Failed", "Failed to update queue status", "error");
        setIsTogglingPause(false);
        return;
      }

      setQueuePaused(newState);
      
      if (newState) {
        const { data: waitingPatients } = await supabase
          .from("patient_queues")
          .select("patient_id")
          .in("status", ["waiting", "serving"]);

        if (waitingPatients && waitingPatients.length > 0) {
          const notifications = waitingPatients.map(p => ({
            user_id: p.patient_id,
            type: "queue_paused",
            title: "Queue Paused",
            message: "The clinic queue has been temporarily paused. Please wait for updates.",
            is_read: false,
            created_at: new Date().toISOString(),
          }));

          for (let i = 0; i < notifications.length; i += 10) {
            const batch = notifications.slice(i, i + 10);
            await supabase
              .from("notifications")
              .insert(batch);
          }
        }
      } else {
        const { data: waitingPatients } = await supabase
          .from("patient_queues")
          .select("patient_id")
          .in("status", ["waiting", "serving"]);

        if (waitingPatients && waitingPatients.length > 0) {
          const notifications = waitingPatients.map(p => ({
            user_id: p.patient_id,
            type: "queue_resumed",
            title: "Queue Resumed",
            message: "The clinic queue has resumed. You will be called shortly.",
            is_read: false,
            created_at: new Date().toISOString(),
          }));

          for (let i = 0; i < notifications.length; i += 10) {
            const batch = notifications.slice(i, i + 10);
            await supabase
              .from("notifications")
              .insert(batch);
          }
        }
      }

      showToast(
        newState ? "Queue Paused" : "Queue Resumed",
        newState ? "Queue paused. Patients have been notified." : "Queue resumed. Patients can now join.",
        "success"
      );

    } catch (error: any) {
      console.error("Error toggling queue pause:", error);
      showToast("Error", error.message || "Failed to toggle queue status", "error");
    } finally {
      setIsTogglingPause(false);
    }
  };

  // ========== FETCH QUEUE DATA ==========
  const fetchQueueData = useCallback(async () => {
    try {
      const { data: queueData, error: queueError } = await supabase
        .from("patient_queues")
        .select("queue_number, patient_id, created_at, notes, status, service_id")
        .in("status", ["waiting", "serving"])
        .order("queue_number", { ascending: true });

      if (queueError) throw queueError;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: completedCount, error: countError } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact', head: true })
        .gte("visit_date", todayStart.toISOString());
      
      if (countError && countError.code !== 'PGRST301') {
        console.warn("Could not fetch completed count:", countError);
      }

      const enrichedQueue = await Promise.all((queueData || []).map(async (item) => {
        let name = `Patient #${item.queue_number}`;
        let firstName = "";
        let lastName = "";
        if (item.patient_id) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("user_id", item.patient_id)
            .single();
          if (profile) {
            name = `${profile.first_name} ${profile.last_name}`;
            firstName = profile.first_name;
            lastName = profile.last_name;
          }
        }

        let serviceName = "Consultation";
        let chiefComplaint = "No complaint recorded";
        let symptoms: string[] = [];
        let duration = "";
        let severity = "3";
        let allergies = "None";
        let medications = "None";
        let isPriority = false;
        const notesContent = item.notes || "";

        try {
          const parsed = JSON.parse(notesContent);
          
          if (parsed.service) {
            serviceName = parsed.service;
          }
          
          if (parsed.complaint) {
            chiefComplaint = parsed.complaint;
          }
          if (parsed.symptoms) symptoms = parsed.symptoms;
          if (parsed.duration) duration = parsed.duration;
          if (parsed.severity) severity = parsed.severity;
          if (parsed.allergies) allergies = parsed.allergies;
          if (parsed.medications) medications = parsed.medications;
          
          if (parsed.isPriority === true) {
            isPriority = true;
          }
          
        } catch (e) {
          const serviceKeywords = [
            { keyword: "General Consultation", name: "General Consultation" },
            { keyword: "Physical Check-up", name: "Physical Check-up" },
            { keyword: "Pediatrics", name: "Pediatrics" },
            { keyword: "Vaccination / Immunization", name: "Vaccination / Immunization" },
            { keyword: "Vaccination", name: "Vaccination / Immunization" },
            { keyword: "Immunization", name: "Vaccination / Immunization" },
            { keyword: "Eye Consultation", name: "Eye Consultation" },
            { keyword: "Prescription Renewal", name: "Prescription Renewal" },
            { keyword: "Follow-up Check", name: "Follow-up Check" },
          ];

          let foundService = false;
          for (const { keyword, name: service } of serviceKeywords) {
            if (notesContent.includes(keyword)) {
              serviceName = service;
              foundService = true;
              break;
            }
          }

          if (!foundService && notesContent.includes("Service:")) {
            const match = notesContent.match(/Service:\s*([^\n]*)/);
            if (match && match[1]) {
              const possibleService = match[1].trim();
              for (const { keyword, name: service } of serviceKeywords) {
                if (possibleService.includes(keyword) || keyword.includes(possibleService)) {
                  serviceName = service;
                  foundService = true;
                  break;
                }
              }
              if (!foundService) {
                serviceName = possibleService;
              }
            }
          }

          if (notesContent) {
            if (notesContent.includes("Complaint:")) {
              const match = notesContent.match(/Complaint:\s*([^\n]*)/);
              if (match && match[1]) {
                chiefComplaint = match[1].trim();
              }
            } else if (notesContent.includes(":")) {
              const parts = notesContent.split(":");
              if (parts.length > 1) {
                const complaintPart = parts.slice(1).join(":").trim();
                if (complaintPart && !complaintPart.includes("Service")) {
                  chiefComplaint = complaintPart;
                }
              }
            } else if (!foundService) {
              chiefComplaint = notesContent;
            }
          }

          if (notesContent.includes('"isPriority":true') || notesContent.includes('isPriority: true')) {
            isPriority = true;
          }
        }

        if (serviceName === "Consultation" && item.service_id) {
          const service = services.find(s => s.id === item.service_id);
          if (service) {
            serviceName = service.name;
          }
        }

        return {
          queue_number: item.queue_number,
          token: String(item.queue_number).padStart(3, '0'),
          name: name,
          firstName: firstName,
          lastName: lastName,
          service: serviceName,
          service_id: item.service_id,
          chiefComplaint: chiefComplaint,
          status: item.status,
          patient_id: item.patient_id,
          joinedAt: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          joinedDate: new Date(item.created_at).toLocaleDateString("en-PH", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          }),
          symptoms: symptoms,
          duration: duration,
          severity: severity,
          allergies: allergies,
          medications: medications,
          isPriority: isPriority,
          created_at: item.created_at,
        };
      }));

      enrichedQueue.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateA - dateB;
      });

      const sortedQueue = enrichedQueue.map((patient, index) => ({
        ...patient,
        displayOrder: index + 1
      }));

      setQueue(sortedQueue); 
      setTotalToday(completedCount || 0);
      setLoading(false);

    } catch (error) {
      console.error("Error fetching queue:", error);
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    fetchQueueData();

    const channel = supabase
      .channel('staff-queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_queues' },
        () => { 
          if (!processingComplete) {
            fetchQueueData(); 
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchQueueData, processingComplete]);

  // ========== SKIP PATIENT (No-Show - Save to Medical History) ==========
  const handleSkipPatient = (patient: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Confirm No-Show",
      message: `Are you sure you want to mark ${patient.name} (Token #${patient.token}) as NO-SHOW? This action will:\n• Record this in their medical history\n• Remove them from the queue\n• Send a notification to the patient`,
      confirmText: "Yes, Mark No-Show",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: () => confirmSkipPatient(patient),
      patientName: patient.name,
      patientToken: patient.token,
    });
  };

  const confirmSkipPatient = async (patient: any) => {
    setIsProcessingAction(true);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    try {
      let staffIdToUse = staffId;
      if (!staffIdToUse) {
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("user_id")
          .eq("user_id", user?.id)
          .single();
        
        if (!staffError && staffData) {
          staffIdToUse = staffData.user_id;
          setStaffId(staffIdToUse);
        }
      }

      const medicalRecord = {
        patient_id: patient.patient_id,
        visit_date: new Date().toISOString(),
        service_id: null,
        staff_id: null,
        staff_name: staffName,
        diagnosis: patient.chiefComplaint || "No complaint recorded",
        treatment: "Patient did not attend appointment (No-Show)",
        notes: `No-Show. Chief complaint: ${patient.chiefComplaint || "None"}. Service: ${patient.service || "Consultation"}`,
        prescription: null,
      };

      const { error: insertError } = await supabase
        .from("medical_history")
        .insert([medicalRecord]);

      if (insertError) {
        console.error("Insert error:", insertError);
        showToast("Error", `Failed to save no-show record: ${insertError.message}`, "error");
        setIsProcessingAction(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("patient_queues")
        .delete()
        .eq("queue_number", patient.queue_number)
        .eq("status", patient.status);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        showToast("Error", `Failed to remove from queue: ${deleteError.message}`, "error");
        setIsProcessingAction(false);
        return;
      }

      setQueue(prevQueue => prevQueue.filter(q => q.queue_number !== patient.queue_number));

      if (patient.patient_id) {
        try {
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: patient.patient_id,
              type: "no_show",
              title: "Missed Appointment",
              message: `You were marked as no-show for your appointment (Token #${patient.token}). Please contact the clinic to reschedule.`,
              is_read: false,
              created_at: new Date().toISOString(),
            });
          
          if (notifError) {
            console.error("Failed to send notification:", notifError);
          }
        } catch (notifErr) {
          console.error("Notification error:", notifErr);
        }
      }

      showToast("No-Show", `${patient.name} (Token #${patient.token}) marked as NO-SHOW`, "info");
      setViewingPatient(null);
      
    } catch (error: any) {
      console.error("Error skipping patient:", error);
      showToast("Error", error.message || "Failed to skip patient", "error");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // ========== CANCEL PATIENT REQUEST (Completely Delete) ==========
  const handleCancelPatient = (patient: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Confirm Cancellation",
      message: `Are you sure you want to CANCEL ${patient.name}'s (Token #${patient.token}) request?\n\nThis will:\n• Completely remove them from the queue\n• No record will be kept\n• Send a notification to the patient`,
      confirmText: "Yes, Cancel Request",
      cancelText: "Go Back",
      type: "danger",
      onConfirm: () => confirmCancelPatient(patient),
      patientName: patient.name,
      patientToken: patient.token,
    });
  };

  const confirmCancelPatient = async (patient: any) => {
    setIsProcessingAction(true);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    try {
      const { error: deleteError } = await supabase
        .from("patient_queues")
        .delete()
        .eq("queue_number", patient.queue_number)
        .eq("status", patient.status);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        showToast("Error", `Failed to cancel request: ${deleteError.message}`, "error");
        setIsProcessingAction(false);
        return;
      }

      setQueue(prevQueue => prevQueue.filter(q => q.queue_number !== patient.queue_number));

      if (patient.patient_id) {
        try {
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: patient.patient_id,
              type: "cancelled",
              title: "Queue Cancelled",
              message: `Your token #${patient.token} has been cancelled. Please contact the clinic if you need assistance.`,
              is_read: false,
              created_at: new Date().toISOString(),
            });
          
          if (notifError) {
            console.error("Failed to send notification:", notifError);
          }
        } catch (notifErr) {
          console.error("Notification error:", notifErr);
        }
      }

      showToast("Cancelled", `Cancelled ${patient.name}'s request (Token #${patient.token})`, "info");
      setViewingPatient(null);
      
    } catch (error: any) {
      console.error("Error cancelling patient:", error);
      showToast("Error", error.message || "Failed to cancel patient", "error");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // ========== HANDLE CALL NEXT ==========
  const handleCallNext = async () => {
    if (isCallingNext) return;
    
    if (queuePaused) {
      showToast("Queue Paused", "Cannot call next patient while queue is paused.", "info");
      return;
    }
    
    try {
      setIsCallingNext(true);
      
      const nextPatient = queue.find(q => q.status === "waiting");

      if (!nextPatient) {
        showToast("Info", "No patients waiting in queue.", "info");
        setIsCallingNext(false);
        return;
      }

      const currentServing = queue.find(q => q.status === "serving");
      if (currentServing) {
        showToast("Info", "A patient is already being served.", "info");
        setIsCallingNext(false);
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from("patient_queues")
        .update({ status: "serving" })
        .eq("queue_number", nextPatient.queue_number);

      if (updateError) {
        console.error("❌ Database update error:", updateError);
        showToast("Error", `Failed to update queue: ${updateError.message}`, "error");
        setIsCallingNext(false);
        return;
      }

      // ========== SEND NOTIFICATION TO PATIENT - ONLY WHEN CALLED ==========
      if (nextPatient.patient_id) {
        try {
          const priorityMsg = nextPatient.isPriority ? " (Priority Patient)" : "";
          const notificationMessage = `You are being called for your appointment (Token #${nextPatient.token}${priorityMsg}). Please proceed to the consultation room.`;
          
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: nextPatient.patient_id,
              type: "patient_called",
              title: "🩺 You're Being Called!",
              message: notificationMessage,
              is_read: false,
              created_at: new Date().toISOString(),
            });

          if (notificationError) {
            console.error("Failed to send notification to patient:", notificationError);
          } else {
            console.log(`✅ Notification sent to patient ${nextPatient.name} (Token #${nextPatient.token})`);
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
        }
      }

      // Update local queue state
      setQueue(prevQueue => 
        prevQueue.map(patient => 
          patient.queue_number === nextPatient.queue_number 
            ? { ...patient, status: "serving" }
            : patient
        )
      );

      const priorityMsg = nextPatient.isPriority ? " (Priority Patient)" : "";
      showToast("Calling Patient", `Calling patient #${nextPatient.token}${priorityMsg}`, "success");
      
      // Reset diagnosis input for the new patient
      setDiagnosisInput("");
      setTreatmentInput("");
      setPrescriptionInput("");
      
    } catch (error: any) {
      console.error("Error calling next patient:", error);
      showToast("Error", error.message || "Failed to call next patient", "error");
    } finally {
      setIsCallingNext(false);
    }
  };

  // ========== HANDLE COMPLETE - FIXED WITH STAFF NAME ==========
  const handleComplete = async (queue_number: number) => {
    if (processingComplete) return;
    
    try {
      setProcessingComplete(true);
      
      const targetPatient = queue.find(q => q.queue_number === queue_number);
      if (!targetPatient) {
        throw new Error("Patient not found");
      }

      if (!diagnosisInput.trim()) {
        showToast("Diagnosis Required", "Please enter a diagnosis before completing the visit.", "info");
        setProcessingComplete(false);
        return;
      }

      // ============================================================
      // ✅ FIX: Get the staff name directly from user_profiles
      // ============================================================
      let staffNameToUse = "MediFlow Staff";
      let staffIdToUse = staffId;

      try {
        // Get staff record
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("user_id")
          .eq("user_id", user?.id)
          .single();
        
        if (!staffError && staffData) {
          staffIdToUse = staffData.user_id;
          setStaffId(staffIdToUse);
          console.log("✅ Staff ID retrieved:", staffIdToUse);
        }

        // Get staff name from user_profiles
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("user_id", user?.id)
          .single();
        
        if (!profileError && profileData) {
          const fullName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
          if (fullName) {
            staffNameToUse = fullName;
            setStaffName(fullName);
            console.log("✅ Staff name retrieved from user_profiles:", staffNameToUse);
          }
        } else {
          console.warn("⚠️ Could not find user_profiles, trying auth metadata...");
          
          // Try auth metadata as fallback
          try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (!authError && authData?.user?.user_metadata) {
              const metadata = authData.user.user_metadata;
              const firstName = metadata?.first_name || "";
              const lastName = metadata?.last_name || "";
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) {
                staffNameToUse = fullName;
                setStaffName(fullName);
                console.log("✅ Staff name retrieved from auth metadata:", staffNameToUse);
              }
            }
          } catch (authError) {
            console.warn("Could not fetch auth metadata:", authError);
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not fetch staff name, using existing:", error);
        staffNameToUse = staffName || "MediFlow Staff";
      }

      console.log("👤 Staff Name being saved:", staffNameToUse);
      console.log("🆔 Staff ID being saved:", staffIdToUse);

      const visitDate = new Date().toISOString();

      // Create the medical record with the correct staff name
      const medicalRecord = {
        patient_id: targetPatient.patient_id,
        visit_date: visitDate,
        service_id: null,
        staff_id: staffIdToUse || null,
        staff_name: staffNameToUse, // ✅ This will now save the real name
        diagnosis: targetPatient.chiefComplaint || "No complaint recorded",
        treatment: treatmentInput.trim() || "Completed consultation",
        notes: `Staff Diagnosis: ${diagnosisInput.trim()}\nTreatment: ${treatmentInput.trim() || "Completed consultation"}\nPrescription: ${prescriptionInput.trim() || "None"}\nChief complaint: ${targetPatient.chiefComplaint || "None"}`,
        prescription: prescriptionInput.trim() || null,
      };

      console.log("📝 Inserting medical record:", medicalRecord);

      // Insert the record
      const { data: insertData, error: insertError } = await supabase
        .from("medical_history")
        .insert([medicalRecord])
        .select();

      if (insertError) {
        console.error("❌ Insert error details:", insertError);
        showToast("Error", `Failed to save: ${insertError.message}`, "error");
        setProcessingComplete(false);
        return;
      }

      console.log("✅ Medical record saved with staff name:", insertData?.[0]?.staff_name);

      // Delete from queue
      const { error: deleteError } = await supabase
        .from("patient_queues")
        .delete()
        .eq("queue_number", targetPatient.queue_number);

      if (deleteError) {
        console.error("❌ Delete error:", deleteError);
        showToast("Error", `Failed to delete from queue: ${deleteError.message}`, "error");
        setProcessingComplete(false);
        return;
      }

      setQueue(prevQueue => {
        const newQueue = prevQueue.filter(q => q.queue_number !== queue_number);
        return newQueue;
      });

      setTotalToday(prev => prev + 1);
      
      showToast("Visit Complete", `Token #${targetPatient.token} marked as complete`, "success");
      
      setViewingPatient(null);
      
      setDiagnosisInput("");
      setTreatmentInput("");
      setPrescriptionInput("");
      
      setTimeout(() => {
        setProcessingComplete(false);
        fetchQueueData();
      }, 500);

    } catch (error: any) {
      console.error("❌ Error completing visit:", error);
      showToast("Error", error.message || "Failed to complete visit", "error");
      setProcessingComplete(false);
      fetchQueueData();
    }
  };

  const currentPatient = queue.find(q => q.status === "serving");
  const waitingList = queue.filter(q => q.status === "waiting");
  const nextWaitingPatient = queue.find(q => q.status === "waiting");

  const stats = [
    { label: "Total Today", value: totalToday, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Waiting", value: waitingList.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Avg Wait", value: `${waitingList.length * estimatedServiceTime} min`, icon: Activity, color: "text-green-600 bg-green-50" },
    { label: "Serving", value: currentPatient?.token || "None", icon: CheckCircle, color: "text-purple-600 bg-purple-50" },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Staff Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleQueuePause} 
            disabled={isTogglingPause}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              queuePaused 
                ? "bg-green-500 text-white shadow-md hover:bg-green-600" 
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isTogglingPause ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : queuePaused ? (
              <PlayCircle className="w-4 h-4" />
            ) : (
              <PauseCircle className="w-4 h-4" />
            )}
            {queuePaused ? "Resume Queue" : "Pause Queue"}
          </button>
          <button onClick={() => navigate("/staff/walkin")} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-4 py-2.5 rounded-2xl shadow-md text-sm">
            <UserPlus className="w-4 h-4" /> Walk-in
          </button>
        </div>
      </div>

      <AnimatePresence>
        {queuePaused && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }} 
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 mb-5"
          >
            <Bell className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-semibold text-amber-800">
              Queue is currently PAUSED. Patients have been notified and cannot join until resumed.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}><stat.icon className="w-5 h-5" /></div>
            <p className="text-3xl font-black text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-200 text-sm font-semibold">Currently Serving</span>
              <span className="flex items-center gap-1.5 text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Live
              </span>
            </div>
            
            <p className="text-7xl font-black mb-2">{currentPatient?.token || "---"}</p>
            
            {currentPatient ? (
              <div className="bg-white/15 rounded-2xl p-4 mb-4">
                <p className="font-bold text-lg">{currentPatient.name}</p>
                <p className="text-green-200 text-sm">{currentPatient.service}</p>
                <p className="text-green-100 text-xs mt-1 italic">"{currentPatient.chiefComplaint}"</p>
                <div className="flex gap-3 mt-3 text-xs text-green-200">
                  <span>In at {currentPatient.joinedAt}</span>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-green-200 mb-1.5">Diagnosis *</label>
                    <input
                      type="text"
                      value={diagnosisInput}
                      onChange={(e) => setDiagnosisInput(e.target.value)}
                      placeholder="Enter diagnosis..."
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-sm text-white placeholder-green-200/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-green-200 mb-1.5">Treatment / Notes</label>
                    <textarea
                      value={treatmentInput}
                      onChange={(e) => setTreatmentInput(e.target.value)}
                      placeholder="Enter treatment notes..."
                      rows={2}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-sm text-white placeholder-green-200/50 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-green-200 mb-1.5">Prescription</label>
                    <input
                      type="text"
                      value={prescriptionInput}
                      onChange={(e) => setPrescriptionInput(e.target.value)}
                      placeholder="Enter prescription (optional)"
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-sm text-white placeholder-green-200/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <button 
                    onClick={() => handleComplete(currentPatient.queue_number)} 
                    disabled={processingComplete || !diagnosisInput.trim()}
                    className={`w-full font-bold py-2.5 rounded-xl text-sm transition-colors ${
                      processingComplete || !diagnosisInput.trim()
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-white text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {processingComplete ? 'Processing...' : ' Complete Visit'}
                  </button>
                  {!diagnosisInput.trim() && currentPatient && (
                    <p className="text-xs text-green-200/70 text-center">Please enter a diagnosis to complete the visit</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSkipPatient(currentPatient)}
                      disabled={isProcessingAction || processingComplete}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserX className="w-4 h-4" />
                      No-Show
                    </button>
                    <button
                      onClick={() => handleCancelPatient(currentPatient)}
                      disabled={isProcessingAction || processingComplete}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
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

            {nextWaitingPatient && !currentPatient && (
              <div className="bg-white/10 rounded-xl p-3 mb-3 text-center border border-white/20">
                <p className="text-green-200 text-xs font-semibold">Next in queue</p>
                <p className="text-3xl font-bold">#{nextWaitingPatient.token}</p>
                <p className="text-green-100 text-sm">{nextWaitingPatient.name}</p>
                {nextWaitingPatient.isPriority && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-400/30 text-amber-100 px-2 py-0.5 rounded-full mt-1">
                    <Star className="w-3 h-3" /> Priority
                  </span>
                )}
              </div>
            )}

            <motion.button 
              whileTap={{ scale: 0.97 }} 
              onClick={handleCallNext} 
              disabled={isCallingNext || !!currentPatient || waitingList.length === 0 || processingComplete || queuePaused}
              className={`w-full font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors ${
                isCallingNext || !!currentPatient || waitingList.length === 0 || processingComplete || queuePaused
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-green-700 hover:bg-green-50'
              }`}
            >
              <SkipForward className="w-5 h-5" /> 
              {queuePaused ? 'Queue Paused' : isCallingNext ? 'Calling...' : 'Call Next Patient'}
            </motion.button>
            
            <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="bg-white/10 rounded-2xl py-2">
                <p className="text-green-200 text-xs">Avg Wait</p>
                <p className="font-bold">{waitingList.length * estimatedServiceTime} min</p>
              </div>
              <div className="bg-white/10 rounded-2xl py-2">
                <p className="text-green-200 text-xs">In Queue</p>
                <p className="font-bold">{waitingList.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">Active Queue</h3>
              </div>
              <span className="text-xs text-gray-400">{waitingList.length} patients waiting</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {queue.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
                    <Users className="w-10 h-10 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold text-lg mb-2">Queue is empty</h4>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">There are currently no patients waiting.</p>
                  <button onClick={() => navigate("/staff/walkin")} className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded-2xl hover:bg-gray-50 transition-colors">
                    <UserPlus className="w-4 h-4" /> Register Walk-in Patient
                  </button>
                </div>
              ) : (
                queue.map((patient, i) => (
                  <motion.div 
                    key={patient.token} 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.05 }} 
                    className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${patient.status === "serving" ? "bg-green-50/50" : ""}`}
                    onClick={() => setViewingPatient(patient)}
                  >
                    <div className={`w-14 text-center py-2 rounded-xl font-black text-sm flex-shrink-0 ${
                      patient.status === "serving" 
                        ? "bg-green-500 text-white" 
                        : patient.isPriority 
                          ? "bg-amber-500 text-white" 
                          : "bg-gray-100 text-gray-700"
                    }`}>
                      {patient.token}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
                        {patient.isPriority && (
                          <span className="flex items-center gap-0.5 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                            <Star className="w-2.5 h-2.5" /> Priority
                          </span>
                        )}
                        {patient.status === "serving" && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Serving</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{patient.service}</p>
                      <p className="text-xs text-gray-400 italic truncate mt-0.5">"{patient.chiefComplaint}"</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                        patient.status === "serving" 
                          ? "bg-green-100 text-green-700" 
                          : patient.isPriority
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {patient.status === "serving" ? "Serving" : patient.isPriority ? "Priority" : `#${patient.queue_number}`}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== VIEWING PATIENT MODAL ========== */}
      <AnimatePresence>
        {viewingPatient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPatient(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className={`p-6 text-white sticky top-0 z-10 ${viewingPatient.isPriority ? "bg-gradient-to-r from-amber-600 to-amber-700" : "bg-gradient-to-r from-green-600 to-emerald-600"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                      {viewingPatient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{viewingPatient.name}</h3>
                      <p className="text-green-200 text-sm">Token #{viewingPatient.token}</p>
                      {viewingPatient.isPriority && (
                        <span className="flex items-center gap-1 text-[10px] bg-amber-400/30 text-amber-100 px-2 py-0.5 rounded-full mt-0.5">
                          <Star className="w-3 h-3" /> Priority Patient
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingPatient(null)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                      <User className="w-3.5 h-3.5" />
                      <span>Patient</span>
                    </div>
                    <p className="font-medium text-gray-900">{viewingPatient.name}</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Joined</span>
                    </div>
                    <p className="font-medium text-gray-900">{viewingPatient.joinedDate}</p>
                    <p className="text-xs text-gray-500">{viewingPatient.joinedAt}</p>
                  </div>
                </div>

                <div className={`${viewingPatient.isPriority ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200"} rounded-2xl p-4`}>
                  <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 ${viewingPatient.isPriority ? "text-amber-700" : "text-blue-700"}`}>
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Service / Reason for Visit</span>
                    {viewingPatient.isPriority && (
                      <span className="flex items-center gap-1 ml-auto text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                        <Star className="w-2.5 h-2.5" /> Priority
                      </span>
                    )}
                  </div>
                  <p className={`font-medium text-lg ${viewingPatient.isPriority ? "text-amber-900" : "text-blue-900"}`}>
                    {viewingPatient.service || "Consultation"}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Chief Complaint</span>
                  </div>
                  <p className="text-amber-900 font-medium">"{viewingPatient.chiefComplaint}"</p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    Patient Intake Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {viewingPatient.symptoms && viewingPatient.symptoms.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 col-span-2">
                        <div className="flex items-center gap-2 text-purple-700 text-xs font-semibold uppercase tracking-wider mb-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Symptoms</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {viewingPatient.symptoms.map((symptom: string, idx: number) => (
                            <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {viewingPatient.duration && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
                          <Timer className="w-3.5 h-3.5" />
                          <span>Duration</span>
                        </div>
                        <p className="text-sm font-medium text-indigo-900">{viewingPatient.duration}</p>
                      </div>
                    )}

                    {viewingPatient.severity && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-red-700 text-xs font-semibold uppercase tracking-wider mb-2">
                          <Heart className="w-3.5 h-3.5" />
                          <span>Pain Level</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-red-900">{viewingPatient.severity}/10</span>
                          <div className="flex-1 h-1.5 bg-red-200 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${(viewingPatient.severity / 10) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {viewingPatient.allergies && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Allergies</span>
                        </div>
                        <p className="text-sm font-medium text-rose-900">{viewingPatient.allergies}</p>
                      </div>
                    )}

                    {viewingPatient.medications && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-2">
                          <Pill className="w-3.5 h-3.5" />
                          <span>Current Medications</span>
                        </div>
                        <p className="text-sm font-medium text-emerald-900">{viewingPatient.medications}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${viewingPatient.status === "serving" ? "bg-green-100 text-green-700" : viewingPatient.isPriority ? "bg-amber-100 text-amber-700" : "bg-amber-100 text-amber-700"}`}>
                      {viewingPatient.status === "serving" ? "Currently Serving" : "Waiting in Queue"}
                      {viewingPatient.isPriority && viewingPatient.status === "waiting" && (
                        <span className="ml-1 text-amber-600">⭐</span>
                      )}
                    </span>
                    {viewingPatient.status === "serving" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            handleComplete(viewingPatient.queue_number);
                          }}
                          disabled={processingComplete || !diagnosisInput.trim()}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                        >
                          {processingComplete ? 'Processing...' : 'Complete'}
                        </button>
                        <button
                          onClick={() => handleSkipPatient(viewingPatient)}
                          disabled={isProcessingAction}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancelPatient(viewingPatient)}
                          disabled={isProcessingAction}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {viewingPatient.status === "waiting" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSkipPatient(viewingPatient)}
                        disabled={isProcessingAction}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessingAction ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                        Mark No-Show
                      </button>
                      <button
                        onClick={() => handleCancelPatient(viewingPatient)}
                        disabled={isProcessingAction}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessingAction ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========== CUSTOM CONFIRMATION MODAL ========== */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden"
            >
              <div className={`p-6 ${confirmModal.type === "danger" ? "bg-red-50 border-b border-red-100" : confirmModal.type === "warning" ? "bg-amber-50 border-b border-amber-100" : "bg-blue-50 border-b border-blue-100"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${confirmModal.type === "danger" ? "bg-red-100 text-red-600" : confirmModal.type === "warning" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                    {confirmModal.type === "danger" ? (
                      <X className="w-6 h-6" />
                    ) : confirmModal.type === "warning" ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{confirmModal.title}</h3>
                    <p className="text-sm text-gray-500">
                      {confirmModal.patientName} (Token #{confirmModal.patientToken})
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {confirmModal.message}
                </p>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                  >
                    {confirmModal.cancelText}
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`flex-1 px-4 py-3 text-white font-bold rounded-2xl transition-colors text-sm flex items-center justify-center gap-2 ${confirmModal.type === "danger" ? "bg-red-500 hover:bg-red-600" : confirmModal.type === "warning" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-500 hover:bg-blue-600"}`}
                  >
                    {isProcessingAction ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      confirmModal.confirmText
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
