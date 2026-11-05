import { z } from 'zod';
import { INTEGRATION_PROVIDERS } from '@mp/shared';
import { objectIdSchema } from './common';

export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);

export const integrationIdParamSchema = z.object({ integrationId: objectIdSchema }).strict();
export const integrationProviderParamSchema = z.object({ provider: integrationProviderSchema }).strict();
