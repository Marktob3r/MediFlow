import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Edit2, X, AlertTriangle } from "lucide-react";
import { updateStaffMember, StaffUser } from "../../services/adminApi";
import { useToast } from "../../contexts/ToastContext";

type EditStaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff: StaffUser | null;
};

export default function EditStaffModal({ isOpen, onClose, onSuccess, staff }: EditStaffModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: "staff",
    department: "Front Desk",
    specialization: "",
    isActive: true,
  });

  useEffect(() => {
    if (staff) {
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
    if (!staff) return;
    
    setLoading(true);
    try {
      await updateStaffMember(staff.id, {
        role: formData.role,
        department: formData.department,
        specialization: formData.specialization,
        isActive: formData.isActive,
      });
      showToast("Updated", "Staff member updated successfully.", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast("Error", err.message || "Failed to update staff member.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!staff) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Edit2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="font-bold text-gray-900 text-lg">Edit Staff Member</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Read-only User Info */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${staff.role === 'admin' ? 'bg-purple-500' : 'bg-green-500'}`}>
                    {staff.firstName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{staff.firstName} {staff.lastName}</h3>
                    <p className="text-sm text-gray-500">{staff.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="Front Desk">Front Desk</option>
                      <option value="Medical">Medical</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Administration">Administration</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Specialization (Optional)</label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g. General Practice"
                  />
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Account Status</label>
                  <div 
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-colors ${
                      formData.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${formData.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      <span className={`font-semibold text-sm ${formData.isActive ? "text-green-700" : "text-gray-600"}`}>
                        {formData.isActive ? "Active Account" : "Deactivated"}
                      </span>
                    </div>
                    
                    {/* Toggle switch UI */}
                    <div className={`w-11 h-6 rounded-full p-1 transition-colors ${formData.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                  </div>
                  
                  {!formData.isActive && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 flex gap-2 text-amber-600 text-xs bg-amber-50 p-2.5 rounded-xl border border-amber-100"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>This user will be immediately logged out and prevented from signing in until reactivated.</p>
                    </motion.div>
                  )}
                </div>

                <div className="pt-4 mt-6 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gray-900 text-white font-bold px-6 py-2.5 rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
