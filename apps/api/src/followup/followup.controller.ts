import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { activityQuerySchema, exportQuerySchema } from '@devcycle/shared';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { ResolvedProduct } from '../common/authenticated-request';
import { FollowupService } from './followup.service';

@ApiTags('followup')
@ApiCookieAuth()
@Controller('products/:slug')
@UseGuards(ProductGuard, PermissionsGuard)
export class FollowupController {
  constructor(private readonly followup: FollowupService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Seguimiento: avance por conteo de tareas + módulos + incidencias abiertas/bloqueadas',
  })
  overview(@CurrentProduct() product: ResolvedProduct) {
    return this.followup.getOverview(product.id);
  }

  @Get('coverage')
  @ApiOperation({
    summary: 'Cobertura documental y de pruebas por nodo (ausencia de relations)',
  })
  coverage(@CurrentProduct() product: ResolvedProduct) {
    return this.followup.getCoverage(product.id);
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Feed de actividad cursor-paginado (humano/agente) con filtros',
  })
  activity(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(activityQuerySchema)) input: Parameters<FollowupService['getActivity']>[1],
  ) {
    return this.followup.getActivity(product.id, input);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: 'Informe CSV exportable (Excel-ES: BOM + ;) de tareas/incidencias/modificaciones',
  })
  async exportCsv(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(exportQuerySchema)) input: import('@devcycle/shared').ExportQueryInput,
    @Res() res: { setHeader: (name: string, value: string) => void; send: (body: string) => void },
  ) {
    const csv = await this.followup.getExportCsv(product.id, input.kind);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="devcycle-${product.slug}-${input.kind}.csv"`,
    );
    res.send(csv);
  }
}
