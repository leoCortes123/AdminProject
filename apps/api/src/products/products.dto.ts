import { z } from 'zod';

/** Roles asignables como miembro de producto (admin_global es rol global, no de producto). */
export const productAssignableRoleSchema = z.enum(['admin_product', 'collaborator', 'viewer']);
export type ProductAssignableRole = z.infer<typeof productAssignableRoleSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roleKey: productAssignableRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    tagline: z.string().trim().max(200).nullish(),
    description: z.string().trim().max(10_000).nullish(),
    status: z.enum(['active', 'in_development', 'maintenance', 'archived']).optional(),
    techStack: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    repoUrl: z.string().url().max(500).nullish(),
    icon: z.string().trim().max(40).nullish(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullish(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
