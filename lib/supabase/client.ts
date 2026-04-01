import { createClient } from '@supabase/supabase-js';

// This single function will be used by all your components 
// to talk to the database tables we created.
export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);