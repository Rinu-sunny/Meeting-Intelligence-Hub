// app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email, fullName, userId } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // Create user profile in public.users table
    const { data, error } = await supabaseServer
      .from('users')
      .insert([
        {
          id: userId,
          email,
          full_name: fullName || email.split('@')[0],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Failed to create user profile:', error);

      const duplicateProfile =
        error.code === '23505' || /duplicate|already exists|unique/i.test(error.message || '');
      if (duplicateProfile) {
        return NextResponse.json(
          { error: 'Account already exists. Please sign in instead.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to create user profile' },
        { status: 500 }
      );
    }

    console.log('✓ User profile created:', data.id);
    return NextResponse.json({ success: true, user: data });
  } catch (err) {
    console.error('Signup API error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
