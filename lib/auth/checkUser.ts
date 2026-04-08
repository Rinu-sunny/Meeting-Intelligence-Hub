// lib/auth/checkUser.ts (client-side)
/**
 * Check if user exists by email (client-side)
 */
export async function checkUserExists(email: string) {
  try {
    const res = await fetch('/api/auth/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { exists: false, error: err.error };
    }

    const data = await res.json();
    return {
      exists: data.exists,
      user: data.user,
      error: null,
    };
  } catch (err) {
    return {
      exists: false,
      error: (err as Error).message,
    };
  }
}
