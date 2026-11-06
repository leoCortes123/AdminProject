import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq, sql } from 'drizzle-orm';
import { accounts, roles, sessions, userRoles, users, verifications } from '@devcycle/db';
import { getDb } from '../database';
import { getEnv } from '../config/env';

const env = getEnv();
const db = getDb();

/**
 * Instancia única de better-auth: email+contraseña, sesiones en PostgreSQL
 * (cookies HttpOnly). Vive fuera de DI porque Nest la necesita en el bootstrap
 * (handler crudo montado ANTES del body-parser).
 *
 * Regla de negocio codificada: el PRIMER usuario registrado recibe el rol
 * global `admin_global` (la API es la única que conoce el contexto de registro).
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // Orígenes navegadores permitidos para operaciones de auth (CSRF de better-auth).
  trustedOrigins: [env.WEB_URL, env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
          if (Number(row?.count ?? 0) !== 1) return;
          const [adminRole] = await db
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.key, 'admin_global'))
            .limit(1);
          if (adminRole) {
            await db
              .insert(userRoles)
              .values({ userId: user.id, roleId: adminRole.id })
              .onConflictDoNothing();
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
