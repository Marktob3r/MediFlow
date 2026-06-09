import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Edit2, X, AlertTriangle, Building2, Stethoscope, ChevronDown, Shield, User, Save } from "lucide-react";
import { updateStaffMember, StaffUser } from "../../services/adminApi";
import { useToast } from "../../contexts/ToastContext";

type EditStaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff: StaffUser | null;
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

export default function EditStaffModal({ isOpen, onClose, onSuccess, staff }: EditStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: "staff",
    department: "Front Desk",
    specialization: "",
    isActive: true,
  });

  // Keep a local copy of staff to allow exit animations to play out when staff becomes null
  const [cachedStaff, setCachedStaff] = useState<StaffUser | null>(null);

  useEffect(() => {
    if (staff) {
      setCachedStaff(staff);
      setFormData({
        role: staff.role,
        department: staff.department,
        specialization: staff.specialization || "",
        isActive: staff.isActive,
      });
    }
  }, [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cachedStaff) return;
    
    setLoading(true);
    try {
      await updateStaffMember(cachedStaff.id, {
        role: formData.role,
        department: formData.department,
        specialization: formData.specialization,
        isActive: formData.isActive,
      });
      showToast("Updated ✓", "Staff member updated successfully.", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast("Error", err.message || "Failed to update staff member.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!cachedStaff) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            onClick={onClose}
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
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-gray-100">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Edit2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 text-base leading-tight">Edit Staff Member</h2>
                      <p className="text-gray-500 text-xs mt-0.5">Manage permissions and status</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Read-only User Info */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${cachedStaff.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                    {cachedStaff.firstName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{cachedStaff.firstName} {cachedStaff.lastName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{cachedStaff.email}</p>
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
                        className="w-full appearance-none px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all pr-10"
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
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    />
                  </div>
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Account Status</label>
                  <div 
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      formData.isActive ? "bg-green-50 border-green-500" : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${formData.isActive ? "bg-green-100" : "bg-gray-200"}`}>
                         <div className={`w-3 h-3 rounded-full ${formData.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-400"}`} />
                      </div>
                      <div>
                        <span className={`block font-bold text-sm leading-tight ${formData.isActive ? "text-green-700" : "text-gray-600"}`}>
                          {formData.isActive ? "Active Account" : "Deactivated"}
                        </span>
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          {formData.isActive ? "User can sign in normally" : "Login access disabled"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Toggle switch UI */}
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${formData.isActive ? "translate-x-6" : "translate-x-0"}`} />
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {!formData.isActive && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 leading-relaxed">
                            <strong>Note:</strong> This user will be immediately logged out and prevented from signing in until reactivated.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-gray-900 text-white font-bold text-sm rounded-2xl shadow-md hover:bg-gray-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                    ) : (
                      <><Save className="w-4 h-4" /><span>Save Changes</span></>
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
