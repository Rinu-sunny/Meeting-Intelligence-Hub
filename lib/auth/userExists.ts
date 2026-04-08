// lib/auth/userExists.ts
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Check if a user exists in the database by email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code === 'PGRST116') {
      // No row found
      return false;
    }

    if (error) {
      console.error('Error checking user existence:', error);
      return false;
    }

    return !!data?.id;
  } catch (err) {
    console.error('Error in userExistsByEmail:', err);
    return false;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  try {
    const { data, error } = await supabaseServer
      .from('users')
      .select('id, email, full_name, avatar_url, created_at')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error in getUserByEmail:', err);
    return null;
  }
}
