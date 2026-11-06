import { Global, Module } from '@nestjs/common';
import { IamService } from './iam.service';
import { ProductGuard } from './product.guard';
import { PermissionsGuard } from './permissions.guard';
import { SessionGuard } from './session.guard';
import { MeController } from './me.controller';

/** IAM: sesión, RBAC y guards. Global para que los módulos de dominio lo consuman. */
@Global()
@Module({
  controllers: [MeController],
  providers: [IamService, SessionGuard, ProductGuard, PermissionsGuard],
  exports: [IamService, SessionGuard, ProductGuard, PermissionsGuard],
})
export class IamModule {}
