import { supabase as supabaseClient } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: string | null;
}

export const authService = {
  async signUp(email: string, password: string, fullName: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      });

      if (error) {
        const duplicateUserError =
          /already registered|already exists|already been registered/i.test(error.message);
        if (duplicateUserError) {
          return { user: null, error: 'Account already exists. Please sign in instead.' };
        }
        return { user: null, error: error.message };
      }

      // Supabase can return a user with empty identities when the account already exists.
      const identities = data.user?.identities || [];
      if (data.user && identities.length === 0) {
        return { user: null, error: 'Account already exists. Please sign in instead.' };
      }

      return {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email || '',
              user_metadata: data.user.user_metadata,
            }
          : null,
        error: null,
      };
    } catch (err) {
      return { user: null, error: (err as Error).message };
    }
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email || '',
              user_metadata: data.user.user_metadata,
            }
          : null,
        error: null,
      };
    } catch (err) {
      return { user: null, error: (err as Error).message };
    }
  },

  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });

      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabaseClient.auth.signOut();
      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) return null;

      return {
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
      };
    } catch {
      return null;
    }
  },

  async verifyEmailOTP(email: string, token: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email || '',
              user_metadata: data.user.user_metadata,
            }
          : null,
        error: null,
      };
    } catch (err) {
      return { user: null, error: (err as Error).message };
    }
  },

  async deleteAccount(): Promise<{ error: string | null }> {
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to delete account' };
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  async logout(): Promise<{ error: string | null }> {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to logout' };
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
};
