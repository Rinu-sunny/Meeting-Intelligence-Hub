// app/api/auth/check-user/route.ts
import { NextResponse } from 'next/server';
import { userExistsByEmail, getUserByEmail } from '@/lib/auth/userExists';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const exists = await userExistsByEmail(email);

    if (exists) {
      const user = await getUserByEmail(email);
      return NextResponse.json({
        exists: true,
        user: {
          id: user?.id,
          email: user?.email,
          full_name: user?.full_name,
          avatar_url: user?.avatar_url,
          created_at: user?.created_at,
        },
      });
    }

    return NextResponse.json({
      exists: false,
      user: null,
    });
  } catch (err) {
    console.error('Check user API error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
