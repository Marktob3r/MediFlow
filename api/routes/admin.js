import express from 'express';
import { supabaseAdmin, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply admin role requirement to all routes in this file
router.use(requireAdmin);

// Invite a new staff/admin member
router.post('/invite', async (req, res) => {
  try {
    const { email, firstName, lastName, role = 'staff', department = 'Front Desk', specialization = '' } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, first name, and last name are required' });
    }

    if (!['staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be staff or admin' });
    }

    const redirectTo = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/staff/accept-invite` : 'http://localhost:5173/staff/accept-invite';

    // 1. Send invite via Supabase Admin API
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        type: 'invite' // Used to distinguish invites in the DB trigger
      },
      redirectTo: redirectTo
    });

    if (inviteError) {
      if (inviteError.message.includes('already been registered')) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      return res.status(400).json({ error: inviteError.message });
    }

    const userId = authData.user.id;

    // 2. Create staff record
    // Note: user_profiles and user_roles are created by the handle_new_user trigger in the DB
    const employeeId = role === 'admin' ? `ADM-${Date.now().toString().slice(-6)}` : `STF-${Date.now().toString().slice(-6)}`;
    
    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .upsert({
        user_id: userId,
        employee_id: employeeId,
        department: department,
        specialization: specialization,
        is_active: true
      });

    if (staffError) {
      console.error("Error creating staff record:", staffError);
      // We don't fail the whole request since the invite was sent, but we log it
    }

    res.status(200).json({
      success: true,
      user: {
        id: userId,
        email: authData.user.email
      }
    });
  } catch (err) {
    console.error("Invite Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all staff/admin users
router.get('/users', async (req, res) => {
  try {
    // We need to gather data from user_roles, user_profiles, staff, and auth.users
    // First get users with staff/admin roles
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['staff', 'admin']);

    if (roleError) return res.status(500).json({ error: roleError.message });

    const userIds = roleData.map(r => r.user_id);
    
    if (userIds.length === 0) {
      return res.status(200).json({ users: [] });
    }

    // Get profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, first_name, last_name, created_at')
      .in('user_id', userIds);

    if (profileError) return res.status(500).json({ error: profileError.message });

    // Get staff details
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('user_id, department, specialization, is_active')
      .in('user_id', userIds);

    if (staffError) return res.status(500).json({ error: staffError.message });

    // Get auth users for last_sign_in_at
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) return res.status(500).json({ error: authError.message });

    // Combine the data
    const users = roleData.map(role => {
      const profile = profileData.find(p => p.user_id === role.user_id) || {};
      const staff = staffData.find(s => s.user_id === role.user_id) || {};
      const auth = authData.users.find(u => u.id === role.user_id) || {};

      return {
        id: role.user_id,
        email: profile.email || auth.email,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        role: role.role,
        department: staff.department || 'N/A',
        specialization: staff.specialization || '',
        isActive: staff.is_active !== false, // Default true if undefined
        createdAt: profile.created_at || auth.created_at,
        lastSignIn: auth.last_sign_in_at || null,
        status: auth.invited_at && !auth.last_sign_in_at ? 'pending' : (staff.is_active === false ? 'inactive' : 'active')
      };
    });

    res.status(200).json({ users });
  } catch (err) {
    console.error("List Users Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a staff member
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, department, specialization, role } = req.body;

    // Cannot deactivate yourself to prevent locking out all admins
    if (isActive === false && req.adminUser.id === id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    // Update staff table
    const updates = {};
    if (isActive !== undefined) updates.is_active = isActive;
    if (department !== undefined) updates.department = department;
    if (specialization !== undefined) updates.specialization = specialization;

    if (Object.keys(updates).length > 0) {
      const { error: staffError } = await supabaseAdmin
        .from('staff')
        .update(updates)
        .eq('user_id', id);

      if (staffError) return res.status(400).json({ error: staffError.message });
    }

    // Update role if requested
    if (role && ['staff', 'admin'].includes(role)) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', id);

      if (roleError) return res.status(400).json({ error: roleError.message });
    }

    // Update auth status
    if (isActive === false) {
      await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { is_active: false } });
    } else if (isActive === true) {
      await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { is_active: true } });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate a staff member
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.adminUser.id === id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .update({ is_active: false })
      .eq('user_id', id);

    if (staffError) return res.status(400).json({ error: staffError.message });

    // Update metadata
    await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { is_active: false } });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend invite
router.post('/resend-invite', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // First get user details to resend same metadata
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = authData.users.find(u => u.email === email);
    
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const redirectTo = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/staff/accept-invite` : 'http://localhost:5173/staff/accept-invite';

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: existing.user_metadata,
      redirectTo
    });

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Resend Invite Error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
