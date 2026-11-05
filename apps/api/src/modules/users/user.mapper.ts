import type { UserDto } from '@mp/types';
import type { User } from './user.model';

export function toUserDto(user: Pick<User, '_id' | 'email' | 'name' | 'status' | 'platformRole' | 'emailVerifiedAt' | 'lastLoginAt' | 'createdAt'>): UserDto {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    status: user.status,
    platformRole: user.platformRole,
    emailVerified: Boolean(user.emailVerifiedAt),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
