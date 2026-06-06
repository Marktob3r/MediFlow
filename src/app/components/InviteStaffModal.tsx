import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus, Mail, X, Shield, Building2, Stethoscope,
  ChevronDown, Send, User, AlertCircle
} from "lucide-react";
import { inviteStaffMember } from "../../services/adminApi";
import { useToast } from "../../contexts/ToastContext";

type InviteStaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const DEPARTMENTS = ["Front Desk", "Medical", "Laboratory", "Pharmacy", "Administration"];

const ROLE_OPTIONS = [
  {
    value: "staff",
    label: "Staff",
    description: "Can manage patients & queue",
    color: "blue",
    icon: User,
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full system access",
    color: "purple",
    icon: Shield,
  },
];

export default function InviteStaffModal({ isOpen, onClose, onSuccess }: InviteStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "staff",
    department: "Front Desk",
    specialization: "",
  });

  const reset = () =>
    setFormData({ email: "", firstName: "", lastName: "", role: "staff", department: "Front Desk", specialization: "" });

  const handleClose = () => { onClose(); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await inviteStaffMember(formData);
      showToast("Invitation Sent ✓", `Invite sent to ${formData.email}`, "success");
      onSuccess();
      handleClose();
    } catch (err: any) {
      showToast("Error", err.message || "Failed to send invitation.", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLE_OPTIONS.find(r => r.value === formData.role)!;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            onClick={handleClose}
          />

          {/* Modal */}
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
              {/* Header */}
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5">
                {/* Subtle pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-base leading-tight">Invite Staff Member</h2>
                      <p className="text-slate-400 text-xs mt-0.5">Send a secure email invitation</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">

                {/* Name row */}
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

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="staff@spdizon-clinic.ph"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Role selector — pill toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {ROLE_OPTIONS.map(role => {
                      const Icon = role.icon;
                      const isSelected = formData.role === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, role: role.value })}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                            isSelected
                              ? role.value === "admin"
                                ? "border-purple-500 bg-purple-50"
                                : "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? role.value === "admin" ? "bg-purple-100" : "bg-blue-100"
                              : "bg-gray-100"
                          }`}>
                            <Icon className={`w-4 h-4 ${
                              isSelected
                                ? role.value === "admin" ? "text-purple-600" : "text-blue-600"
                                : "text-gray-400"
                            }`} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold leading-tight ${
                              isSelected
                                ? role.value === "admin" ? "text-purple-700" : "text-blue-700"
                                : "text-gray-600"
                            }`}>{role.label}</p>
                            <p className="text-xs text-gray-400 leading-tight mt-0.5">{role.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Department + Specialization */}
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

                {/* Admin warning */}
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
                          <strong>Admin accounts</strong> have full access to all system settings, user management, and sensitive data. Only invite trusted personnel.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer actions */}
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
