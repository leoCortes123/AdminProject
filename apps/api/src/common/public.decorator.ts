import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca el endpoint como público (omite SessionGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
