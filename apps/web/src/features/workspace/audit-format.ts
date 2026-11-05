import type { AuditLogDto } from '@mp/types';

const ACTION_LABELS: Record<string, string> = {
  'auth.register': 'created an account',
  'auth.login': 'signed in',
  'organization.create': 'created the organization',
  'organization.update': 'updated organization settings',
  'organization.archive': 'archived the organization',
  'organization.support_access': 'accessed the organization (platform support)',
  'member.role_update': 'changed a member’s role',
  'member.remove': 'removed a member',
  'invitation.create': 'sent an invitation',
  'invitation.revoke': 'revoked an invitation',
  'invitation.accept': 'joined via invitation',
  'integration.disconnect': 'disconnected an integration',
};

export function describeAuditAction(log: AuditLogDto): string {
  const base = ACTION_LABELS[log.action] ?? log.action;
  const email = typeof log.metadata.email === 'string' ? log.metadata.email : null;
  if (log.action === 'invitation.create' && email) return `invited ${email}`;
  if (log.action === 'member.role_update' && typeof log.metadata.newRole === 'string') {
    return `changed a member’s role to ${log.metadata.newRole.replaceAll('_', ' ').toLowerCase()}`;
  }
  return base;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
