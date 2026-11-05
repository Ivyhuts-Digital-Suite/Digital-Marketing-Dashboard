'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Suspense, useState, type FormEvent } from 'react';
import { loginSchema } from '@mp/validators';
import type { UserDto } from '@mp/types';
import { apiRequest } from '@/lib/api-client';
import { apiFormErrors, validateForm } from '@/lib/forms';
import { safeNextPath } from '@/lib/redirect';
import { SESSION_QUERY_KEY } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNextPath(params.get('next'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiRequest<{ user: UserDto }>('/auth/login', { method: 'POST', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.replace(next);
    },
    onError: (error) => {
      const { fields, message } = apiFormErrors(error);
      setErrors(fields);
      setFormError(message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const result = validateForm(loginSchema, { email: form.get('email'), password: form.get('password') });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    login.mutate(result.data);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to your workspace.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {formError && <Alert tone="danger" title={formError} />}
        <Field label="Email" error={errors.email}>
          {(props) => <Input {...props} name="email" type="email" autoComplete="email" required autoFocus />}
        </Field>
        <Field label="Password" error={errors.password}>
          {(props) => <Input {...props} name="password" type="password" autoComplete="current-password" required />}
        </Field>
        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link href={`/register${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
