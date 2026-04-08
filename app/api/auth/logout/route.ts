// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST() {
  try {
    const { error } = await supabaseServer.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✓ User logged out');
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (err) {
    console.error('Logout API error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to logout' },
      { status: 500 }
    );
  }
}
