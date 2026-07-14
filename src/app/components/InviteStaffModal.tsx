import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus, Mail, X, Building2, Stethoscope,
  ChevronDown, Send, AlertCircle, Shield, User, CheckCircle
} from "lucide-react";
import { inviteStaffMember } from "../../services/adminApi";
import { useToast } from "../../contexts/ToastContext";

type InviteStaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const DEPARTMENTS = ["Front Desk", "Medical", "Laboratory", "Pharmacy", "Administration"];

export default function InviteStaffModal({ isOpen, onClose, onSuccess }: InviteStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "staff" as "staff" | "admin",
    department: "Front Desk",
    specialization: "",
  });

  const reset = () =>
    setFormData({ email: "", firstName: "", lastName: "", role: "staff", department: "Front Desk", specialization: "" });

  const handleClose = () => { onClose(); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get values with proper types
    const firstName: string = formData.firstName.trim();
    const lastName: string = formData.lastName.trim();
    const email: string = formData.email.trim();
    const role: "staff" | "admin" = formData.role;
    const department: string = formData.department || "Front Desk";
    const specialization: string = formData.specialization || "";
    
    if (!firstName || !lastName || !email) {
      showToast("Error", "Please fill in all required fields.", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await inviteStaffMember({
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        department: department,
        specialization: specialization,
      });

      // ✅ FIX: Check success first, then access the appropriate property
      if (result.success && result.message) {
        showToast("Success", result.message, "success");
        onSuccess();
        handleClose();
      } else if (result.error) {
        showToast("Error", result.error, "error");
      } else {
        showToast("Error", "Failed to send invitation. Please try again.", "error");
      }
    } catch (error: any) {
      showToast("Error", error.message || "Failed to send invitation.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative px-6 py-5 border-b border-gray-100">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 text-base leading-tight">Invite Staff Member</h2>
                      <p className="text-gray-500 text-xs mt-0.5">Send invitation to user's personal email</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="e.g. Maria"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="e.g. Santos"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Personal Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="user@gmail.com"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Send invitation to the user's personal email address.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    <Shield className="w-3 h-3 inline mr-1" />Role <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: "staff" })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all ${
                        formData.role === "staff"
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        formData.role === "staff" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm">Staff</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: "admin" })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all ${
                        formData.role === "admin"
                          ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        formData.role === "admin" ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-500"
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm">Admin</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {formData.role === "admin" 
                      ? "Admins have full access to all settings and can manage other users." 
                      : "Staff have limited access to daily operations."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      <Building2 className="w-3 h-3 inline mr-1" />Department
                    </label>
                    <div className="relative">
                      <select
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                        className="w-full appearance-none px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all pr-10"
                      >
                        {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      <Stethoscope className="w-3 h-3 inline mr-1" />Specialization
                    </label>
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                      placeholder="e.g. General Practice"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {formData.role === "admin" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          <strong>Admin accounts</strong> have full access to all system settings, user management, and sensitive data. Only assign to trusted personnel.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {formData.email ? (
                      `An invitation will be sent to ${formData.email}. The user will receive an OTP code via email to verify their account.`
                    ) : (
                      "Enter the user's personal email. They will receive an OTP code to verify their account."
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Sending...</span></>
                    ) : (
                      <><Send className="w-4 h-4" /><span>Send Invitation</span></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
