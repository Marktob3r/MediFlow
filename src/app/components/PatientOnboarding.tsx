import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { User, Heart, Users, CheckCircle, Activity, LogOut, AlertCircle, Calendar, Phone } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useToast } from "../../contexts/ToastContext";

export default function PatientOnboarding() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { showToast, clearToasts } = useToast();

  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingForm, setOnboardingForm] = useState({
    date_of_birth: "",
    gender: "",
    phone: "",
    blood_type: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
  });
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  // Auto-calculate age when date of birth changes
  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age : null;
  };

  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  const handleDateOfBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const age = calculateAge(dob);
    setCalculatedAge(age);
    setOnboardingForm({ ...onboardingForm, date_of_birth: dob });
  };

  // Lock body scroll and clear any lingering toasts on mount
  useEffect(() => {
    document.body.style.overflow = "hidden";
    clearToasts();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchPartialData();
    }
  }, [user]);

  const fetchPartialData = async () => {
    try {
      setLoading(true);
      
      // Check if user has a profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Profile fetch error:", profileError);
      }

      // Check if user has a patient record
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (patientError && patientError.code !== "PGRST116") {
        console.error("Patient fetch error:", patientError);
      }

      // Check if profile is complete
      const isProfileComplete =
        profileData?.date_of_birth &&
        profileData?.gender &&
        profileData?.address &&
        profileData?.phone;

      const isPatientComplete = patientData ? 
        patientData?.blood_type &&
        patientData?.emergency_contact &&
        patientData?.emergency_phone : false;

      if (isProfileComplete && isPatientComplete) {
        console.log("✅ Profile already complete, redirecting to dashboard...");
        navigate("/patient/dashboard", { replace: true });
        return;
      }

      // Set calculated age if date_of_birth exists
      if (profileData?.date_of_birth) {
        setCalculatedAge(calculateAge(profileData.date_of_birth));
      }

      setOnboardingForm({
        date_of_birth: profileData?.date_of_birth || "",
        gender: profileData?.gender || "",
        phone: profileData?.phone || "",
        blood_type: patientData?.blood_type || "",
        address: profileData?.address || "",
        emergency_contact: patientData?.emergency_contact || "",
        emergency_phone: patientData?.emergency_phone || "",
      });
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // ============================================================
  // ✅ FIXED: handleSaveOnboarding - Forces navigation to dashboard
  // ============================================================
  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (savingOnboarding) return;
    
    setSavingOnboarding(true);
    
    try {
      // Validation
      if (!onboardingForm.date_of_birth || !onboardingForm.gender || !onboardingForm.phone || 
          !onboardingForm.blood_type || !onboardingForm.address || 
          !onboardingForm.emergency_contact || !onboardingForm.emergency_phone) {
        throw new Error("Please fill in all required fields to continue.");
      }

      // Calculate age
      const ageToSave = calculateAge(onboardingForm.date_of_birth);

      // Get first_name and last_name from user object
      let firstName = user?.first_name || "";
      let lastName = user?.last_name || "";
      
      console.log("📝 User object from auth:", user);
      console.log("📝 First name from user:", firstName);
      console.log("📝 Last name from user:", lastName);
      
      // If user object doesn't have name, try to get from auth metadata
      if (!firstName || !lastName) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.user_metadata) {
            firstName = authData.user.user_metadata.first_name || "";
            lastName = authData.user.user_metadata.last_name || "";
          }
        } catch (authError) {
          console.warn("Could not fetch auth metadata:", authError);
        }
      }

      // Final fallback
      if (!firstName) firstName = "Patient";
      if (!lastName) lastName = "User";

      console.log("📝 Saving onboarding with name:", { firstName, lastName });

      // ============================================================
      // 1. Save/Update user_profiles
      // ============================================================
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user?.id,
          email: user?.email,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: onboardingForm.date_of_birth,
          age: ageToSave,
          gender: onboardingForm.gender,
          address: onboardingForm.address,
          phone: onboardingForm.phone,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error("❌ Profile update error:", profileError);
        throw new Error(`Profile save failed: ${profileError.message}`);
      }

      console.log("✅ User profile saved successfully with name");

      // ============================================================
      // 2. Try to save/update patients - but don't fail if it errors
      // ============================================================
      try {
        const { data: existingPatient } = await supabase
          .from("patients")
          .select("patient_id")
          .eq("user_id", user?.id)
          .maybeSingle();

        let patientId = existingPatient?.patient_id;
        if (!patientId) {
          const { data: latestPatient } = await supabase
            .from("patients")
            .select("patient_id")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (latestPatient?.patient_id) {
            const num = parseInt(latestPatient.patient_id.split('-')[2]) + 1;
            patientId = `PAT-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;
          } else {
            patientId = `PAT-${new Date().getFullYear()}-0001`;
          }
        }

        const { error: patientError } = await supabase
          .from("patients")
          .upsert({
            user_id: user?.id,
            patient_id: patientId,
            phone: onboardingForm.phone,
            date_of_birth: onboardingForm.date_of_birth,
            gender: onboardingForm.gender,
            address: onboardingForm.address,
            blood_type: onboardingForm.blood_type,
            emergency_contact: onboardingForm.emergency_contact,
            emergency_phone: onboardingForm.emergency_phone,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (patientError) {
          console.error("❌ Patient update error (non-fatal):", patientError);
        } else {
          console.log("✅ Patient record saved successfully");
        }
      } catch (patientErr) {
        console.error("❌ Patient update exception (non-fatal):", patientErr);
      }

      showToast("Profile Completed!", "Your information has been saved successfully.", "success");
      
      // ============================================================
      // ✅ FORCE NAVIGATION TO DASHBOARD - MULTIPLE METHODS
      // ============================================================
      console.log("🚀 Attempting to navigate to dashboard...");
      
      // Method 1: React Router navigate
      try {
        navigate("/patient/dashboard", { replace: true });
        console.log("✅ Navigation via React Router sent");
      } catch (navError) {
        console.error("❌ React Router navigation failed:", navError);
      }
      
      // Method 2: Window location (fallback)
      setTimeout(() => {
        console.log("🔄 Fallback: Using window.location.href...");
        window.location.href = "/patient/dashboard";
      }, 300);
      
      // Method 3: Direct location assign (final fallback)
      setTimeout(() => {
        console.log("🔄 Final fallback: Using window.location.assign...");
        window.location.assign("/patient/dashboard");
      }, 600);
      
    } catch (err: any) {
      console.error("❌ Save error:", err);
      showToast("Error", err.message || "Failed to complete onboarding", "error");
      setSavingOnboarding(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = [
    { id: 1, title: "Personal Info", icon: User },
    { id: 2, title: "Medical Info", icon: Heart },
    { id: 3, title: "Emergency Contact", icon: Users },
  ];
  const TOTAL_STEPS = 3;

  const canProceedStep1 = onboardingForm.date_of_birth && onboardingForm.gender && onboardingForm.phone.length === 11;
  const canProceedStep2 = onboardingForm.blood_type && onboardingForm.address.trim().length > 0;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed top-0 right-0 w-96 h-96 bg-green-100 rounded-full opacity-30 -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-0 w-80 h-80 bg-emerald-100 rounded-full opacity-30 translate-y-1/2 -translate-x-1/2 blur-3xl" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-gray-900 text-lg">MediFlow</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Page body */}
      <div className="flex flex-col items-center justify-center px-4 pb-10 min-h-[calc(100vh-64px)]">
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
            <p className="text-gray-500 text-sm mt-2 px-4">
              {onboardingStep === 1 && "We need your basic personal information to create your patient record."}
              {onboardingStep === 2 && "Your medical information helps our staff provide better care."}
              {onboardingStep === 3 && "Add an emergency contact in case we need to reach someone on your behalf."}
            </p>
          </motion.div>

          {/* Step indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-0">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 flex-shrink-0 ${
                    s.id < onboardingStep
                      ? "bg-green-500 text-white"
                      : s.id === onboardingStep
                      ? "bg-gray-900 text-white ring-4 ring-gray-900/10"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {s.id < onboardingStep ? <CheckCircle className="w-4 h-4" /> : s.id}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-16 h-0.5 rounded-full overflow-hidden bg-gray-200 mx-1">
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
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-green-900/5 border border-gray-100 overflow-hidden">
            <AnimatePresence mode="wait">

              {/* Step 1: Personal Info */}
              {onboardingStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 space-y-5"
                >
                  {/* Display user's name from auth */}
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <User className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.first_name || "Patient"} {user?.last_name || ""}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Date of Birth *</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        required
                        value={onboardingForm.date_of_birth}
                        onChange={handleDateOfBirthChange}
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                    {onboardingForm.date_of_birth && calculatedAge !== null && (
                      <p className="text-xs text-green-600 mt-1.5 ml-1">Age: {calculatedAge} years old</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Biological Sex *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOnboardingForm({ ...onboardingForm, gender: "Male" })}
                        className={`py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all ${
                          onboardingForm.gender === "Male"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        ♂ Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnboardingForm({ ...onboardingForm, gender: "Female" })}
                        className={`py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all ${
                          onboardingForm.gender === "Female"
                            ? "border-pink-400 bg-pink-50 text-pink-600"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        ♀ Female
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono">🇵🇭</span>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={onboardingForm.phone}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        placeholder="09XXXXXXXXX"
                        className="w-full pl-16 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                    {onboardingForm.phone.length > 0 && onboardingForm.phone.length < 11 && (
                      <p className="text-xs text-amber-500 mt-1.5 ml-1">{11 - onboardingForm.phone.length} more digits needed</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Medical Info */}
              {onboardingStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 space-y-5"
                >
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Blood Type *</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bt) => (
                        <button
                          key={bt}
                          type="button"
                          onClick={() => setOnboardingForm({ ...onboardingForm, blood_type: bt })}
                          className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                            onboardingForm.blood_type === bt
                              ? "border-red-400 bg-red-50 text-red-600 shadow-sm"
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {bt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Home Address *</label>
                    <textarea
                      required
                      rows={3}
                      value={onboardingForm.address}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, address: e.target.value })}
                      placeholder="House No., Street, Barangay, City/Municipality, Province"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Emergency Contact */}
              {onboardingStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 space-y-5"
                >
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Please provide someone we can contact in case of an emergency — a family member, spouse, or close friend.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={onboardingForm.emergency_contact}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_contact: e.target.value })}
                      placeholder="e.g. Maria Santos"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono">🇵🇭</span>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={onboardingForm.emergency_phone}
                        onChange={(e) => setOnboardingForm({ ...onboardingForm, emergency_phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        placeholder="09XXXXXXXXX"
                        className="w-full pl-16 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Navigation footer */}
            <div className="px-6 sm:px-7 pb-6 flex gap-3">
              {onboardingStep > 1 && (
                <button
                  type="button"
                  onClick={() => setOnboardingStep(s => s - 1)}
                  className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all active:scale-[0.98]"
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
                  className="flex-1 py-3.5 rounded-2xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingOnboarding || !onboardingForm.emergency_contact || onboardingForm.emergency_phone.length < 11}
                  onClick={handleSaveOnboarding}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow hover:shadow-lg hover:shadow-green-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <p className="text-center text-xs text-gray-400 mt-6 px-4">
            Your information is stored securely and is only accessible to authorised clinic staff.
          </p>
        </div>
      </div>
    </div>
  );
}
