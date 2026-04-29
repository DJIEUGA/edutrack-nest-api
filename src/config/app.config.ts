import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  globalPrefix: process.env.GLOBAL_PREFIX ?? 'api/v1',
  logLevel: process.env.LOG_LEVEL ?? 'info',
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  schema: process.env.DB_SCHEMA ?? 'public',
  logging: process.env.DB_LOGGING === 'true',
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  issuer: process.env.JWT_ISSUER ?? 'edutrack',
  audience: process.env.JWT_AUDIENCE ?? 'edutrack-api',
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '10', 10),
}));
