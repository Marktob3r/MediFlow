import { supabase, supabaseAdmin } from '../config/supabase';

export type StaffUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'staff' | 'admin';
  department?: string;
  specialization?: string;
  isActive: boolean;
  createdAt?: string;
  lastSignIn: string | null;
  status: 'active' | 'inactive' | 'pending';
};

/**
 * Get all staff and admin users with their profiles and roles
 */
export const getStaffList = async (): Promise<{ users: StaffUser[] }> => {
  try {
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["staff", "admin"]);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      throw new Error(rolesError.message);
    }

    if (!rolesData || rolesData.length === 0) {
      return { users: [] };
    }

    const userIds = rolesData.map(r => r.user_id);
    const roleMap: Record<string, string> = {};
    rolesData.forEach(r => {
      roleMap[r.user_id] = r.role;
    });

    const { data: staffData, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("user_id, is_active, employee_id, specialization, department, created_at")
      .in("user_id", userIds);

    if (staffError) {
      console.error("Error fetching staff data:", staffError);
    }

    const staffStatusMap: Record<string, boolean> = {};
    const staffSpecializationMap: Record<string, string> = {};
    const staffDepartmentMap: Record<string, string> = {};
    const staffCreatedAtMap: Record<string, string> = {};
    
    if (staffData) {
      staffData.forEach(s => {
        staffStatusMap[s.user_id] = s.is_active !== false;
        staffSpecializationMap[s.user_id] = s.specialization || "";
        staffDepartmentMap[s.user_id] = s.department || "";
        staffCreatedAtMap[s.user_id] = s.created_at || "";
      });
    }

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, first_name, last_name, email, updated_at, created_at")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw new Error(profilesError.message);
    }

    let lastSignInMap: Record<string, string> = {};
    
    try {
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from("user_sessions")
        .select("user_id, last_sign_in_at")
        .in("user_id", userIds);

      if (!sessionError && sessionData && sessionData.length > 0) {
        sessionData.forEach((session: any) => {
          if (session.user_id && session.last_sign_in_at) {
            lastSignInMap[session.user_id] = session.last_sign_in_at;
          }
        });
        console.log(`✅ Loaded last sign-in data from user_sessions for ${Object.keys(lastSignInMap).length} users`);
      } else {
        console.log("ℹ️ No user_sessions found, using updated_at as fallback");
        profilesData.forEach(profile => {
          if (profile.user_id && profile.updated_at) {
            lastSignInMap[profile.user_id] = profile.updated_at;
          }
        });
      }
    } catch (sessionError) {
      console.warn("Could not fetch from user_sessions table:", sessionError);
      profilesData.forEach(profile => {
        if (profile.user_id && profile.updated_at) {
          lastSignInMap[profile.user_id] = profile.updated_at;
        }
      });
    }

    const users: StaffUser[] = profilesData.map(profile => {
      const userId = profile.user_id;
      const role = roleMap[userId] || "staff";
      const isActive = staffStatusMap[userId] !== undefined ? staffStatusMap[userId] : true;
      const lastSignIn = lastSignInMap[userId] || null;
      
      return {
        id: userId,
        email: profile.email || "",
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        role: role as "staff" | "admin",
        department: staffDepartmentMap[userId] || "",
        specialization: staffSpecializationMap[userId] || "",
        isActive: isActive,
        status: isActive ? "active" : "inactive",
        lastSignIn: lastSignIn,
        createdAt: staffCreatedAtMap[userId] || new Date().toISOString(),
      };
    });

    const profileUserIds = new Set(profilesData.map(p => p.user_id));
    const missingUsers = userIds.filter(id => !profileUserIds.has(id));
    
    for (const userId of missingUsers) {
      const role = roleMap[userId] || "staff";
      const isActive = staffStatusMap[userId] !== undefined ? staffStatusMap[userId] : true;
      const lastSignIn = lastSignInMap[userId] || null;
      
      users.push({
        id: userId,
        email: "",
        firstName: "",
        lastName: "",
        role: role as "staff" | "admin",
        department: staffDepartmentMap[userId] || "",
        specialization: staffSpecializationMap[userId] || "",
        isActive: isActive,
        status: isActive ? "active" : "inactive",
        lastSignIn: lastSignIn,
        createdAt: staffCreatedAtMap[userId] || new Date().toISOString(),
      });
    }

    users.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    console.log(`📊 Final staff list: ${users.length} users, ${Object.keys(lastSignInMap).length} with last sign-in data`);
    
    return { users };
  } catch (error) {
    console.error("Error in getStaffList:", error);
    return { users: [] };
  }
};

/**
 * Invite staff member - Properly sends OTP email
 */
export const inviteStaffMember = async (data: { 
  email: string; 
  firstName: string; 
  lastName: string; 
  role?: 'staff' | 'admin';  // ✅ Fixed: Use the exact type
  department?: string; 
  specialization?: string 
}) => {
  try {
    // ✅ role is now properly typed with a default
    const role: 'staff' | 'admin' = data.role || "staff";
    const email = data.email.trim().toLowerCase();

    console.log("📧 Inviting staff member:", email);

    // STEP 1: Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, email")
      .eq("email", email)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.user_id;
      console.log("✅ User profile exists with ID:", userId);
      
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (existingRole) {
        return { 
          success: false, 
          error: "This user is already registered as a staff member or admin." 
        };
      }
    } else {
      // STEP 2: Create user with email_confirm: false
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: false,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
          role: role,
        },
      });

      if (authError) {
        console.error("❌ Create user error:", authError);
        if (authError.message?.includes("already registered")) {
          return { 
            success: false, 
            error: "This email is already registered." 
          };
        }
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      userId = authData.user.id;
      console.log("✅ User created with ID:", userId);

      // STEP 3: Create profile
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          user_id: userId,
          email: email,
          first_name: data.firstName,
          last_name: data.lastName,
        });

      if (profileError) {
        console.error("❌ Profile creation error:", profileError);
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
        throw new Error("Failed to create user profile");
      }
      console.log("✅ Profile created successfully");

      // STEP 4: Send OTP email
      console.log("📧 Sending OTP email...");
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin + "/staff/login",
        },
      });

      if (resendError) {
        console.error("❌ Error sending OTP via resend:", resendError);
      } else {
        console.log("✅ OTP email sent successfully!");
      }
    }

    // STEP 5: Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: role,
      }, { onConflict: 'user_id' });
    
    if (roleError) {
      console.error("❌ Role assignment error:", roleError);
      throw new Error("Failed to assign role");
    }
    console.log("✅ Role assigned successfully");

    // STEP 6: Add to staff table
    const { error: staffError } = await supabaseAdmin
      .from("staff")
      .upsert({
        user_id: userId,
        is_active: true,
        employee_id: `EMP${Date.now().toString().slice(-6)}`,
        department: data.department || "",
        specialization: data.specialization || "",
      }, { onConflict: 'user_id' });
    
    if (staffError) {
      console.error("❌ Staff creation error:", staffError);
      throw new Error("Failed to create staff record");
    }
    console.log("✅ Staff record created successfully");

    return { 
      success: true, 
      message: `Invitation sent to ${email}. The user will receive an OTP code to verify their account.`
    };
  } catch (error: any) {
    console.error("❌ Error inviting staff:", error);
    return { success: false, error: error.message || "Failed to send invitation" };
  }
};

/**
 * Resend OTP using Supabase
 */
export const resendOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    console.log("📧 Resending OTP to:", normalizedEmail);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin + "/staff/login",
      },
    });

    if (error) {
      console.error("❌ Error resending OTP:", error);
      return { success: false, error: error.message || "Failed to resend OTP" };
    }

    console.log("✅ OTP resent successfully to:", normalizedEmail);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error resending OTP:", error);
    return { success: false, error: error.message || "Failed to resend OTP" };
  }
};

/**
 * Verify OTP using Supabase
 */
export const verifyOTP = async (email: string, otpCode: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otpCode.trim();

    console.log("🔍 Verifying OTP for:", normalizedEmail);
    console.log("🔑 OTP Code:", normalizedOtp);

    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedOtp,
      type: 'email',
    });

    if (error) {
      console.error("❌ OTP verification error:", error);
      return { success: false, error: error.message || "Invalid or expired OTP" };
    }

    console.log("✅ OTP verified successfully!");
    return { success: true };
  } catch (error: any) {
    console.error("❌ OTP verification error:", error);
    return { success: false, error: error.message || "Failed to verify OTP" };
  }
};

/**
 * Update staff member
 */
export const updateStaffMember = async (userId: string, updates: { 
  isActive?: boolean; 
  department?: string; 
  specialization?: string; 
  role?: string;
  firstName?: string;
  lastName?: string;
}) => {
  try {
    if (updates.firstName || updates.lastName) {
      const profileUpdates: any = {};
      if (updates.firstName) profileUpdates.first_name = updates.firstName;
      if (updates.lastName) profileUpdates.last_name = updates.lastName;
      
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .update(profileUpdates)
        .eq("user_id", userId);
      
      if (profileError) throw new Error(profileError.message);
    }

    if (updates.role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: updates.role })
        .eq("user_id", userId);
      
      if (roleError) throw new Error(roleError.message);
    }

    const staffUpdates: any = {};
    if (updates.isActive !== undefined) staffUpdates.is_active = updates.isActive;
    if (updates.department !== undefined) staffUpdates.department = updates.department;
    if (updates.specialization !== undefined) staffUpdates.specialization = updates.specialization;
    
    if (Object.keys(staffUpdates).length > 0) {
      const { error: staffError } = await supabaseAdmin
        .from("staff")
        .update(staffUpdates)
        .eq("user_id", userId);
      
      if (staffError) throw new Error(staffError.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error updating staff:", error);
    throw new Error(error.message || "Failed to update staff member");
  }
};

/**
 * Deactivate staff member
 */
export const deactivateStaffMember = async (userId: string) => {
  try {
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ is_active: false })
      .eq("user_id", userId);
    
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    console.error("Error deactivating staff:", error);
    throw new Error(error.message || "Failed to deactivate staff member");
  }
};

/**
 * Reactivate staff member
 */
export const reactivateStaffMember = async (userId: string) => {
  try {
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ is_active: true })
      .eq("user_id", userId);
    
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    console.error("Error reactivating staff:", error);
    throw new Error(error.message || "Failed to reactivate staff member");
  }
};

/**
 * Resend invitation (legacy - uses resendOTP)
 */
export const resendInvite = async (email: string) => {
  return resendOTP(email);
};
