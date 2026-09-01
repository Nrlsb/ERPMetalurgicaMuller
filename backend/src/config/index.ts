import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('erp_muller_jwt_secret_fallback_key'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('erp_muller_cookie_secret_key'),
  DATABASE_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Error crítico en variables de entorno:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  clientUrl: env.CLIENT_URL,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  cookie: {
    secret: env.COOKIE_SECRET,
  },
};

