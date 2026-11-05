'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { createOrganizationSchema, type CreateOrganizationInput } from '@mp/validators';
import type { OrganizationWithMembershipDto } from '@mp/types';
import { apiRequest } from '@/lib/api-client';
import { apiFormErrors, validateForm } from '@/lib/forms';
import { SESSION_QUERY_KEY } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'BRL'];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function timezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
}

export function CreateOrganizationForm({
  onCreated,
  submitLabel = 'Create organization',
}: {
  onCreated: (organization: OrganizationWithMembershipDto) => void;
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [defaultTimezone] = useState(browserTimezone);

  const create = useMutation({
    mutationFn: (body: CreateOrganizationInput) =>
      apiRequest<{ organization: OrganizationWithMembershipDto }>('/organizations', { method: 'POST', body }),
    onSuccess: async ({ organization }) => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      onCreated(organization);
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
    const result = validateForm(createOrganizationSchema, {
      name: form.get('name'),
      timezone: form.get('timezone'),
      currency: form.get('currency'),
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    create.mutate(result.data);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger" title={formError} />}
      <Field label="Organization name" error={errors.name} hint="Your company, agency or client name.">
        {(props) => <Input {...props} name="name" required autoFocus placeholder="Acme Marketing" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone" error={errors.timezone}>
          {(props) => (
            <Select {...props} name="timezone" defaultValue={defaultTimezone}>
              {timezones().map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reporting currency" error={errors.currency}>
          {(props) => (
            <Select {...props} name="currency" defaultValue="USD">
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" loading={create.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}
