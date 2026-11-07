import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { searchQuerySchema } from '@devcycle/shared';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { ResolvedProduct } from '../common/authenticated-request';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiCookieAuth()
@Controller('products/:slug/search')
@UseGuards(ProductGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Búsqueda FTS en español + códigos (v1: kinds=document; global completo en Fase 5)',
  })
  search(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(searchQuerySchema)) input: Parameters<SearchService['search']>[1],
  ) {
    return this.searchService.search(product.id, input);
  }
}
