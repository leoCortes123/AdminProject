import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Acceder',
  description: 'Accede a DevCycle',
};

export default function LoginPage() {
  return (
    <main className="login-shell">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
