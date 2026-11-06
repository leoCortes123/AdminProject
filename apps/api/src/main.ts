import { Logger } from '@nestjs/common';
import { createNestApp } from './bootstrap';
import { getEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const app = await createNestApp();
  await app.listen(env.PORT);
  const logger = new Logger('Bootstrap');
  logger.log(`DevCycle API en http://localhost:${env.PORT}/api/v1`);
  logger.log(`OpenAPI en http://localhost:${env.PORT}/api/v1/docs`);
}

void bootstrap().catch((error) => {
  console.error('Error en el arranque de la API', error);
  process.exitCode = 1;
});
