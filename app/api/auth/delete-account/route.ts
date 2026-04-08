// app/api/auth/delete-account/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      );
    }

    // Delete all user data (cascade will handle meetings, transcripts, insights)
    // 1. Delete user profile
    const { error: profileError } = await supabaseServer
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to delete user profile:', profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // 2. Delete auth user
    const { error: authError } = await supabaseServer.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Failed to delete auth user:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    console.log('✓ Account deleted:', userId);
    return NextResponse.json({ 
      success: true,
      message: 'Account and all associated data deleted successfully' 
    });
  } catch (err) {
    console.error('Delete account API error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}
