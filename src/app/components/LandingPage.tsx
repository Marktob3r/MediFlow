import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../../config/supabase";
import {
  Clock,
  Users,
  Bell,
  Shield,
  ChevronRight,
  Activity,
  FileText,
  MapPin,
  Phone,
  Mail,
  Menu,
  X,
  Stethoscope,
  Heart,
} from "lucide-react";

// Default contact info — overridden by values fetched from queue_settings
const DEFAULT_CLINIC_NAME = "Samuel P. Dizon Medical Clinic";
const DEFAULT_CLINIC_ADDRESS = "2/F RM Centrepoint Bldg. Magsaysay Drive cor. Rizal Ave. East Tapinac, Olongapo, Philippines, 2200";
const DEFAULT_CLINIC_PHONE = "0950 331 3347";
const DEFAULT_CLINIC_EMAIL = "thebuj29@yahoo.com.ph";

const features = [
  {
    icon: Clock,
    title: "Real-Time Queue Tracking",
    description:
      "Monitor your exact position in line from anywhere. No more guessing your wait time.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Get notified via web push when your turn is approaching so you're always ready.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: FileText,
    title: "Digital Intake Forms",
    description:
      "Submit your symptoms and medical concerns online before your visit for faster consultation.",
    color: "bg-teal-50 text-teal-600",
  },
  {
    icon: Shield,
    title: "Secure Medical Records",
    description:
      "Your Electronic Medical Records (EMR) are encrypted and securely stored in the cloud.",
    color: "bg-emerald-50 text-emerald-600",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clinicInfo, setClinicInfo] = useState({
    name: DEFAULT_CLINIC_NAME,
    address: DEFAULT_CLINIC_ADDRESS,
    phone: DEFAULT_CLINIC_PHONE,
    email: DEFAULT_CLINIC_EMAIL,
  });

  // Fetch live clinic contact info from admin settings
  useEffect(() => {
    supabase
      .from("queue_settings")
      .select("clinic_name, clinic_phone, clinic_email, clinic_address")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setClinicInfo({
            name: data.clinic_name || DEFAULT_CLINIC_NAME,
            address: data.clinic_address || DEFAULT_CLINIC_ADDRESS,
            phone: data.clinic_phone || DEFAULT_CLINIC_PHONE,
            email: data.clinic_email || DEFAULT_CLINIC_EMAIL,
          });
        }
      });
  }, []);

  // Handle Supabase auth redirects that land back on this page (e.g. expired magic links)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace("#", ""));
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    if (error) {
      // Clear the hash from the URL so it looks clean
      window.history.replaceState(null, "", window.location.pathname);

      if (errorCode === "otp_expired") {
        setAuthError(
          "Your verification link has expired. Please register again and use the 6-digit code sent to your email."
        );
      } else {
        setAuthError(
          errorDescription?.replace(/\+/g, " ") ||
          "An authentication error occurred. Please try again."
        );
      }
      return;
    }

    // Handle a valid access_token in the hash (magic link click — fallback)
    const accessToken = params.get("access_token");
    if (accessToken) {
      // Supabase will pick this up via onAuthStateChange — redirect to patient dashboard
      navigate("/patient/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-['Montserrat']">
      {/* Auth error toast (e.g. expired verification link) */}
      <AnimatePresence>
        {authError && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ duration: 0.4 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
          >
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-xl flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-600 text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-0.5">Verification Failed</p>
                <p className="text-xs text-red-600 leading-relaxed">{authError}</p>
                <button
                  onClick={() => navigate("/patient/login")}
                  className="mt-2 text-xs font-bold text-red-700 hover:text-red-800 underline"
                >
                  Go back to Register →
                </button>
              </div>
              <button
                onClick={() => setAuthError(null)}
                className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-green-700 font-extrabold text-lg leading-none">
                  Medi
                </span>
                <span className="text-emerald-500 font-extrabold text-lg leading-none">
                  Flow
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate("/staff/login")}
                className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors px-4 py-2 rounded-2xl hover:bg-green-50"
              >
                Staff / Admin
              </button>
              <button
                onClick={() => navigate("/patient/login")}
                className="text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all px-6 py-2.5 rounded-2xl shadow-md hover:shadow-lg active:scale-95"
              >
                Patient Login
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-2xl text-gray-600 hover:bg-green-50 hover:text-green-600 transition-all"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-green-100 shadow-lg"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                {["Features", "How It Works", "Location", "Contact"].map(
                  (item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase().replace(" ", "-")}`}
                      className="text-gray-700 hover:text-green-600 font-medium py-2 border-b border-gray-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item}
                    </a>
                  )
                )}
                <button
                  onClick={() => navigate("/staff/login")}
                  className="w-full text-green-700 font-semibold py-2.5 rounded-2xl border border-green-300 hover:bg-green-50 transition-colors"
                >
                  Staff / Admin Login
                </button>
                <button
                  onClick={() => navigate("/patient/login")}
                  className="w-full text-white font-semibold py-2.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-md"
                >
                  Patient Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-emerald-50" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-green-100/50 to-transparent rounded-bl-[120px]" />
        {/* Decorative circles */}
        <div className="absolute top-20 right-10 w-80 h-80 bg-green-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-60 h-60 bg-emerald-200/30 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-4 py-2 rounded-full mb-6">
                <Activity className="w-3.5 h-3.5" />
                {/* PLACEHOLDER: Update this badge with current system status */}
                Cloud-Based · A.I. Powered · Real-Time
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Skip the Wait.{" "}
              </h1>

              <p className="text-gray-600 text-lg leading-relaxed mb-4">
                {/* PLACEHOLDER: Customize intro text for the clinic */}
                Welcome to <strong>{clinicInfo.name}</strong>'s digital throughput
                system. Join the queue remotely, track your position in
                real-time, and get notified when it's your turn.
              </p>
              <p className="text-gray-500 text-base leading-relaxed mb-10">
                No more crowded waiting rooms. No more guessing. Just smart,
                efficient, patient-centered care.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/patient/login")}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  Get Your Number
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>

            {/* Right: Faint Medical Graphics Composition */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="relative hidden lg:block h-[500px] w-full pointer-events-none"
            >
              {/* Subtle Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-green-300/10 to-emerald-200/10 rounded-[40px] blur-3xl transform rotate-6" />

              {/* Faint Medical Icons */}
              <motion.div
                animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[5%] right-[15%] text-green-500/20"
              >
                <Stethoscope className="w-48 h-48" strokeWidth={1} />
              </motion.div>

              <motion.div
                animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[5%] left-[5%] text-emerald-500/20"
              >
                <Activity className="w-64 h-64" strokeWidth={1} />
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-[35%] left-[45%] text-green-400/20"
              >
                <Heart className="w-36 h-36" strokeWidth={1} />
              </motion.div>

              <motion.div
                animate={{ y: [0, 15, 0], rotate: [0, 15, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-[20%] right-[5%] text-green-500/15"
              >
                <FileText className="w-40 h-40" strokeWidth={1} />
              </motion.div>

              <motion.div
                animate={{ y: [0, -15, 0], rotate: [0, -5, 0] }}
                transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="absolute top-[20%] left-[10%] text-emerald-400/15"
              >
                <Shield className="w-32 h-32" strokeWidth={1} />
              </motion.div>

              {/* Faint floating dots/plus signs */}
              <motion.div
                animate={{ y: [0, -30, 0], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute top-[15%] left-[30%] text-emerald-500/40 text-5xl font-light"
              >
                +
              </motion.div>
              <motion.div
                animate={{ y: [0, 30, 0], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="absolute bottom-[20%] right-[40%] text-green-500/40 text-6xl font-light"
              >
                +
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-[60%] right-[20%] text-emerald-400/40 text-4xl font-light"
              >
                +
              </motion.div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-green-600 font-semibold text-sm uppercase tracking-widest">
              Why MediFlow
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3 mb-4">
              Everything You Need for a Stress-Free Visit
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className={`w-12 h-12 ${f.color} rounded-2xl flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-600 font-semibold text-sm uppercase tracking-widest">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3">
              How MediFlow Works
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Register & Login",
                desc: "Create your patient account or log in with your existing credentials.",
                icon: Users,
              },
              {
                step: "02",
                title: "Join the Queue",
                desc: "Select your service, fill a quick intake form, and receive your line number instantly.",
                icon: FileText,
              },
              {
                step: "03",
                title: "Track Your Turn",
                desc: "Monitor your real-time position and estimated wait time from any device.",
                icon: Clock,
              },
              {
                step: "04",
                title: "Get Notified",
                desc: "Receive a push alert when your turn is coming up.",
                icon: Bell,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative"
              >
                {i < 3 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-green-300 to-emerald-200 -translate-x-1/2 z-0" />
                )}
                <div className="relative z-10 bg-white rounded-3xl p-6 shadow-md border border-green-100 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-4xl font-black text-green-100 absolute top-4 right-5 select-none">
                    {item.step}
                  </span>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>



      {/* ── LOCATION ── */}
      <section id="location" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="text-green-600 font-semibold text-sm uppercase tracking-widest">
              Visit Us
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3 mb-4">
              Where is SPDMC Located?
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Find us easily at our clinic location in Olongapo City.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8 items-center">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="bg-green-50 rounded-3xl p-6 border border-green-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
                    <MapPin className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 mb-1">Address</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{clinicInfo.address}</p>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
                    <Phone className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 mb-1">Phone</h4>
                    <a href={`tel:${clinicInfo.phone}`} className="text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors">
                      {clinicInfo.phone}
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-teal-50 rounded-3xl p-6 border border-teal-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
                    <Mail className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 mb-1">Email</h4>
                    <a href={`mailto:${clinicInfo.email}`} className="text-teal-600 font-semibold text-sm hover:text-teal-700 transition-colors break-all">
                      {clinicInfo.email}
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-2"
            >
              <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100">
                <iframe
                  src="https://maps.google.com/maps?q=14.830798,120.280720&t=&z=17&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full"
                />
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Click the map to open directions in Google Maps
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-emerald-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Ready to Skip the Waiting Room?
            </h2>
            <p className="text-green-100 text-lg mb-8">
              Join MediFlow today and experience a smarter, calmer way to visit the clinic.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/patient/login")}
                className="bg-white text-green-700 font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                Get Started
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT / FOOTER ── */}
      <section id="contact" className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            {/* Clinic Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-extrabold text-lg">MediFlow</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                {/* PLACEHOLDER: Update with official clinic description */}
                A cloud-based throughput solution with A.I. analysis, built for{" "}
                <span className="text-green-400">{clinicInfo.name}</span>.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4">Contact Us</h4>
              {/* PLACEHOLDER: Replace with actual clinic contact details */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">{clinicInfo.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">{clinicInfo.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">{clinicInfo.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} MediFlow — {clinicInfo.name}. All rights reserved.
            </p>
            <p className="text-gray-600 text-xs">
              {/* PLACEHOLDER: Update version with actual release version */}
              Version 1.0.0
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
