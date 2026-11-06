import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/authenticated-request';
import { IamService } from './iam.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly iam: IamService) {}

  @Get()
  @ApiOperation({ summary: 'Perfil del usuario autenticado, roles globales y membresías' })
  async me(@CurrentUser() user: AuthUser) {
    const [globalRoles, memberships] = await Promise.all([
      this.iam.getGlobalRoleKeys(user.id),
      this.iam.listMemberships(user.id),
    ]);
    return { user, globalRoles, memberships };
  }
}
