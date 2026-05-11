# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
# Install all deps (including dev) and compile TypeScript.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy lockfile first so package installs are cached independently of source
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY . .
RUN pnpm build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner
# Lean production image. node_modules is carried over from the builder so that
# tsconfig-paths (a devDependency but required for runtime path alias resolution)
# is available without a separate install step.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Non-root user for least-privilege execution
RUN addgroup -g 1001 -S nodejs \
 && adduser  -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Compiled output
COPY --from=builder /app/dist ./dist

# All node_modules — includes tsconfig-paths which is needed at runtime
# because nest build uses tsc and does not resolve path aliases in the output.
COPY --from=builder /app/node_modules ./node_modules

# Metadata and runtime helpers
COPY package.json ./
COPY register.js docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh \
 && chown -R nestjs:nodejs /app

USER nestjs

# Must match PORT in .env / Coolify environment variables
EXPOSE 3001

# Verify the process is accepting connections.
# Adjust the path if you expose a dedicated /health endpoint via @nestjs/terminus.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "\
    const http = require('http'); \
    const port = process.env.PORT || 3001; \
    const prefix = process.env.GLOBAL_PREFIX || 'api/v1'; \
    http.get('http://localhost:' + port + '/' + prefix, (r) => \
      process.exit(r.statusCode < 500 ? 0 : 1) \
    ).on('error', () => process.exit(1));"

ENTRYPOINT ["./docker-entrypoint.sh"]
