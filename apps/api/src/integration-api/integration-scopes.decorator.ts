import { SetMetadata } from '@nestjs/common';

export const INTEGRATION_SCOPES_KEY = 'integrationScopes';

/** Exige los scopes de token indicados en el handler de `/integration/*`. */
export const IntegrationScopes = (...scopes: string[]) =>
  SetMetadata(INTEGRATION_SCOPES_KEY, scopes);
