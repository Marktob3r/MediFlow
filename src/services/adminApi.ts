import { supabase } from '../config/supabase';

// If VITE_API_URL is not set (like in Vercel), it defaults to empty string so it makes relative requests to the same origin.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export type StaffUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'staff' | 'admin';
  department: string;
  specialization: string;
  isActive: boolean;
  createdAt: string;
  lastSignIn: string | null;
  status: 'active' | 'inactive' | 'pending';
};

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
};

export const inviteStaffMember = async (data: { email: string; firstName: string; lastName: string; role?: string; department?: string; specialization?: string }) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to invite staff member');
  }
  return result;
};

export const getStaffList = async (): Promise<{ users: StaffUser[] }> => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/users`, {
    method: 'GET',
    headers,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to fetch staff list');
  }
  return result;
};

export const updateStaffMember = async (userId: string, updates: { isActive?: boolean; department?: string; specialization?: string; role?: string }) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to update staff member');
  }
  return result;
};

export const deactivateStaffMember = async (userId: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to deactivate staff member');
  }
  return result;
};

export const resendInvite = async (email: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/admin/resend-invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to resend invite');
  }
  return result;
};
