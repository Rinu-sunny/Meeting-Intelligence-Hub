// lib/api-auth.ts
import { headers, cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function getAuthenticatedUser() {
  try {
    // Try to get token from Authorization header FIRST
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    console.log('🔑 [getAuthenticatedUser] Authorization header:', authHeader ? 'PRESENT' : 'MISSING');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7); // Remove "Bearer " prefix
      console.log('🔑 [getAuthenticatedUser] Token found in Authorization header');

      // Create a client with the user's session token
      const supabaseUser = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );

      // Get user from the session
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      
      if (!userError && user?.id) {
        console.log('✓ [getAuthenticatedUser] User authenticated via Authorization header:', user.id);
        return user;
      }
    }
    
    // Fallback to cookies
    console.log('🔑 [getAuthenticatedUser] Authorization header not found, trying cookies...');
    
    // Get all cookies and look for Supabase auth token
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    console.log('🔑 [getAuthenticatedUser] All cookies:', allCookies.map(c => c.name));
    
    let token: string | null = null;
    
    // Try to find the auth token in cookies
    for (const cookie of allCookies) {
      if (cookie.name.includes('auth')) {
        try {
          const parsed = JSON.parse(cookie.value);
          if (parsed.access_token) {
            token = parsed.access_token;
            console.log('🔑 [getAuthenticatedUser] Found token in auth cookie');
            break;
          }
        } catch (e) {
          // Not JSON, keep looking
        }
      }
    }
    
    // If not found in auth cookies, try looking in any cookies with the token structure
    if (!token) {
      for (const cookie of allCookies) {
        try {
          const parsed = JSON.parse(cookie.value);
          if (parsed.access_token) {
            token = parsed.access_token;
            console.log('🔑 [getAuthenticatedUser] Found token in non-auth cookie:', cookie.name);
            break;
          }
        } catch (e) {
          // Not JSON
        }
      }
    }

    if (!token) {
      console.warn('❌ [getAuthenticatedUser] No auth token found in cookies');
      return null;
    }

    console.log('🔑 [getAuthenticatedUser] Token found in cookies, verifying...');

    // Create a client with the user's session token
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get user from the session
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError) {
      console.warn('❌ [getAuthenticatedUser] Failed to get user from token:', userError.message);
      return null;
    }
    
    if (!user?.id) {
      console.warn('❌ [getAuthenticatedUser] No user in token');
      return null;
    }

    console.log('✓ [getAuthenticatedUser] Authenticated user from cookies:', user.id, user.email);
    return user;
  } catch (error) {
    console.error('❌ [getAuthenticatedUser] Error:', error);
    return null;
  }
}

/**
 * Get the appropriate user ID to use for database queries from a Supabase user
 * Handles legacy users where the auth user ID might be different from the database user ID
 */
export async function getEffectiveUserId(user: any) {
  if (!user?.id) return null;
  
  const { supabaseServer } = await import('@/lib/supabase/server');
  
  // Check if this user ID exists in the database
  const { data: userInDb } = await supabaseServer
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();
  
  if (userInDb) {
    // User exists, use their ID
    return user.id;
  }
  
  // User doesn't exist in database, check for legacy user with same email
  if (user.email) {
    const { data: legacyUsers } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', user.email);
    
    if (legacyUsers && legacyUsers.length > 0) {
      console.log(`ℹ️ [getEffectiveUserId] Using legacy user ID for ${user.id} (legacy: ${legacyUsers[0].id})`);
      return legacyUsers[0].id;
    }
  }
  
  // No user found anywhere, return the auth ID (might fail later due to FK constraints)
  return user.id;
}
