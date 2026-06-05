import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function RealTimeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-2 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
      <Clock className="w-4 h-4 text-green-600" />
      <span className="text-sm font-semibold tracking-tight">
        {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        <span className="mx-1.5 text-gray-300">|</span>
        {time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
      </span>
    </div>
  );
}
