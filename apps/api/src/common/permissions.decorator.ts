import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@devcycle/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** Exige uno o más permisos granulares (ver PermissionsGuard). */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
