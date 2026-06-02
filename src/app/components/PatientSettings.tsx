import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Save,
  Lock,
  Calendar,
  Heart,
  Users,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useToast } from "../../contexts/ToastContext";

export default function PatientSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    date_of_birth: "",
    gender: "",
    blood_type: "",
    emergency_contact: "",
    emergency_phone: "",
  });
  const [notifPrefs, setNotifPrefs] = useState({
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    notify_at_5: true,
    notify_at_2: true,
    queue_updates: true,
    prescription_reminders: true,
    appointment_reminders: true,
  });
  const [activeTab, setActiveTab] = useState<"profile" | "notifications" | "security">("profile");
  const [showNewPass, setShowNewPass] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchNotificationPrefs();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (patientError && patientError.code !== 'PGRST116') throw patientError;

      setProfile({
        first_name: profileData?.first_name || "",
        last_name: profileData?.last_name || "",
        email: profileData?.email || user?.email || "",
        phone: profileData?.phone || "",
        address: profileData?.address || "",
        date_of_birth: profileData?.date_of_birth || "",
        gender: profileData?.gender || "",
        blood_type: patientData?.blood_type || "",
        emergency_contact: patientData?.emergency_contact || "",
        emergency_phone: patientData?.emergency_phone || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationPrefs = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("patient_id", user?.id)
        .single();

      if (!error && data) {
        setNotifPrefs({
          push_enabled: data.push_enabled,
          email_enabled: data.email_enabled,
          sms_enabled: data.sms_enabled,
          notify_at_5: data.notify_at_5,
          notify_at_2: data.notify_at_2,
          queue_updates: data.queue_updates,
          prescription_reminders: data.prescription_reminders,
          appointment_reminders: data.appointment_reminders,
        });
      }
    } catch (error) {
      console.error("Error fetching notification prefs:", error);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          address: profile.address,
          date_of_birth: profile.date_of_birth || null,
          gender: profile.gender,
          email: user?.email,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user?.id);

      if (profileError) throw profileError;

      const { error: patientError } = await supabase
        .from("patients")
        .update({
          blood_type: profile.blood_type,
          emergency_contact: profile.emergency_contact,
          emergency_phone: profile.emergency_phone,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user?.id);

      if (patientError) throw patientError;

      showToast("Success", "Information saved successfully!", "success");
      setIsEditing(false);
    } catch (err: any) {
      showToast("Error", err.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          patient_id: user?.id,
          push_enabled: notifPrefs.push_enabled,
          email_enabled: notifPrefs.email_enabled,
          sms_enabled: notifPrefs.sms_enabled,
          notify_at_5: notifPrefs.notify_at_5,
          notify_at_2: notifPrefs.notify_at_2,
          queue_updates: notifPrefs.queue_updates,
          prescription_reminders: notifPrefs.prescription_reminders,
          appointment_reminders: notifPrefs.appointment_reminders,
          updated_at: new Date().toISOString(),
        })
        .eq("patient_id", user?.id);

      if (error) throw error;

      showToast("Success", "Notification preferences saved!", "success");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast("Error", "New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Error", "Password must be at least 6 characters", "error");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Success", "Password changed successfully!", "success");
    } catch (err: any) {
      showToast("Error", err.message || "Failed to change password", "error");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    // { id: "notifications", label: "Preferences", icon: Settings },
    { id: "security", label: "Security", icon: Shield },
  ] as const;

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-green-500" : "bg-gray-200"}`}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Settings & Personal Details</h1>
        <p className="text-gray-500 text-sm">Manage your profile, preferences, and security settings.</p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-5">Personal Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Last Name</label>
                <input
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full pl-9 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-2xl text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    maxLength={11}
                    pattern="\d{11}"
                    title="Must be exactly 11 digits"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    placeholder="09XXXXXXXXX"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={profile.date_of_birth || ""}
                    onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sex</label>
                <select
                  value={profile.gender || ""}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Blood Type</label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={profile.blood_type || ""}
                    onChange={(e) => setProfile({ ...profile, blood_type: e.target.value })}
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 appearance-none ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  >
                    <option value="">Select Blood Type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Home Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Enter your full address"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-5">Emergency Contact</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={profile.emergency_contact || ""}
                    onChange={(e) => setProfile({ ...profile, emergency_contact: e.target.value })}
                    placeholder="Emergency contact name"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    maxLength={11}
                    pattern="\d{11}"
                    title="Must be exactly 11 digits"
                    value={profile.emergency_phone || ""}
                    onChange={(e) => setProfile({ ...profile, emergency_phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    placeholder="09XXXXXXXXX"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!isEditing ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50"}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {isEditing ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg disabled:opacity-70"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Profile Changes
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <User className="w-4 h-4" /> Edit Personal Information
            </motion.button>
          )}
        </motion.div>
      )}


      {/* SECURITY TAB */}
      {activeTab === "security" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Change Password</h3>
            <p className="text-xs text-gray-400 mb-5">
              Use a strong password with at least 6 characters.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={saving || !newPassword}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50"
              >
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}