import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In | Meeting Intelligence Hub',
};

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-transparent px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <LoginForm />
    </div>
  );
}
