'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Monitor, Moon, Sun } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { changePasswordSchema, updateOrganizationSchema, updateProfileSchema } from '@mp/validators';
import { apiRequest } from '@/lib/api-client';
import { apiFormErrors, validateForm } from '@/lib/forms';
import { SESSION_QUERY_KEY, useWorkspace } from '@/lib/session';
import { describeAuditAction } from '@/features/workspace/audit-format';
import { CURRENCIES, timezones } from '@/features/organizations/create-organization-form';
import { useAuditLogs } from '@/features/workspace/queries';
import { useThemePreference } from '@/components/shell/theme';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { cn } from '@/lib/cn';

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader title={title} description={description} />
      <div className="p-5">{children}</div>
    </Card>
  );
}

/** Shared mutation-form plumbing: client validation, API field errors and a success flag. */
function useSettingsForm<T>(mutationFn: (body: T) => Promise<unknown>, onSuccess?: () => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const mutation = useMutation({
    mutationFn,
    onSuccess: () => {
      setErrors({});
      setMessage({ tone: 'success', text: 'Saved.' });
      onSuccess?.();
    },
    onError: (error) => {
      const { fields, message: text } = apiFormErrors(error);
      setErrors(fields);
      setMessage({ tone: 'danger', text });
    },
  });
  return { errors, setErrors, message, setMessage, mutation };
}

function OrganizationSettings() {
  const { organization, can } = useWorkspace();
  const queryClient = useQueryClient();
  const editable = can('organization:update');
  const { errors, setErrors, message, setMessage, mutation } = useSettingsForm(
    (body: Record<string, unknown>) =>
      apiRequest(`/organizations/${organization.id}`, { method: 'PATCH', body }),
    () => void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(updateOrganizationSchema, {
      name: form.get('name'),
      timezone: form.get('timezone'),
      currency: form.get('currency'),
    });
    if (parsed.errors) return setErrors(parsed.errors);
    mutation.mutate(parsed.data);
  };

  return (
    <Section
      id="organization"
      title="Organization"
      description={editable ? 'Details shared by everyone in this organization.' : 'Only admins and owners can change these settings.'}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4" key={organization.id}>
        {message && <Alert tone={message.tone} title={message.text} />}
        <Field label="Name" error={errors.name}>
          {(props) => <Input {...props} name="name" defaultValue={organization.name} disabled={!editable} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone" error={errors.timezone}>
            {(props) => (
              <Select {...props} name="timezone" defaultValue={organization.timezone} disabled={!editable}>
                {timezones().map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reporting currency" error={errors.currency}>
            {(props) => (
              <Select {...props} name="currency" defaultValue={organization.currency} disabled={!editable}>
                {[...new Set([organization.currency, ...CURRENCIES])].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <p className="text-xs text-muted">
          Slug: <span className="font-mono">{organization.slug}</span>
        </p>
        {editable && (
          <Button type="submit" loading={mutation.isPending}>
            Save changes
          </Button>
        )}
      </form>
    </Section>
  );
}

function ProfileSettings() {
  const { session } = useWorkspace();
  const queryClient = useQueryClient();
  const { errors, setErrors, message, setMessage, mutation } = useSettingsForm(
    (body: { name: string }) => apiRequest('/users/me', { method: 'PATCH', body }),
    () => void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const parsed = validateForm(updateProfileSchema, { name: new FormData(event.currentTarget).get('name') });
    if (parsed.errors) return setErrors(parsed.errors);
    mutation.mutate(parsed.data);
  };

  return (
    <Section id="profile" title="Profile" description="How you appear to your teammates.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {message && <Alert tone={message.tone} title={message.text} />}
        <Field label="Full name" error={errors.name}>
          {(props) => <Input {...props} name="name" defaultValue={session.user.name} autoComplete="name" />}
        </Field>
        <Field label="Email" hint="Email changes require verification, which is not available yet.">
          {(props) => <Input {...props} value={session.user.email} readOnly disabled />}
        </Field>
        <Button type="submit" loading={mutation.isPending}>
          Save profile
        </Button>
      </form>
    </Section>
  );
}

function SecuritySettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const { errors, setErrors, message, setMessage, mutation } = useSettingsForm(
    (body: { currentPassword: string; newPassword: string }) => apiRequest('/users/me/password', { method: 'POST', body }),
    () => setFormKey((k) => k + 1),
  );
  const signOutEverywhere = useMutation({
    mutationFn: () => apiRequest('/auth/logout-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(changePasswordSchema, {
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
    });
    if (parsed.errors) return setErrors(parsed.errors);
    mutation.mutate(parsed.data);
  };

  return (
    <Section id="security" title="Security" description="Changing your password signs out your other sessions.">
      <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4">
        {message && <Alert tone={message.tone} title={message.tone === 'success' ? 'Password changed.' : message.text} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" error={errors.currentPassword}>
            {(props) => <Input {...props} name="currentPassword" type="password" autoComplete="current-password" />}
          </Field>
          <Field label="New password" error={errors.newPassword}>
            {(props) => <Input {...props} name="newPassword" type="password" autoComplete="new-password" />}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={mutation.isPending}>
            Change password
          </Button>
          <Button variant="secondary" loading={signOutEverywhere.isPending} onClick={() => signOutEverywhere.mutate()}>
            Sign out of all devices
          </Button>
        </div>
      </form>
    </Section>
  );
}

function AppearanceSettings() {
  const { preference, setPreference } = useThemePreference();
  const options = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ] as const;
  return (
    <Section id="appearance" title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 sm:max-w-md">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            onClick={() => setPreference(option.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors',
              preference === option.value
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border text-muted hover:bg-surface-hover',
            )}
          >
            <option.icon className="size-4" aria-hidden />
            {option.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function AuditLogSection() {
  const [page, setPage] = useState(1);
  const audit = useAuditLogs({ page, limit: 20 });
  return (
    <Card id="audit-log" className="scroll-mt-20">
      <CardHeader title="Audit log" description="Append-only record of security-relevant actions in this organization." />
      {audit.isPending ? (
        <TableSkeleton />
      ) : audit.error ? (
        <ErrorState error={audit.error} onRetry={() => audit.refetch()} />
      ) : audit.data.items.length === 0 ? (
        <EmptyState icon={History} title="No events yet" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-subtle">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">When</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Actor</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Action</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                      <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                    </td>
                    <td className="px-5 py-2.5 text-foreground">{log.actor?.name ?? 'System'}</td>
                    <td className="px-5 py-2.5">
                      <span className="text-foreground">{describeAuditAction(log)}</span>
                      <span className="ml-2 font-mono text-xs text-subtle">{log.action}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-muted">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted">
            <span>
              Page {audit.data.pagination.page} of {audit.data.pagination.totalPages} · {audit.data.pagination.total} events
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= audit.data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function DangerZone() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization } = useWorkspace();
  const archive = useMutation({
    mutationFn: () => apiRequest(`/organizations/${organization.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.replace('/dashboard');
    },
  });
  return (
    <Card className="border-danger/30">
      <CardHeader title="Archive organization" description="Archived organizations become inaccessible to all members. Data is retained." />
      <div className="flex flex-wrap items-center gap-3 p-5">
        {archive.error && <Alert tone="danger" title={archive.error.message} className="w-full" />}
        <Button
          variant="danger"
          loading={archive.isPending}
          onClick={() => {
            const typed = window.prompt(`Type "${organization.name}" to archive this organization.`);
            if (typed === organization.name) archive.mutate();
          }}
        >
          Archive {organization.name}
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { can } = useWorkspace();
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Organization, profile, security and audit settings." />
      <div className="space-y-6">
        <OrganizationSettings />
        <ProfileSettings />
        <SecuritySettings />
        <AppearanceSettings />
        {can('audit:read') && <AuditLogSection />}
        {can('organization:archive') && <DangerZone />}
      </div>
    </PageContainer>
  );
}
