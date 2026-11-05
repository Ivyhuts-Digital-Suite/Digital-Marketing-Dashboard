'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Suspense, useState, type FormEvent } from 'react';
import { PASSWORD_POLICY } from '@mp/shared';
import { registerSchema, type RegisterInput } from '@mp/validators';
import type { UserDto } from '@mp/types';
import { apiRequest } from '@/lib/api-client';
import { apiFormErrors, validateForm } from '@/lib/forms';
import { safeNextPath } from '@/lib/redirect';
import { SESSION_QUERY_KEY } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNextPath(params.get('next'), '/onboarding');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: (body: RegisterInput) => apiRequest<{ user: UserDto }>('/auth/register', { method: 'POST', body }),
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
    const result = validateForm(registerSchema, {
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    register.mutate(result.data);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Set up your workspace in a minute.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {formError && <Alert tone="danger" title={formError} />}
        <Field label="Full name" error={errors.name}>
          {(props) => <Input {...props} name="name" autoComplete="name" required autoFocus />}
        </Field>
        <Field label="Work email" error={errors.email}>
          {(props) => <Input {...props} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint={`At least ${PASSWORD_POLICY.MIN_LENGTH} characters, including a number or symbol.`}
        >
          {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" required />}
        </Field>
        <Button type="submit" className="w-full" loading={register.isPending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
