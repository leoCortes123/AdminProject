import { Body, Controller, Get, HttpCode, Ip, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createProductSchema } from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { IamService } from '../iam/iam.service';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { ProductsService } from './products.service';
import { addMemberSchema, updateProductSchema } from './products.dto';

@ApiTags('products')
@ApiCookieAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly iam: IamService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Productos visibles para el usuario (membresías o todos si admin_global)',
  })
  async list(@CurrentUser() user: AuthUser) {
    const adminGlobal = await this.iam.isAdminGlobal(user.id);
    return { items: await this.products.listForUser(user.id, adminGlobal) };
  }

  @Post()
  @HttpCode(201)
  @Permissions('products:manage')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Crea un producto (solo admin_global) con workflow por defecto' })
  @ApiCreatedResponse({ description: 'Producto creado con su espacio de trabajo listo' })
  create(
    @Body(zodPipe(createProductSchema)) input: Parameters<ProductsService['createProduct']>[0],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.products.createProduct(input, user.id, ip);
  }

  @Get(':slug')
  @UseGuards(ProductGuard)
  @ApiOperation({ summary: 'Detalle del producto (membresía o admin_global)' })
  async detail(@CurrentProduct() product: ResolvedProduct, @CurrentUser() user: AuthUser) {
    const full = await this.products.findBySlug(product.slug);
    const role = (await this.iam.isAdminGlobal(user.id))
      ? 'admin_global'
      : ((await this.iam.getProductMembership(user.id, product.id))?.roleKey ?? null);
    return { ...full, role };
  }

  @Patch(':slug')
  @UseGuards(ProductGuard, PermissionsGuard)
  @Permissions('config:manage')
  @ApiOperation({ summary: 'Actualiza configuración del producto' })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(updateProductSchema)) input: Parameters<ProductsService['updateProduct']>[1],
  ) {
    return this.products.updateProduct(product.id, input);
  }

  @Get(':slug/members')
  @UseGuards(ProductGuard)
  @ApiOperation({ summary: 'Miembros del producto' })
  members(@CurrentProduct() product: ResolvedProduct) {
    return this.products.listMembers(product.id);
  }

  @Post(':slug/members')
  @HttpCode(201)
  @UseGuards(ProductGuard, PermissionsGuard)
  @Permissions('members:manage')
  @ApiOperation({
    summary: 'Añade/actualiza un miembro (usuario ya registrado; v1 sin flujo por email)',
  })
  addMember(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(addMemberSchema)) input: Parameters<ProductsService['addMember']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.products.addMember(product.id, input, user.id, ip);
  }
}
