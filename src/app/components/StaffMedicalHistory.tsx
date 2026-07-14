import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, Search, Filter, ChevronDown, Activity, Calendar, 
  Stethoscope, X, User, Clock, Trash2, AlertTriangle, 
  Trash, ShieldAlert, ClipboardList, Pill, UserX
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useToast } from "../../contexts/ToastContext";

export default function StaffMedicalHistory() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<string[]>(["all"]);
  const [patients, setPatients] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => { 
    if (user) {
      console.log("Staff User:", user);
      fetchAllMedicalRecords(); 
    }
  }, [user]);

  const fetchAllMedicalRecords = async () => {
    try {
      setLoading(true);
      
      console.log("Fetching ALL medical records for staff view...");

      // Get all medical records
      const { data: recordsData, error: recordsError } = await supabase
        .from("medical_history")
        .select("*")
        .order("visit_date", { ascending: false });

      if (recordsError) {
        console.error("Error fetching records:", recordsError);
        throw recordsError;
      }

      console.log("Total records found:", recordsData?.length || 0);

      // Get all patient names from user_profiles
      const patientIds = [...new Set(recordsData?.map(r => r.patient_id).filter(Boolean) || [])];
      
      let patientMap: Record<string, string> = {};
      
      if (patientIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", patientIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((p: any) => {
            patientMap[p.user_id] = `${p.first_name} ${p.last_name}`;
          });
          setPatients(patientMap);
        }
      }

      // ============================================================
      // ✅ FIX: Get staff names - use staff_id directly from medical_history
      // The staff_id in medical_history is the user_id from auth.users
      // ============================================================
      const staffIds = [...new Set(recordsData?.map(r => r.staff_id).filter(Boolean) || [])];
      let staffNameMap: Record<string, string> = {};

      console.log("Staff IDs found in records:", staffIds);

      if (staffIds.length > 0) {
        // Get staff names from user_profiles using the staff_id (which is user_id)
        const { data: staffProfiles, error: staffProfilesError } = await supabase
          .from("user_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", staffIds);

        if (!staffProfilesError && staffProfiles) {
          console.log("Staff profiles found:", staffProfiles);
          staffProfiles.forEach((p: any) => {
            const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            staffNameMap[p.user_id] = fullName || "Clinic Staff";
          });
        } else {
          console.warn("No staff profiles found for IDs:", staffIds);
        }
      }

      console.log("Staff name map:", staffNameMap);

      // Format records
      const formattedRecords = (recordsData || []).map((record: any) => {
        const patientName = patientMap[record.patient_id] || "Unknown Patient";
        
        // ============================================================
        // ✅ FIX: Get the staff name - use the staff_name field first,
        // then fallback to staff_id lookup
        // ============================================================
        let doctorName = "Clinic Staff";
        
        // Priority 1: Use staff_name if it exists and is not "MediFlow Staff"
        if (record.staff_name && record.staff_name !== "MediFlow Staff") {
          doctorName = record.staff_name;
        } 
        // Priority 2: Look up from staff_id in the map
        else if (record.staff_id && staffNameMap[record.staff_id]) {
          doctorName = staffNameMap[record.staff_id];
        }
        // Priority 3: Check if staff_id exists but not in map (try direct lookup)
        else if (record.staff_id) {
          // Try to get the name directly from user_profiles
          // This is a fallback for any missed records
          console.log("Looking up staff name for ID:", record.staff_id);
          // The name will be in the map if we fetched it above
          // If not, we'll use the fallback
        }

        // Extract chief complaint from diagnosis field
        let chiefComplaint = record.diagnosis || "No complaint recorded";
        let staffDiagnosis = "";
        let staffTreatment = "";
        let staffPrescription = "";
        
        // Parse the notes to extract staff information
        if (record.notes) {
          const diagnosisMatch = record.notes.match(/Staff Diagnosis:\s*([^\n]*)/);
          if (diagnosisMatch && diagnosisMatch[1]) {
            staffDiagnosis = diagnosisMatch[1].trim();
          }
          
          const treatmentMatch = record.notes.match(/Treatment:\s*([^\n]*)/);
          if (treatmentMatch && treatmentMatch[1]) {
            staffTreatment = treatmentMatch[1].trim();
          }
          
          const prescriptionMatch = record.notes.match(/Prescription:\s*([^\n]*)/);
          if (prescriptionMatch && prescriptionMatch[1]) {
            staffPrescription = prescriptionMatch[1].trim();
          }
        }

        // Check if it's a No-Show record
        const isNoShow = record.notes?.includes("No-Show") || record.treatment?.includes("No-Show") || false;

        // Use the prescription field directly from the database
        if (record.prescription !== undefined && record.prescription !== null) {
          staffPrescription = record.prescription;
        }

        return {
          ...record,
          date: new Date(record.visit_date).toLocaleDateString("en-PH", { 
            year: "numeric", 
            month: "long", 
            day: "numeric" 
          }),
          time: new Date(record.visit_date).toLocaleTimeString("en-PH", { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          patient_name: patientName,
          doctor_name: doctorName,
          chief_complaint: chiefComplaint,
          staff_diagnosis: staffDiagnosis,
          staff_treatment: staffTreatment || record.treatment || "",
          staff_prescription: staffPrescription || "None",
          isNoShow: isNoShow,
        };
      });

      // Sort alphabetically by patient name
      const sortedRecords = formattedRecords.sort((a, b) => {
        const nameA = a.patient_name.toLowerCase();
        const nameB = b.patient_name.toLowerCase();
        if (sortOrder === "asc") {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      });

      setRecords(sortedRecords);
      
      // Extract unique doctor names
      const doctorNames = ["all", ...new Set(formattedRecords.map((r: any) => r.doctor_name).filter(Boolean))];
      setDoctors(doctorNames);
      
    } catch (error) { 
      console.error("Error fetching medical records:", error); 
      showToast("Error", "Failed to fetch medical records", "error");
    } finally { 
      setLoading(false); 
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    const sorted = [...records].sort((a, b) => {
      const nameA = a.patient_name.toLowerCase();
      const nameB = b.patient_name.toLowerCase();
      if (sortOrder === "asc") {
        return nameB.localeCompare(nameA);
      } else {
        return nameA.localeCompare(nameB);
      }
    });
    setRecords(sorted);
  };

  // Delete a single medical record
  const handleDeleteRecord = async (recordId: string) => {
    if (!recordId) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("medical_history")
        .delete()
        .eq("id", recordId);

      if (error) {
        console.error("Delete error:", error);
        throw new Error(error.message);
      }

      // Remove from local state
      setRecords(prevRecords => prevRecords.filter(r => r.id !== recordId));
      setDeleteConfirm(null);
      setExpanded(null);
      
      showToast("Success", "Medical record deleted successfully", "success");
      
    } catch (error: any) {
      console.error("Error deleting record:", error);
      showToast("Error", error.message || "Failed to delete record", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Delete ALL medical records
  const handleDeleteAllRecords = async () => {
    setDeleting(true);
    try {
      const recordIds = records.map(r => r.id);
      
      if (recordIds.length === 0) {
        showToast("Info", "No records to delete", "info");
        setDeleteAllConfirm(false);
        setDeleting(false);
        return;
      }

      const { error } = await supabase
        .from("medical_history")
        .delete()
        .in("id", recordIds);

      if (error) {
        console.error("Delete all error:", error);
        throw new Error(error.message);
      }

      setRecords([]);
      setDeleteAllConfirm(false);
      setExpanded(null);
      
      showToast("Success", `All ${recordIds.length} medical records deleted successfully`, "success");
      
    } catch (error: any) {
      console.error("Error deleting all records:", error);
      showToast("Error", error.message || "Failed to delete all records", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Debug function
  const debugAllRecords = async () => {
    try {
      console.log("=== DEBUG ALL RECORDS ===");
      console.log("Current Staff User ID:", user?.id);
      
      const { data: allRecords, count } = await supabase
        .from("medical_history")
        .select("*", { count: 'exact' });

      console.log("All medical records:", allRecords);
      console.log("Total records:", count);

      // Check staff_id and staff_name fields
      allRecords?.forEach(record => {
        console.log(`Record ${record.id} - staff_id:`, record.staff_id);
        console.log(`Record ${record.id} - staff_name:`, record.staff_name);
      });

      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, first_name, last_name");

      console.log("All user profiles:", profiles);

    } catch (error) {
      console.error("Debug error:", error);
    }
  };

  const filtered = records.filter((v) => {
    const matchSearch = 
      v.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.chief_complaint?.toLowerCase().includes(search.toLowerCase()) || 
      v.staff_diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
      v.staff_prescription?.toLowerCase().includes(search.toLowerCase()) ||
      v.doctor_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.notes?.toLowerCase().includes(search.toLowerCase());
    
    const matchDoctor = filterDoctor === "all" || v.doctor_name === filterDoctor;
    
    // Filter by No-Show status
    let matchStatus = true;
    if (filterStatus === "no-show") {
      matchStatus = v.isNoShow === true;
    } else if (filterStatus === "completed") {
      matchStatus = v.isNoShow === false;
    }
    
    return matchSearch && matchDoctor && matchStatus;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 flex flex-wrap gap-2">
        <button 
          onClick={debugAllRecords}
          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-lg"
        >
          Debug: Check All Records
        </button>
        <button 
          onClick={fetchAllMedicalRecords}
          className="text-xs bg-green-200 hover:bg-green-300 text-green-700 px-3 py-1 rounded-lg"
        >
          Refresh
        </button>
        <button 
          onClick={toggleSortOrder}
          className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-700 px-3 py-1 rounded-lg flex items-center gap-1"
        >
          <span>Sort: {sortOrder === "asc" ? "A → Z" : "Z → A"}</span>
        </button>
        {records.length > 0 && (
          <button 
            onClick={() => setDeleteAllConfirm(true)}
            className="text-xs bg-red-200 hover:bg-red-300 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1"
          >
            <Trash className="w-3 h-3" />
            Delete All ({records.length})
          </button>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">All Patient Medical Records</h1>
        <p className="text-gray-500 text-sm">
          Complete medical history — {records.length} total visits on file
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Staff ID: {user?.id?.substring(0, 8)}...
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by patient name, diagnosis, or doctor..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm" 
          />
          {search && (
            <button 
              onClick={() => setSearch("")} 
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select 
            value={filterDoctor} 
            onChange={(e) => setFilterDoctor(e.target.value)} 
            className="pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm appearance-none cursor-pointer"
          >
            {doctors.map((d) => (
              <option key={d} value={d}>
                {d === "all" ? "All Staff" : d}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <UserX className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm appearance-none cursor-pointer"
          >
            <option value="all">All Visits</option>
            <option value="completed">Completed Only</option>
            <option value="no-show">No-Show Only</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
              <FileText className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No records found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {search || filterDoctor !== "all" || filterStatus !== "all"
                ? "We couldn't find any medical records matching your current filters."
                : "No medical records have been recorded yet."}
            </p>
            <button 
              onClick={debugAllRecords}
              className="mt-4 text-sm text-green-600 hover:text-green-700 underline"
            >
              Debug: Check database
            </button>
          </div>
        ) : (
          filtered.map((visit, i) => (
            <motion.div 
              key={visit.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.08 }} 
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${
                visit.isNoShow ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'
              }`}
            >
              <button 
                onClick={() => setExpanded(expanded === visit.id ? null : visit.id)} 
                className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                  visit.isNoShow 
                    ? 'bg-amber-100 border-amber-200' 
                    : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                }`}>
                  {visit.isNoShow ? (
                    <UserX className="w-6 h-6 text-amber-600" />
                  ) : (
                    <User className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-base">
                          {visit.patient_name}
                        </p>
                        {visit.isNoShow && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            No-Show
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {visit.chief_complaint || "No complaint"}
                        <span className="mx-1">·</span>
                        <span className="text-gray-400">{visit.doctor_name}</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {visit.date}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 justify-end">
                        <Clock className="w-3 h-3" />
                        {visit.time}
                      </div>
                    </div>
                  </div>
                </div>
                <motion.div 
                  animate={{ rotate: expanded === visit.id ? 180 : 0 }} 
                  transition={{ duration: 0.2 }} 
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {expanded === visit.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: "auto", opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }} 
                    transition={{ duration: 0.3 }} 
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-100 p-5 space-y-5">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Patient</p>
                        <p className="text-sm text-gray-700 font-medium">{visit.patient_name}</p>
                        <p className="text-xs text-gray-400">Patient ID: {visit.patient_id}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Staff</p>
                        <p className="text-sm text-gray-700 font-medium">{visit.doctor_name}</p>
                      </div>

                      {visit.isNoShow ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <UserX className="w-4 h-4 text-amber-600" />
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Status</p>
                          </div>
                          <p className="text-sm text-amber-700 font-medium">Patient did not attend appointment (No-Show)</p>
                        </div>
                      ) : (
                        <>
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Chief Complaint</p>
                            <p className="text-sm text-amber-900 font-medium">{visit.chief_complaint || "Not recorded"}</p>
                          </div>
                          
                          {visit.staff_diagnosis && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Staff Diagnosis</p>
                              <p className="text-sm text-green-900 font-medium">{visit.staff_diagnosis}</p>
                            </div>
                          )}
                          
                          {visit.staff_treatment && visit.staff_treatment !== "Completed consultation" && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <ClipboardList className="w-4 h-4 text-green-600" />
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Treatment / Notes</p>
                              </div>
                              <p className="text-sm text-gray-700 bg-gray-50 rounded-2xl p-4 leading-relaxed">{visit.staff_treatment}</p>
                            </div>
                          )}
                          
                          {/* PRESCRIPTION - Always show, even if "None" */}
                          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Pill className="w-4 h-4 text-blue-600" />
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Prescription</p>
                            </div>
                            <p className="text-sm text-blue-900 font-medium">
                              {visit.staff_prescription && visit.staff_prescription !== "None" 
                                ? visit.staff_prescription 
                                : "None"}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Show raw notes */}
                      {visit.notes && !visit.notes.includes("No-Show") && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Full Notes</p>
                          <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl p-4 leading-relaxed whitespace-pre-line">{visit.notes}</p>
                        </div>
                      )}

                      {/* Delete Button */}
                      <div className="pt-4 border-t border-red-100">
                        {deleteConfirm === visit.id ? (
                          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-2xl border border-red-200">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-700 flex-1">
                              Are you sure you want to delete this record?
                            </p>
                            <button
                              onClick={() => handleDeleteRecord(visit.id)}
                              disabled={deleting}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deleting ? 'Deleting...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(visit.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl transition-colors text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Record
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {deleteAllConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteAllConfirm(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">Delete All Records?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  This action will permanently delete all <strong>{records.length}</strong> medical records from the system. 
                  <br />
                  <span className="text-red-600 font-semibold">This cannot be undone!</span>
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteAllConfirm(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllRecords}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash className="w-4 h-4" />
                        Delete All
                      </>
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