'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  ORGANIZATION_ROLES,
  ROLE_LABELS,
  canAssignRole,
  canManageMember,
  type OrganizationRole,
} from '@mp/shared';
import type { CreatedInvitationDto, OrganizationMemberDto } from '@mp/types';
import { createInvitationSchema } from '@mp/validators';
import { apiRequest } from '@/lib/api-client';
import { apiFormErrors, validateForm } from '@/lib/forms';
import { orgKey, useWorkspace } from '@/lib/session';
import { useInvitations, useMembers } from '@/features/workspace/queries';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Avatar, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organization } = useWorkspace();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedInvitationDto | null>(null);
  const [copied, setCopied] = useState(false);
  const assignable = ORGANIZATION_ROLES.filter((role) => canAssignRole(organization.membership.role, role));

  const invite = useMutation({
    mutationFn: (body: { email: string; role: OrganizationRole }) =>
      apiRequest<CreatedInvitationDto>('/organization-members/invitations', {
        method: 'POST',
        body,
        organizationId: organization.id,
      }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: orgKey(organization.id, 'invitations') });
    },
    onError: (error) => {
      const { fields, message } = apiFormErrors(error);
      setErrors(fields);
      setFormError(message);
    },
  });

  const close = () => {
    setResult(null);
    setErrors({});
    setFormError(null);
    setCopied(false);
    onClose();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(createInvitationSchema, { email: form.get('email'), role: form.get('role') });
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    invite.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onClose={close} title="Invite a team member" description={`Invite someone to ${organization.name}.`}>
      {result ? (
        <div className="space-y-4">
          {result.delivery === 'manual' && result.acceptUrl ? (
            <>
              <Alert tone="warning" title="Email delivery is not configured">
                SMTP credentials are not set on the server, so no email was sent. Share this one-time link with{' '}
                {result.invitation.email}. It expires in 7 days and won’t be shown again.
              </Alert>
              <div className="flex gap-2">
                <Input readOnly value={result.acceptUrl} aria-label="Invitation link" className="font-mono text-xs" />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.acceptUrl!);
                    setCopied(true);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </>
          ) : (
            <Alert tone="success" title={`Invitation sent to ${result.invitation.email}`} />
          )}
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="danger" title={formError} />}
          <Field label="Email address" error={errors.email}>
            {(props) => <Input {...props} name="email" type="email" required autoFocus placeholder="colleague@company.com" />}
          </Field>
          <Field label="Role" error={errors.role} hint="You can only grant roles below your own.">
            {(props) => (
              <Select {...props} name="role" defaultValue="VIEWER">
                {assignable.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={invite.isPending}>
              <Mail className="size-4" aria-hidden />
              Send invitation
            </Button>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function MemberRow({ member }: { member: OrganizationMemberDto }) {
  const { organization, session, can } = useWorkspace();
  const queryClient = useQueryClient();
  const actorRole = organization.membership.role;
  const isSelf = member.user.id === session.user.id;
  const manageable = !isSelf && canManageMember(actorRole, member.role);
  const roles = ORGANIZATION_ROLES.filter((role) => role === member.role || canAssignRole(actorRole, role));

  const refresh = () => queryClient.invalidateQueries({ queryKey: orgKey(organization.id, 'members') });
  const updateRole = useMutation({
    mutationFn: (role: OrganizationRole) =>
      apiRequest(`/organization-members/${member.id}`, { method: 'PATCH', body: { role }, organizationId: organization.id }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiRequest(`/organization-members/${member.id}`, { method: 'DELETE', organizationId: organization.id }),
    onSettled: refresh,
  });
  const error = updateRole.error ?? remove.error;

  return (
    <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.user.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {member.user.name}
            {isSelf && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted">{member.user.email}</p>
          {error && <p className="mt-1 text-xs text-danger">{error.message}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {can('members:update_role') && manageable ? (
          <Select
            aria-label={`Role for ${member.user.name}`}
            value={member.role}
            disabled={updateRole.isPending}
            onChange={(event) => updateRole.mutate(event.target.value as OrganizationRole)}
            className="h-8 w-48 text-xs"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        ) : (
          <Badge tone={member.role === 'ORGANIZATION_OWNER' ? 'primary' : 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
        )}
        {can('members:remove') && manageable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${member.user.name}`}
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm(`Remove ${member.user.name} from ${organization.name}?`)) remove.mutate();
            }}
          >
            {!remove.isPending && <Trash2 className="size-4" />}
          </Button>
        )}
      </div>
    </li>
  );
}

function PendingInvitations() {
  const { organization } = useWorkspace();
  const queryClient = useQueryClient();
  const invitations = useInvitations();
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/organization-members/invitations/${id}`, { method: 'DELETE', organizationId: organization.id }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orgKey(organization.id, 'invitations') }),
  });

  return (
    <Card className="mt-6">
      <CardHeader title="Pending invitations" description="Invitations expire after 7 days." />
      {invitations.isPending ? (
        <TableSkeleton rows={2} />
      ) : invitations.error ? (
        <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
      ) : invitations.data.length === 0 ? (
        <EmptyState icon={Mail} title="No pending invitations" className="py-8" />
      ) : (
        <ul className="divide-y divide-border">
          {invitations.data.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{invitation.email}</p>
                <p className="text-xs text-muted">
                  {ROLE_LABELS[invitation.role]} · invited by {invitation.invitedBy?.name ?? 'unknown'} · expires{' '}
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Button variant="secondary" size="sm" loading={revoke.isPending && revoke.variables === invitation.id} onClick={() => revoke.mutate(invitation.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function TeamPage() {
  const { can } = useWorkspace();
  const members = useMembers();
  const [inviting, setInviting] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Team members"
        description="Manage who can access this organization and what they can do."
        actions={
          can('members:invite') && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="size-4" aria-hidden />
              Invite member
            </Button>
          )
        }
      />

      <Card>
        <CardHeader title="Members" description={members.data ? `${members.data.length} active` : undefined} />
        {members.isPending ? (
          <TableSkeleton />
        ) : members.error ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : members.data.length === 0 ? (
          <EmptyState icon={Users} title="No members" />
        ) : (
          <ul className="divide-y divide-border">
            {members.data.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </ul>
        )}
      </Card>

      {can('members:invite') && <PendingInvitations />}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </PageContainer>
  );
}
