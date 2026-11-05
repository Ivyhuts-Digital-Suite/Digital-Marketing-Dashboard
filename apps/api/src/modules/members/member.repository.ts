import { TenantRepository, type TenantScope } from '../../lib/mongoose/tenant-repository';
import { InvitationModel, type Invitation } from './invitation.model';
import { OrganizationMemberModel, type OrganizationMember } from './member.model';

export class MemberRepository extends TenantRepository<OrganizationMember> {
  constructor() {
    super(OrganizationMemberModel);
  }

  countActiveOwners(scope: TenantScope) {
    return this.count(scope, { role: 'ORGANIZATION_OWNER', status: 'ACTIVE' });
  }
}

export class InvitationRepository extends TenantRepository<Invitation> {
  constructor() {
    super(InvitationModel);
  }

  /** Marks this organization's elapsed pending invitations as EXPIRED. */
  expireStale(scope: TenantScope, email?: string) {
    return InvitationModel.updateMany(
      this.scoped(scope, { status: 'PENDING', expiresAt: { $lte: new Date() }, ...(email && { email }) }),
      { $set: { status: 'EXPIRED' } },
    );
  }
}
