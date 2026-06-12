import { useState } from "react";
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
  Printer,
  Bell,
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

const STEPS = [
  { n: 1, label: "Select Service" },
  { n: 2, label: "Intake Form" },
  { n: 3, label: "Queue Token" },
];

export default function JoinQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueToken, setQueueToken] = useState<any>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState({
    chiefComplaint: "",
    duration: "",
    severity: "3",
    allergies: "",
    medications: "",
    additionalNotes: "",
  });

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const generateToken = async () => {
    if (!user) {
      showToast("Error", "Please login to join the queue", "error");
      return;
    }

    setLoading(true);
    try {
      const selectedServiceObj = SERVICES.find(s => s.id === selectedService);

      if (!selectedServiceObj) {
        throw new Error("Please select a service");
      }

      if (!form.chiefComplaint) {
        throw new Error("Please fill in the chief complaint");
      }

      console.log("Creating queue entry for user:", user.id);

      // Create queue entry - let the database trigger generate token and queue_number
      const { data, error } = await supabase
        .from("queue_entries")
        .insert({
          patient_id: user.id,
          patient_name: `${user.first_name} ${user.last_name}`,
          service: selectedServiceObj.label,
          service_type: selectedService,
          status: "waiting",
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Failed to create queue entry");
      }

      console.log("Queue entry created:", data);

      // Get queue position
      const { count: aheadCount } = await supabase
        .from("queue_entries")
        .select("*", { count: 'exact', head: true })
        .eq("status", "waiting")
        .lt("created_at", data.created_at);

      setQueueToken({
        token: data.token,
        service: selectedServiceObj.label,
        position: data.position,
        estimatedWait: (aheadCount || 0) * 8 + 15,
        date: new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }),
      });

      setStep(3);
    } catch (err: any) {
      console.error("Error generating token:", err);
      showToast("Error", err.message || "Failed to generate queue token. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    generateToken();
  };

  const handleCancel = async () => {
    if (queueToken) {
      await supabase
        .from("queue_entries")
        .delete()
        .eq("token", queueToken.token);
    }
    navigate("/patient/dashboard");
  };

  const selectedServiceObj = SERVICES.find(s => s.id === selectedService);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Join Today's Queue</h1>
        <p className="text-gray-500 text-sm">Follow the steps below to get your queue token.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{
                  backgroundColor: step >= s.n ? "#16a34a" : "#e5e7eb",
                  scale: step === s.n ? 1.1 : 1,
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
              >
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </motion.div>
              <span className={`text-xs font-semibold hidden sm:block ${step === s.n ? "text-green-700" : step > s.n ? "text-green-500" : "text-gray-400"
                }`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-1 rounded-full transition-colors ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: SELECT SERVICE */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <Stethoscope className="w-5 h-5 text-green-600" />
                <h2 className="font-bold text-gray-900">Select Service / Reason for Visit</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {SERVICES.map((service) => (
                  <motion.button
                    key={service.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedService(service.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedService === service.id
                        ? "border-green-500 bg-green-50 shadow-md"
                        : "border-gray-100 hover:border-green-200 hover:bg-green-50/30"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedService === service.id ? "bg-green-500 text-white" : "bg-green-50 text-green-600"
                        }`}>
                        <service.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{service.label}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {service.wait}
                          </span>
                        </div>
                      </div>
                      {selectedService === service.id && (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (selectedService) {
                    setStep(2);
                  } else {
                    showToast("Service Required", "Please select a service to continue.", "error");
                  }
                }}
                disabled={!selectedService}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transition-all"
              >
                Next: Fill Intake Form <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: INTAKE FORM */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <h2 className="font-bold text-gray-900">Digital Intake Form</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                This information helps the doctor prepare before your consultation.
                Your data is securely encrypted and confidential.
              </p>

              <div className="bg-green-50 rounded-2xl px-4 py-3 flex items-center gap-2 mb-5">
                <Stethoscope className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{selectedServiceObj?.label}</span>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Chief Complaint <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={form.chiefComplaint}
                    onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                    placeholder="Describe your main health concern in your own words..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Symptoms (check all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOM_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSymptom(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${symptoms.includes(s)
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-600"
                          }`}
                      >
                        {symptoms.includes(s) && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration of Symptoms</label>
                    <select
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="">Select duration</option>
                      <option>Less than 24 hours</option>
                      <option>1–3 days</option>
                      <option>4–7 days</option>
                      <option>1–2 weeks</option>
                      <option>More than 2 weeks</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pain/Discomfort Level (1–10)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                      className="w-full accent-green-500 mt-3"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Mild (1)</span>
                      <span className="text-green-700 font-bold">{form.severity}/10</span>
                      <span>Severe (10)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Known Allergies</label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                    placeholder="e.g., Penicillin, Aspirin, Shellfish (or 'None')"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Current Medications</label>
                  <input
                    type="text"
                    value={form.medications}
                    onChange={(e) => setForm({ ...form, medications: e.target.value })}
                    placeholder="e.g., Metformin 500mg, Losartan 50mg (or 'None')"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes for the Doctor</label>
                  <textarea
                    value={form.additionalNotes}
                    onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                    placeholder="Anything else you'd like the doctor to know..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-6 py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!form.chiefComplaint || loading}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg disabled:opacity-40 hover:shadow-xl transition-all"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                ) : (
                  <>Generate Queue Token <ChevronRight className="w-5 h-5" /></>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: QUEUE TOKEN */}
        {step === 3 && queueToken && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-10 h-10 text-green-500" />
            </motion.div>

            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">You're in the Queue!</h2>
            <p className="text-gray-500 text-sm mb-8">Your queue token has been generated successfully.</p>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl p-8 text-white shadow-2xl mb-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-green-200 text-xs uppercase tracking-widest">Clinic</p>
                    <p className="font-bold text-sm mt-0.5">S.P. Dizon Medical Clinic</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-200 text-xs uppercase tracking-widest">Date</p>
                    <p className="font-semibold text-xs mt-0.5">{queueToken.date}</p>
                  </div>
                </div>

                <div className="text-center py-6 bg-white/10 rounded-2xl mb-6">
                  <p className="text-green-200 text-xs uppercase tracking-widest mb-2">Queue Token</p>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="text-8xl font-black leading-none"
                  >
                    {queueToken.token}
                  </motion.p>
                  <p className="text-green-200 text-sm mt-3">Position #{queueToken.position} in queue</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-green-200 text-xs">Service</p>
                    <p className="font-semibold text-sm mt-0.5">{queueToken.service}</p>
                  </div>
                  <div>
                    <p className="text-green-200 text-xs">Est. Wait</p>
                    <p className="font-semibold text-sm mt-0.5">~{queueToken.estimatedWait} min</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/patient/queue/monitor")}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" /> Track Live Queue
              </motion.button>
              <button
                onClick={() => navigate("/patient/dashboard")}
                className="flex-1 border-2 border-green-200 text-green-700 font-semibold py-3.5 rounded-2xl hover:bg-green-50 flex items-center justify-center gap-2"
              >
                <User className="w-5 h-5" /> Go to Dashboard
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              Want to leave the queue?{" "}
              <button onClick={handleCancel} className="text-red-500 font-semibold hover:text-red-600 inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Cancel Queue
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}