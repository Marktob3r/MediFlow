import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { UserPlus, CheckCircle, Search, Stethoscope, Clock, AlertCircle, Heart, Timer, Sparkles, Pill, Star } from "lucide-react";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const SERVICES = [
  { id: "general", label: "General Consultation", wait: "~25 min" },
  { id: "checkup", label: "Physical Check-up", wait: "~35 min" },
  { id: "pediatrics", label: "Pediatrics", wait: "~20 min" },
  { id: "vaccination", label: "Vaccination / Immunization", wait: "~15 min" },
  { id: "ophthalmology", label: "Eye Consultation", wait: "~40 min" },
  { id: "prescription", label: "Prescription Renewal", wait: "~10 min" },
];

const SYMPTOM_OPTIONS = [
  "Fever", "Cough", "Colds / Runny Nose", "Headache", "Body Pain",
  "Vomiting / Nausea", "Diarrhea", "Dizziness", "Shortness of Breath",
  "Chest Pain", "Rash / Skin Irritation", "Eye Discomfort",
  "Ear Pain", "Toothache", "Urinary Issues", "Other",
];

export default function WalkInRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<"search" | "form" | "done">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState<boolean | null>(null);
  const [generatedToken, setGeneratedToken] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    age: "",
    gender: "Male",
    service: "",
    chiefComplaint: "",
    severity: "3",
    isUrgent: false,
    symptoms: [] as string[],
    duration: "",
    allergies: "",
    medications: "",
  });

  const toggleSymptom = (s: string) => {
    setForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s) 
        ? prev.symptoms.filter(x => x !== s) 
        : [...prev.symptoms, s]
    }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showToast("Error", "Please enter a name or phone number to search", "error");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, first_name, last_name, email, phone, age, gender")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const foundUser = data[0];
        showToast("Patient Found", `Found ${foundUser.first_name} ${foundUser.last_name}`, "success");
        setIsNewPatient(false);
        
        // Auto-fill all patient information including age and gender
        setForm(prev => ({
          ...prev,
          firstName: foundUser.first_name || "",
          lastName: foundUser.last_name || "",
          email: foundUser.email || "",
          phone: foundUser.phone || "",
          age: foundUser.age ? String(foundUser.age) : "",
          gender: foundUser.gender || "Male",
        }));
        setStep("form");
      } else {
        setIsNewPatient(true);
        setStep("form");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      showToast("Error", "Failed to search for patient", "error");
    } finally {
      setLoading(false);
    }
  };

  // ========== INCREMENT FUNCTION FOR POSTGRES ==========
  const incrementQueueNumbers = async (fromNumber: number) => {
    try {
      const { data: patientsToShift, error: fetchError } = await supabase
        .from("patient_queues")
        .select("id, queue_number")
        .in("status", ["waiting", "serving"])
        .gte("queue_number", fromNumber)
        .order("queue_number", { ascending: false });

      if (fetchError) {
        console.error("Error fetching patients to shift:", fetchError);
        return false;
      }

      if (!patientsToShift || patientsToShift.length === 0) {
        return true;
      }

      for (const patient of patientsToShift) {
        const { error: updateError } = await supabase
          .from("patient_queues")
          .update({ queue_number: patient.queue_number + 1 })
          .eq("id", patient.id);

        if (updateError) {
          console.error("Error shifting patient:", updateError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error incrementing queue numbers:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!form.firstName || !form.lastName || !form.service || !form.chiefComplaint) {
        throw new Error("Please fill in all required fields");
      }

      let patientUserId = null;

      if (isNewPatient) {
        if (form.email) {
          const { data: existingAuthUser } = await supabase
            .from("user_profiles")
            .select("user_id")
            .eq("email", form.email)
            .single();

          if (existingAuthUser) {
            patientUserId = existingAuthUser.user_id;
          }
        }

        if (!patientUserId) {
          const tempPassword = Math.random().toString(36).slice(-8) + "Temp123!";
          const email = form.email || `${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}@temp.mediflow.com`;

          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
              data: {
                first_name: form.firstName,
                last_name: form.lastName,
                phone: form.phone || null,
                role: "patient",
              },
            },
          });

          if (authError) {
            console.error("Auth error:", authError);
            throw new Error(`Failed to create user: ${authError.message}`);
          }

          if (!authData.user) {
            throw new Error("Failed to create user account");
          }

          patientUserId = authData.user.id;

          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({
              user_id: patientUserId,
              role: "patient"
            });

          if (roleError) {
            console.error("Role error:", roleError);
          }

          // ========== SAVE ALL PATIENT INFORMATION ==========
          const { error: profileError } = await supabase
            .from("user_profiles")
            .insert({
              user_id: patientUserId,
              email: email,
              first_name: form.firstName,
              last_name: form.lastName,
              phone: form.phone || null,
              age: form.age ? parseInt(form.age) : null,
              gender: form.gender || null,
            });

          if (profileError && profileError.code !== "23505") {
            console.error("Profile error:", profileError);
          }
        }
      } else {
        // For existing patients, find their user_id
        const { data: existingUser, error: findError } = await supabase
          .from("user_profiles")
          .select("user_id")
          .eq("first_name", form.firstName)
          .eq("last_name", form.lastName)
          .single();
        
        if (findError) {
          if (form.email) {
            const { data: emailUser } = await supabase
              .from("user_profiles")
              .select("user_id")
              .eq("email", form.email)
              .single();
            
            if (emailUser) {
              patientUserId = emailUser.user_id;
            }
          }
          
          if (!patientUserId) {
            throw new Error("Patient not found. Please register as new patient.");
          }
        } else {
          patientUserId = existingUser.user_id;
        }

        // Update patient's age and gender if provided
        if (patientUserId && (form.age || form.gender)) {
          const updateData: any = {};
          if (form.age) updateData.age = parseInt(form.age);
          if (form.gender) updateData.gender = form.gender;
          
          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from("user_profiles")
              .update(updateData)
              .eq("user_id", patientUserId);
            
            if (updateError) {
              console.error("Error updating patient info:", updateError);
            }
          }
        }
      }

      if (!patientUserId) {
        throw new Error("Could not find or create patient account");
      }

      const selectedService = SERVICES.find(s => s.id === form.service);
      const serviceLabel = selectedService?.label || "Consultation";

      const notesData = JSON.stringify({
        service: serviceLabel,
        complaint: form.chiefComplaint,
        symptoms: form.symptoms,
        duration: form.duration,
        severity: form.severity,
        allergies: form.allergies || "None",
        medications: form.medications || "None",
        isPriority: isPriority,
      });

      // ========== QUEUE NUMBER LOGIC ==========
      let queueNumber = 1;

      const { data: allQueue, error: allError } = await supabase
        .from("patient_queues")
        .select("queue_number, notes, created_at")
        .in("status", ["waiting", "serving"])
        .order("queue_number", { ascending: true });

      if (allError) throw allError;

      const priorityPatients: any[] = [];
      const regularPatients: any[] = [];

      if (allQueue && allQueue.length > 0) {
        for (const entry of allQueue) {
          try {
            const parsed = JSON.parse(entry.notes || "{}");
            if (parsed.isPriority === true) {
              priorityPatients.push(entry);
            } else {
              regularPatients.push(entry);
            }
          } catch (e) {
            regularPatients.push(entry);
          }
        }
      }

      if (isPriority) {
        if (priorityPatients.length > 0) {
          const maxPriorityNumber = Math.max(...priorityPatients.map(p => p.queue_number));
          const insertPosition = maxPriorityNumber + 1;
          
          if (insertPosition <= (allQueue?.length || 0) + 1) {
            const shiftSuccess = await incrementQueueNumbers(insertPosition);
            if (!shiftSuccess) {
              throw new Error("Failed to shift queue for priority patient");
            }
          }
          queueNumber = insertPosition;
        } else {
          if (regularPatients.length > 0) {
            const firstRegularNumber = regularPatients[0].queue_number;
            const shiftSuccess = await incrementQueueNumbers(firstRegularNumber);
            if (!shiftSuccess) {
              throw new Error("Failed to shift queue for priority patient");
            }
            queueNumber = firstRegularNumber;
          } else {
            queueNumber = 1;
          }
        }
      } else {
        if (allQueue && allQueue.length > 0) {
          const maxNumber = Math.max(...allQueue.map(p => p.queue_number));
          queueNumber = maxNumber + 1;
        } else {
          queueNumber = 1;
        }
      }

      const { error: queueError } = await supabase
        .from("patient_queues")
        .insert({
          patient_id: patientUserId,
          queue_number: queueNumber,
          status: "waiting",
          notes: notesData,
          created_at: new Date().toISOString(),
        });

      if (queueError) {
        console.error("Queue error:", queueError);
        throw new Error(`Failed to add to queue: ${queueError.message}`);
      }

      setGeneratedToken(String(queueNumber).padStart(3, '0'));
      setStep("done");
      
      const priorityMessage = isPriority ? " (Priority Patient)" : "";
      showToast("Success", `Patient added to queue with token ${String(queueNumber).padStart(3, '0')}${priorityMessage}`, "success");

    } catch (error: any) {
      console.error("Registration error:", error);
      showToast("Error", error.message || "Failed to register walk-in", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceObj = SERVICES.find(s => s.id === form.service);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Walk-in Registration</h1>
        <p className="text-gray-500 text-sm">Register a walk-in patient and add them to today's queue.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === "search" && (
          <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-5">
              <h3 className="font-bold text-gray-900 mb-2">Search Existing Patient</h3>
              <p className="text-sm text-gray-500 mb-5">Search to check if the patient is already registered in the system.</p>
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleSearch} disabled={loading} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                  Search Patient
                </button>
                <button onClick={() => { setIsNewPatient(true); setStep("form"); }} className="flex-1 border-2 border-green-200 text-green-700 font-semibold py-3 rounded-2xl hover:bg-green-50">
                  New Patient →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {isNewPatient && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700 font-medium">New patient — an account will be created in the system.</p>
              </div>
            )}
            
            {!isNewPatient && (
              <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <p className="text-sm text-green-700 font-medium">
                  Existing patient: <strong>{form.firstName} {form.lastName}</strong> — information auto-filled.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5 mb-5">
                <h3 className="font-bold text-gray-900">Patient Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">First Name *</label>
                    <input 
                      required 
                      value={form.firstName} 
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
                      placeholder="First name" 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isNewPatient ? 'text-gray-700 cursor-not-allowed' : ''}`}
                      readOnly={!isNewPatient}
                    />
                    {!isNewPatient && (
                      <p className="text-[10px] text-gray-400 mt-1">Auto-filled from existing record</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Last Name *</label>
                    <input 
                      required 
                      value={form.lastName} 
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
                      placeholder="Last name" 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isNewPatient ? 'text-gray-700 cursor-not-allowed' : ''}`}
                      readOnly={!isNewPatient}
                    />
                    {!isNewPatient && (
                      <p className="text-[10px] text-gray-400 mt-1">Auto-filled from existing record</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={form.email} 
                      onChange={(e) => setForm({ ...form, email: e.target.value })} 
                      placeholder="patient@email.com" 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isNewPatient ? 'text-gray-700 cursor-not-allowed' : ''}`}
                      readOnly={!isNewPatient}
                    />
                    {!isNewPatient && (
                      <p className="text-[10px] text-gray-400 mt-1">Auto-filled from existing record</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone</label>
                    <input 
                      value={form.phone} 
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                      placeholder="+63 9XX..." 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isNewPatient ? 'text-gray-700 cursor-not-allowed' : ''}`}
                      readOnly={!isNewPatient}
                    />
                    {!isNewPatient && (
                      <p className="text-[10px] text-gray-400 mt-1">Auto-filled from existing record</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Age</label>
                    <input 
                      type="number" 
                      value={form.age} 
                      onChange={(e) => setForm({ ...form, age: e.target.value })} 
                      placeholder="Age" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    {!isNewPatient && form.age && (
                      <p className="text-[10px] text-green-600 mt-1">✓ Auto-filled from record</p>
                    )}
                    {!isNewPatient && !form.age && (
                      <p className="text-[10px] text-amber-500 mt-1">⚠️ No age saved - enter manually</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gender</label>
                    <select 
                      value={form.gender} 
                      onChange={(e) => setForm({ ...form, gender: e.target.value })} 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                    {!isNewPatient && form.gender && (
                      <p className="text-[10px] text-green-600 mt-1">✓ Auto-filled from record</p>
                    )}
                    {!isNewPatient && !form.gender && (
                      <p className="text-[10px] text-amber-500 mt-1">⚠️ No gender saved - select manually</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Select Service / Reason for Visit *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setForm({ ...form, service: service.id })}
                        className={`p-3 rounded-2xl border-2 text-left transition-all ${
                          form.service === service.id
                            ? "border-green-500 bg-green-50 shadow-md"
                            : "border-gray-100 hover:border-green-200 hover:bg-green-50/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Stethoscope className={`w-4 h-4 ${form.service === service.id ? "text-green-600" : "text-gray-400"}`} />
                          <div>
                            <p className={`text-sm font-semibold ${form.service === service.id ? "text-green-700" : "text-gray-700"}`}>{service.label}</p>
                            <p className="text-xs text-gray-400">{service.wait}</p>
                          </div>
                          {form.service === service.id && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chief Complaint <span className="text-red-400">*</span></label>
                  <textarea
                    required
                    value={form.chiefComplaint}
                    onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                    placeholder="Describe the patient's main health concern..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
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
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          form.symptoms.includes(s)
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-600"
                        }`}
                      >
                        {form.symptoms.includes(s) && <CheckCircle className="w-3 h-3 inline mr-1" />}
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

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Known Allergies</label>
                    <input
                      type="text"
                      value={form.allergies}
                      onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                      placeholder="e.g., Penicillin, Aspirin (or 'None')"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Medications</label>
                    <input
                      type="text"
                      value={form.medications}
                      onChange={(e) => setForm({ ...form, medications: e.target.value })}
                      placeholder="e.g., Metformin 500mg (or 'None')"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="button" 
                  onClick={() => setStep("search")} 
                  className="sm:w-auto border-2 border-gray-200 text-gray-600 font-semibold px-6 py-3.5 rounded-2xl hover:bg-gray-50 text-sm"
                >
                  Back
                </button>
                
                <div className="flex-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPriority(!isPriority)}
                    className={`px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center gap-2 flex-shrink-0 ${
                      isPriority
                        ? "bg-amber-500 text-white shadow-md hover:bg-amber-600"
                        : "bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50"
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isPriority ? "text-white" : "text-amber-500"}`} />
                    {isPriority ? "Priority ON" : "Priority"}
                  </button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading || !form.firstName || !form.lastName || !form.service || !form.chiefComplaint}
                    className={`flex-1 text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${
                      isPriority 
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    }`}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {isPriority ? <Star className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        {isPriority ? "Add Priority Patient" : "Add to Queue"}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Patient Added!</h2>
            <p className="text-gray-500 mb-6">
              {form.firstName} {form.lastName} has been added to today's queue.
              {isPriority && <span className="text-amber-600 font-semibold ml-1">(Priority Patient)</span>}
            </p>
            
            <div className={`bg-gradient-to-br ${isPriority ? 'from-amber-600 to-amber-700' : 'from-green-600 to-emerald-700'} rounded-3xl p-8 text-white shadow-xl mb-6 relative overflow-hidden`}>
              {isPriority && (
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              )}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-green-200 text-xs uppercase tracking-widest">Queue Token</p>
                  {isPriority && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-amber-400/30 rounded-full text-amber-100">
                      <Star className="w-3 h-3" /> Priority
                    </span>
                  )}
                </div>
                <p className="text-8xl font-black">{generatedToken}</p>
                <div className="mt-4 flex justify-center gap-8 text-sm">
                  <div>
                    <p className="text-green-200 text-xs">Service</p>
                    <p className="font-semibold">{selectedServiceObj?.label || "General"}</p>
                  </div>
                  <div>
                    <p className="text-green-200 text-xs">Est. Wait</p>
                    <p className="font-semibold">{isPriority ? "~5 min" : selectedServiceObj?.wait || "~15 min"}</p>
                  </div>
                  <div>
                    <p className="text-green-200 text-xs">Position</p>
                    <p className="font-semibold">#{generatedToken}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("search");
                  setForm({
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    age: "",
                    gender: "Male",
                    service: "",
                    chiefComplaint: "",
                    severity: "3",
                    isUrgent: false,
                    symptoms: [],
                    duration: "",
                    allergies: "",
                    medications: "",
                  });
                  setGeneratedToken("");
                  setIsPriority(false);
                }}
                className="flex-1 border-2 border-green-200 text-green-700 font-semibold py-3.5 rounded-2xl hover:bg-green-50"
              >
                Register Another
              </button>
              <button
                onClick={() => navigate("/staff/dashboard")}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" /> View Queue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 
