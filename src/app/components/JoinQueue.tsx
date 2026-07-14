import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Stethoscope,
  Syringe,
  Baby,
  Eye,
  Heart,
  Pill,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  FileText,
  Clock,
  User,
  X,
  Activity,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useToast } from "../../contexts/ToastContext";

const SERVICES = [
  { id: "general", icon: Stethoscope, label: "General Consultation", wait: "~25 min" },
  { id: "checkup", icon: Heart, label: "Physical Check-up", wait: "~35 min" },
  { id: "pediatrics", icon: Baby, label: "Pediatrics", wait: "~20 min" },
  { id: "vaccination", icon: Syringe, label: "Vaccination / Immunization", wait: "~15 min" },
  { id: "ophthalmology", icon: Eye, label: "Eye Consultation", wait: "~40 min" },
  { id: "prescription", icon: Pill, label: "Prescription Renewal", wait: "~10 min" },
];

const SYMPTOM_OPTIONS = [
  "Fever", "Cough", "Colds / Runny Nose", "Headache", "Body Pain",
  "Vomiting / Nausea", "Diarrhea", "Dizziness", "Shortness of Breath",
  "Chest Pain", "Rash / Skin Irritation", "Eye Discomfort",
  "Ear Pain", "Toothache", "Urinary Issues", "Other",
];

type Step = 1 | 2 | 3;
const STEPS = [{ n: 1, label: "Select Service" }, { n: 2, label: "Intake Form" }, { n: 3, label: "Queue Token" }];

export default function JoinQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueToken, setQueueToken] = useState<any>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState({ chiefComplaint: "", duration: "", severity: "3", allergies: "", medications: "", additionalNotes: "" });
  
  const [currentStatus, setCurrentStatus] = useState<string>("waiting");
  const [currentService, setCurrentService] = useState<string>("Consultation");
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [isCheckingPause, setIsCheckingPause] = useState(true);
  const [isQueueFull, setIsQueueFull] = useState(false);
  const [dailyCap, setDailyCap] = useState(80);
  const [todayCount, setTodayCount] = useState(0);

  // ========== CONFIRMATION MODAL STATE ==========
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => {},
  });

  const toggleSymptom = (s: string) => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ========== CHECK QUEUE STATUS (Paused, Full) ==========
  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        // Check if queue is paused
        const { data: pauseData, error: pauseError } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "queue_paused")
          .single();

        if (pauseError) {
          console.error("Error checking queue pause status:", pauseError);
          setIsQueuePaused(false);
        } else {
          setIsQueuePaused(pauseData?.value === "true");
        }

        // Check daily cap and today's count
        const { data: settingsData, error: settingsError } = await supabase
          .from("queue_settings")
          .select("max_queue_length")
          .limit(1)
          .single();

        if (!settingsError && settingsData) {
          setDailyCap(settingsData.max_queue_length || 80);
        }

        // Get today's count
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayTotal, error: countError } = await supabase
          .from("patient_queues")
          .select("*", { count: 'exact', head: true })
          .gte("created_at", todayStart.toISOString());

        if (!countError) {
          const currentCount = todayTotal || 0;
          setTodayCount(currentCount);
          const cap = settingsData?.max_queue_length || 80;
          setIsQueueFull(currentCount >= cap);
          
          if (currentCount >= cap) {
            console.log("Queue is FULL! Daily cap reached:", cap);
          }
        }

        setIsCheckingPause(false);
      } catch (error) {
        console.error("Error checking queue status:", error);
        setIsCheckingPause(false);
      }
    };

    checkQueueStatus();

    // Subscribe to changes
    const channel = supabase
      .channel('queue-status-' + user?.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_queues',
        },
        () => {
          // Refresh queue status when changes happen
          checkQueueStatus();
        }
      )
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
          setIsQueuePaused(isPaused);
          
          if (isPaused) {
            showToast("Queue Paused", "The clinic queue has been paused. You cannot join at this time.", "warning");
          } else {
            showToast("Queue Resumed", "The clinic queue has resumed. You can now join.", "success");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchCurrentQueueStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("patient_queues")
        .select("id, status, notes, queue_number")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching queue status:", error);
        return;
      }

      if (data) {
        const newStatus = data.status || 'waiting';
        setCurrentStatus(newStatus);
        
        let serviceName = "Consultation";
        if (data.notes) {
          try {
            const parsed = JSON.parse(data.notes);
            if (parsed.service) {
              serviceName = parsed.service;
            }
          } catch (e) {
            const foundService = SERVICES.find(s => data.notes.includes(s.label));
            if (foundService) {
              serviceName = foundService.label;
            }
          }
        }
        setCurrentService(serviceName);
      }
    } catch (error) {
      console.error("Error fetching queue status:", error);
    }
  };

  useEffect(() => {
    if (!user || step !== 3) return;

    fetchCurrentQueueStatus();

    const channel = supabase
      .channel('patient-queue-status-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'patient_queues',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            const newStatus = payload.new.status;
            setCurrentStatus(newStatus);
            
            if (payload.new.notes) {
              try {
                const parsed = JSON.parse(payload.new.notes);
                if (parsed.service) {
                  setCurrentService(parsed.service);
                }
              } catch (e) {
                const foundService = SERVICES.find(s => payload.new.notes.includes(s.label));
                if (foundService) {
                  setCurrentService(foundService.label);
                }
              }
            }
            
            setQueueToken((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: newStatus,
              };
            });
            
            if (newStatus === 'serving') {
              showToast("You are now being served!", "info");
            } else if (newStatus === 'completed') {
              showToast("Your visit has been completed.", "success");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, step]);

  useEffect(() => {
    if (!user || step !== 3) return;

    const deleteChannel = supabase
      .channel('patient-queue-delete-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'patient_queues',
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          showToast("Left Queue", "You have left the queue.", "info");
          navigate("/patient/dashboard");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deleteChannel);
    };
  }, [user, step, navigate, showToast]);

  const generateToken = async () => {
    if (!user) { 
      showToast("Login Required", "Please login to join the queue", "error"); 
      return; 
    }
    
    // ========== CHECK IF QUEUE IS PAUSED ==========
    if (isQueuePaused) {
      showToast("Queue Paused", "The clinic queue is currently paused. Please try again later.", "warning");
      return;
    }
    
    // ========== CHECK IF QUEUE IS FULL ==========
    if (isQueueFull) {
      showToast(
        "Queue is Full", 
        `The clinic has reached its daily patient limit (${dailyCap} patients). Please come back tomorrow.`, 
        "warning"
      );
      return;
    }
    
    setLoading(true);
    try {
      const selectedServiceObj = SERVICES.find(s => s.id === selectedService);
      if (!selectedServiceObj) throw new Error("Please select a service");
      if (!form.chiefComplaint) throw new Error("Please fill in the chief complaint");

      // Check if patient already has a waiting or serving entry
      const { data: existingQueue, error: existingError } = await supabase
        .from("patient_queues")
        .select("id, status")
        .eq("patient_id", user.id)
        .in("status", ["waiting", "serving"])
        .limit(1);

      if (existingError) {
        console.error("Error checking existing queue:", existingError);
      }

      if (existingQueue && existingQueue.length > 0) {
        showToast("Already in Queue", "You already have an active queue entry.", "warning");
        setLoading(false);
        return;
      }

      // ========== CHECK DAILY CAP AGAIN (double check) ==========
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { count: todayCountCheck, error: countError } = await supabase
        .from("patient_queues")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", todayStart.toISOString());

      if (countError) {
        console.error("Error counting today's patients:", countError);
      }

      const currentCount = todayCountCheck || 0;
      const cap = dailyCap;

      if (currentCount >= cap) {
        setIsQueueFull(true);
        setTodayCount(currentCount);
        showToast(
          "Queue is Full", 
          `The clinic has reached its daily patient limit (${cap} patients). Please come back tomorrow.`, 
          "warning"
        );
        setLoading(false);
        return;
      }

      // ========== CONTINUE WITH QUEUE GENERATION ==========
      const { data: maxQueueData, error: maxError } = await supabase
        .from("patient_queues")
        .select("queue_number")
        .order("queue_number", { ascending: false })
        .limit(1);

      let queueNumber = 1;
      if (!maxError && maxQueueData && maxQueueData.length > 0) {
        queueNumber = maxQueueData[0].queue_number + 1;
      }

      const notesData = JSON.stringify({
        service: selectedServiceObj.label,
        complaint: form.chiefComplaint,
        symptoms: symptoms,
        duration: form.duration,
        severity: form.severity,
        allergies: form.allergies || "None",
        medications: form.medications || "None",
      });
      
      const { data, error } = await supabase
        .from("patient_queues")
        .insert({
          patient_id: user.id,
          queue_number: queueNumber,
          status: "waiting",
          created_at: new Date().toISOString(),
          notes: notesData,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        throw new Error(error.message);
      }

      setCurrentService(selectedServiceObj.label);
      setCurrentStatus("waiting");
      setTodayCount(currentCount + 1);

      // Update full status after adding
      if ((currentCount + 1) >= cap) {
        setIsQueueFull(true);
      }

      const newToken = {
        id: data.id,
        token: String(queueNumber).padStart(3, '0'),
        service: selectedServiceObj.label,
        serviceId: selectedService,
        position: queueNumber,
        status: "waiting",
        estimatedWait: (queueNumber - 1) * 8 + 15,
        date: new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      };

      setQueueToken(newToken);
      setStep(3);
      
      // ========== FIXED: Proper toast with title, message, and type ==========
      showToast("Token Generated!", `Token #${newToken.token} generated!`, "success");
    } catch (err: any) {
      console.error("Error generating token:", err);
      showToast("Error", err.message || "Failed to generate queue token. Please try again.", "error");
    } finally { setLoading(false); }
  };

  const handleSubmit = () => generateToken();

  // ========== CANCEL QUEUE WITH CUSTOM MODAL ==========
  const handleCancelQueue = () => {
    setConfirmModal({
      isOpen: true,
      title: "Cancel Queue Position",
      message: "Are you sure you want to cancel your queue position? This action cannot be undone.",
      confirmText: "Yes, Cancel",
      cancelText: "Go Back",
      onConfirm: confirmCancelQueue,
    });
  };

  const confirmCancelQueue = async () => {
    if (!user) {
      showToast("Login Required", "Please login to cancel queue", "error");
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setLoading(true);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    try {
      const { data: queueData, error: findError } = await supabase
        .from("patient_queues")
        .select("id, queue_number")
        .eq("patient_id", user.id)
        .eq("status", "waiting")
        .limit(1);

      if (findError || !queueData || queueData.length === 0) {
        showToast("Not in Queue", "You don't have an active queue entry.", "error");
        setLoading(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("patient_queues")
        .delete()
        .eq("id", queueData[0].id);

      if (deleteError) throw deleteError;

      showToast("Left Queue", "You have successfully left the queue.", "info");
      setQueueToken(null);
      setStep(1);
      navigate("/patient/dashboard");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to cancel queue. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceObj = SERVICES.find(s => s.id === selectedService);

  const getStatusColor = (status: string) => {
    const s = status || 'waiting';
    switch (s) {
      case 'waiting':
        return 'bg-amber-500/20 text-amber-200';
      case 'serving':
        return 'bg-blue-500/20 text-blue-200';
      case 'completed':
        return 'bg-green-500/20 text-green-200';
      default:
        return 'bg-white/20 text-white';
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status || 'waiting';
    switch (s) {
      case 'waiting':
        return 'Waiting';
      case 'serving':
        return 'Being Served';
      case 'completed':
        return 'Completed';
      default:
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
  };

  const getStatusDotColor = (status: string) => {
    const s = status || 'waiting';
    switch (s) {
      case 'waiting':
        return 'bg-amber-400';
      case 'serving':
        return 'bg-blue-400';
      case 'completed':
        return 'bg-green-400';
      default:
        return 'bg-white';
    }
  };

  const displayStatus = currentStatus || queueToken?.status || 'waiting';
  const displayService = currentService || queueToken?.service || 'Consultation';

  // Show loading while checking status
  if (isCheckingPause) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* ========== QUEUE PAUSED BANNER ========== */}
      {isQueuePaused && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start sm:items-center gap-3"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Queue is Currently Paused</p>
            <p className="text-sm text-amber-700">
              The clinic has temporarily paused the queue. You cannot join at this time.
              Please check back later.
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200/50 rounded-full text-xs font-semibold text-amber-700">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Paused
            </span>
          </div>
        </motion.div>
      )}

      {/* ========== QUEUE FULL BANNER ========== */}
      {isQueueFull && step !== 3 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start sm:items-center gap-3"
        >
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Queue is Full</p>
            <p className="text-sm text-red-700">
              The clinic has reached its daily patient limit ({dailyCap} patients). 
              Please come back tomorrow to join the queue.
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-200/50 rounded-full text-xs font-semibold text-red-700">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Full
            </span>
          </div>
        </motion.div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Join Today's Queue</h1>
        <p className="text-gray-500 text-sm">
          {isQueuePaused 
            ? "The queue is currently paused. Please try again later."
            : isQueueFull
            ? "The queue is full for today. Please come back tomorrow."
            : "Follow the steps below to get your queue token."}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.div animate={{ backgroundColor: step >= s.n ? "#16a34a" : "#e5e7eb", scale: step === s.n ? 1.1 : 1 }} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm">
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </motion.div>
              <span className={`text-xs font-semibold hidden sm:block ${step === s.n ? "text-green-700" : step > s.n ? "text-green-500" : "text-gray-400"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-1 rounded-full transition-colors ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-5"><Stethoscope className="w-5 h-5 text-green-600" /><h2 className="font-bold text-gray-900">Select Service / Reason for Visit</h2></div>
              <div className="grid sm:grid-cols-2 gap-3">
                {SERVICES.map((service) => (
                  <motion.button 
                    key={service.id} 
                    whileHover={{ scale: (isQueuePaused || isQueueFull) ? 1 : 1.02 }} 
                    whileTap={{ scale: (isQueuePaused || isQueueFull) ? 1 : 0.98 }} 
                    onClick={() => {
                      if (isQueuePaused) {
                        showToast("Queue Paused", "The clinic queue is currently paused. Please try again later.", "warning");
                        return;
                      }
                      if (isQueueFull) {
                        showToast("Queue Full", "The clinic has reached its daily patient limit. Please come back tomorrow.", "warning");
                        return;
                      }
                      setSelectedService(service.id);
                    }} 
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      selectedService === service.id 
                        ? "border-green-500 bg-green-50 shadow-md" 
                        : (isQueuePaused || isQueueFull) 
                          ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed" 
                          : "border-gray-100 hover:border-green-200 hover:bg-green-50/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedService === service.id ? "bg-green-500 text-white" : "bg-green-50 text-green-600"}`}>
                        <service.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{service.label}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />{service.wait}
                          </span>
                        </div>
                      </div>
                      {selectedService === service.id && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <motion.button 
                whileTap={{ scale: (isQueuePaused || isQueueFull) ? 1 : 0.97 }} 
                onClick={() => { 
                  if (isQueuePaused) {
                    showToast("Queue Paused", "The clinic queue is currently paused. Please try again later.", "warning");
                    return;
                  }
                  if (isQueueFull) {
                    showToast("Queue Full", "The clinic has reached its daily patient limit. Please come back tomorrow.", "warning");
                    return;
                  }
                  if (selectedService) setStep(2); 
                  else showToast("Service Required", "Please select a service to continue.", "error"); 
                }} 
                disabled={!selectedService || isQueuePaused || isQueueFull} 
                className={`flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all`}
              >
                Next: Fill Intake Form <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-green-600" /><h2 className="font-bold text-gray-900">Digital Intake Form</h2></div>
              <p className="text-xs text-gray-400 mb-5">This information helps the doctor prepare before your consultation.</p>
              <div className="bg-green-50 rounded-2xl px-4 py-3 flex items-center gap-2 mb-5">
                <Stethoscope className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{selectedServiceObj?.label || "General"}</span>
              </div>
              <div className="space-y-5">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Chief Complaint <span className="text-red-400">*</span></label>
                  <textarea required value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} placeholder="Describe your main health concern..." rows={3} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                </div>
                
                <div><label className="block text-sm font-semibold text-gray-700 mb-3">Symptoms (check all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOM_OPTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => toggleSymptom(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${symptoms.includes(s) ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-600"}`}>
                        {symptoms.includes(s) && <CheckCircle className="w-3 h-3 inline mr-1" />}{s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-gray-700 mb-2">Duration of Symptoms</label>
                    <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Select duration</option>
                      <option>Less than 24 hours</option>
                      <option>1–3 days</option>
                      <option>4–7 days</option>
                      <option>1–2 weeks</option>
                      <option>More than 2 weeks</option>
                    </select>
                  </div>
                  <div><label className="block text-sm font-semibold text-gray-700 mb-2">Pain/Discomfort Level (1–10)</label>
                    <input type="range" min="1" max="10" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full accent-green-500 mt-3" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Mild (1)</span>
                      <span className="text-green-700 font-bold">{form.severity}/10</span>
                      <span>Severe (10)</span>
                    </div>
                  </div>
                </div>

                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Known Allergies</label>
                  <input type="text" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g., Penicillin, Aspirin (or 'None')" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Current Medications</label>
                  <input type="text" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} placeholder="e.g., Metformin 500mg (or 'None')" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-6 py-3.5 rounded-2xl hover:bg-gray-50 transition-all"><ChevronLeft className="w-5 h-5" /> Back</button>
              <motion.button 
                whileTap={{ scale: (isQueuePaused || isQueueFull) ? 1 : 0.97 }} 
                onClick={handleSubmit} 
                disabled={!form.chiefComplaint || loading || isQueuePaused || isQueueFull} 
                className={`flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg disabled:opacity-40 hover:shadow-xl transition-all ${(isQueuePaused || isQueueFull) ? 'cursor-not-allowed' : ''}`}
              >
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</> : isQueuePaused ? "Queue Paused" : isQueueFull ? "Queue Full" : <>Generate Queue Token <ChevronRight className="w-5 h-5" /></>}
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 3 && queueToken && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">You're in the Queue!</h2>
            <p className="text-gray-500 text-sm mb-8">Your queue token has been generated successfully.</p>

            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-8 text-white shadow-2xl mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-200" />
                    <span className="text-sm font-semibold text-green-100">Active Queue Token</span>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(displayStatus)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${getStatusDotColor(displayStatus)}`} />
                    {getStatusLabel(displayStatus)}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-green-200 text-xs uppercase tracking-widest mb-1">Your Token</p>
                    <p className="text-6xl font-black leading-none">{queueToken.token}</p>
                    <p className="text-green-200 text-sm mt-2 font-semibold">
                      {displayService}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-200 text-xs">Status</p>
                    <p className="text-2xl font-black mt-1 capitalize">
                      {getStatusLabel(displayStatus)}
                    </p>
                    <p className="text-green-200 text-xs mt-1">
                      Est. Wait: ~{queueToken.estimatedWait} min
                    </p>
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
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/patient/queue/monitor")} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                <Clock className="w-5 h-5" /> Track Live Queue
              </motion.button>
              <button onClick={() => navigate("/patient/dashboard")} className="flex-1 border-2 border-green-200 text-green-700 font-semibold py-3.5 rounded-2xl hover:bg-green-50 flex items-center justify-center gap-2">
                <User className="w-5 h-5" /> Go to Dashboard
              </button>
            </div>
            
            <div className="mt-6 text-xs text-gray-400">
              Want to leave the queue?{" "}
              <button 
                onClick={handleCancelQueue} 
                disabled={loading}
                className="text-red-500 font-semibold hover:text-red-600 inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Cancel Queue
              </button>
            </div>
          </motion.div>
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
              <div className="p-6 bg-red-50 border-b border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{confirmModal.title}</h3>
                    <p className="text-sm text-gray-500">Token #{queueToken?.token || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed">
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
                    className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? (
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
