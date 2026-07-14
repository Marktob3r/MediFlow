import React, { ReactNode, useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import { useToast } from "./ToastContext";

export type UserRole = "patient" | "staff" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  signUp: (email: string, password: string, userData: any) => Promise<{ needsEmailConfirmation: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordResetOtp: (email: string) => Promise<void>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { showToast } = useToast();

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error fetching user profile:", profileError);
      }
      if (roleError && roleError.code !== "PGRST116") {
        console.error("Error fetching user role:", roleError);
      }

      let is_active = true;
      const role: UserRole = roleData?.role || "patient";

      if (role === "staff" || role === "admin") {
        const { data: staffData } = await supabase
          .from("staff")
          .select("is_active")
          .eq("user_id", userId)
          .single();
        if (staffData && staffData.is_active === false) {
          is_active = false;
        }
      }

      if (!is_active) {
        await supabase.auth.signOut();
        setUser(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      const authUser: AuthUser = {
        id: userId,
        email: email,
        first_name: profileData?.first_name || "",
        last_name: profileData?.last_name || "",
        phone: profileData?.phone || null,
        role: role,
        is_active: is_active,
      };

      setUser(authUser);
      setUserRole(role);
      setLoading(false);
    } catch (err) {
      console.error("Failed to assemble user profile", err);
      setUser(null);
      setUserRole(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userData: any): Promise<{ needsEmailConfirmation: boolean }> => {
    try {
      console.log("Starting Supabase auth signup...");
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone || null,
            role: userData.role || "patient",
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        throw error;
      }

      const needsEmailConfirmation = !data.session;
      console.log(needsEmailConfirmation ? "Signup: email confirmation required." : "Signup: logged in directly (no email confirmation).");
      
      return { needsEmailConfirmation };
    } catch (error: any) {
      console.error("Sign up error:", error);
      throw error; 
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      console.log("🔍 Verifying OTP for:", email);
      console.log("🔑 OTP Code:", token);
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });

      if (error) {
        console.error("❌ OTP verification error:", error);
        throw error;
      }
      
      console.log("✅ OTP verified successfully!");
      showToast("Success", "Email verified successfully!", "success");
    } catch (error: any) {
      console.error("❌ Verify OTP error:", error);
      showToast("Error", error.message || "OTP verification failed. Please try again.", "error");
      throw error;
    }
  };

  // ============================================================
  // ✅ FIXED: resendOtp function - Properly resends OTP
  // ============================================================
  const resendOtp = async (email: string) => {
    try {
      console.log("📧 Resending OTP to:", email);
      
      // Use supabase.auth.resend() with type 'signup' for OTP
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin + "/staff/login",
        },
      });

      if (error) {
        console.error("❌ Resend OTP error:", error);
        
        // If the error is about the user not being confirmed or already exists,
        // try using signUp as fallback (this works because the user already exists)
        console.log("🔄 Trying fallback method with signUp...");
        const { error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: 'temporary-password-123',
          options: {
            emailRedirectTo: window.location.origin + "/staff/login",
          },
        });
        
        if (signUpError) {
          console.error("❌ Fallback signUp error:", signUpError);
          throw signUpError;
        }
        
        console.log("✅ OTP sent successfully via fallback!");
        showToast("Success", "A new OTP has been sent to your email. Check your spam folder.", "success");
        return;
      }
      
      console.log("✅ OTP resent successfully!");
      console.log("📧 Response:", data);
      showToast("Success", "A new OTP has been sent to your email. Check your spam folder if you don't see it.", "success");
    } catch (error: any) {
      console.error("❌ Resend OTP error:", error);
      showToast("Error", error.message || "Failed to resend OTP. Please try again later.", "error");
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Signing in with Supabase...");
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        throw error;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("EMAIL_NOT_VERIFIED: Please verify your email using the OTP sent to you.");
      }

      if (data.user) {
        try {
          const { error: sessionError } = await supabase
            .from("user_sessions")
            .upsert({
              user_id: data.user.id,
              last_sign_in_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          
          if (sessionError) {
            console.warn("Could not update user_sessions (non-critical):", sessionError.message);
          } else {
            console.log("✅ Updated last sign-in time for user:", data.user.email);
          }
        } catch (sessionError) {
          console.warn("Could not update user_sessions (non-critical):", sessionError);
        }
      }

      showToast("Welcome Back!", "You have successfully logged in.", "success");
    } catch (error: any) {
      console.error("Sign in error:", error);
      
      if (error.message?.includes("EMAIL_NOT_VERIFIED")) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showToast("Logged Out", "You have been securely logged out.", "success");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const sendPasswordResetOtp = async (email: string) => {
    try {
      console.log("Sending password reset OTP...");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/staff/reset-password",
      });
      if (error) throw error;
      console.log("Password reset OTP sent successfully.");
      showToast("Success", "Password reset OTP sent to your email.", "success");
    } catch (error: any) {
      console.error("Reset password error:", error);
      showToast("Error", error.message || "Failed to send password reset email.", "error");
      throw error;
    }
  };

  const verifyPasswordResetOtp = async (email: string, token: string) => {
    try {
      console.log("Verifying password reset OTP...");
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery'
      });
      if (error) throw error;
      console.log("Password reset OTP verified successfully.");
      showToast("Success", "Password reset verified. You can now set a new password.", "success");
    } catch (error: any) {
      console.error("Verify reset OTP error:", error);
      showToast("Error", error.message || "Failed to verify password reset OTP.", "error");
      throw error;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      console.log("Updating password...");
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      if (error) throw error;
      console.log("Password updated successfully.");
      showToast("Success", "Password updated successfully!", "success");
    } catch (error: any) {
      console.error("Update password error:", error);
      showToast("Error", error.message || "Failed to update password.", "error");
      throw error;
    }
  };

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    userRole,
    signUp,
    verifyOtp,
    resendOtp,
    signIn,
    signOut,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    updatePassword,
  }), [user, loading, userRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
