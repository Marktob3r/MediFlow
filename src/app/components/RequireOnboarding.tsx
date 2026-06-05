import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";

export default function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isComplete, setIsComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      checkProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkProfile = async () => {
    try {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("date_of_birth, gender, address, phone")
        .eq("user_id", user?.id)
        .single();

      const { data: patientData } = await supabase
        .from("patients")
        .select("blood_type, emergency_contact, emergency_phone")
        .eq("user_id", user?.id)
        .single();

      const complete = !!(
        profileData?.date_of_birth &&
        profileData?.gender &&
        profileData?.address &&
        profileData?.phone &&
        patientData?.blood_type &&
        patientData?.emergency_contact &&
        patientData?.emergency_phone
      );

      setIsComplete(complete);
    } catch (err) {
      console.error("Error checking onboarding status", err);
      setIsComplete(true); 
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isComplete === false) {
    return <Navigate to="/patient/onboarding" replace />;
  }

  return <>{children}</>;
}
