/**
 * Entorno para tests de integración: BD efímera devcycle_test + secretos de
 * test. DEBE importarse ANTES que cualquier módulo de la app (los módulos
 * leen process.env al importarse).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://devcycle:devcycle@localhost:5432/devcycle_test';
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-42';
process.env.BETTER_AUTH_URL = 'http://localhost:3999';
process.env.WEB_URL = 'http://localhost:3000';
process.env.PORT = '3999';
