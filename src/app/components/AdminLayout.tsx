import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  Shield,
  Sliders,
  Settings,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import RealTimeClock from "./RealTimeClock";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, signOut, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/staff/login");
    } else if (userRole !== "admin") {
      if (userRole === "staff") {
        navigate("/staff/dashboard");
      } else {
        navigate("/patient/dashboard");
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  // Fetch notification count
  useEffect(() => {
    if (user?.id) {
      fetchNotificationCount();
    }
  }, [user]);

  const fetchNotificationCount = async () => {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: 'exact', head: true })
        .eq("patient_id", user?.id)
        .eq("read", false);

      if (!error && count) {
        setNotifCount(count);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    await signOut();
    navigate("/staff/login");
  };

  const adminNavItems = [
    { path: "/admin/dashboard", icon: BarChart3, label: "Analytics & Reports" },
    { path: "/admin/accounts", icon: Shield, label: "Account Management" },
    { path: "/admin/queue-controls", icon: Sliders, label: "Daily Queue Controls" },
    { path: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  const NavItem = ({ item }: { item: typeof adminNavItems[0] }) => {
    const active = location.pathname === item.path;
    return (
      <button
        onClick={() => {
          navigate(item.path);
          setSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${active
          ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
          : "text-gray-600 hover:bg-green-50 hover:text-green-700"
          }`}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-white" : "text-gray-400 group-hover:text-green-600"}`} />
        <span className="text-sm font-semibold">{item.label}</span>
        {active && <ChevronRight className="w-4 h-4 ml-auto opacity-70" />}
      </button>
    );
  };

  // Get user initial
  const getUserInitial = () => {
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase();
    }
    return "A";
  };

  if (!isAuthenticated || userRole !== "admin") return null;

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={isMobile ? { x: sidebarOpen ? 0 : "-100%" } : { x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-100 shadow-xl z-40 flex flex-col lg:static lg:shadow-none lg:h-screen lg:sticky lg:top-0"
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl flex items-center justify-center shadow-md">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-extrabold text-green-700 text-lg leading-none">MediFlow</p>
                <p className="text-xs text-gray-400 leading-none mt-0.5">Admin Portal</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Info */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                {getUserInitial()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Admin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => <NavItem key={item.path} item={item} />)}
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-semibold">Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 h-[73px] flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-2xl text-gray-500 hover:bg-green-50 hover:text-green-600 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:block">
            <h2 className="font-bold text-gray-900">
              {adminNavItems.find((n) => n.path === location.pathname)?.label || "Admin Portal"}
            </h2>
          </div>

          <div className="flex items-center ml-auto">
            <RealTimeClock />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <LogOut className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Sign Out?</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Are you sure you want to sign out? You'll need to log in again to access your account.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl shadow-md hover:bg-red-600 transition-colors text-sm"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
