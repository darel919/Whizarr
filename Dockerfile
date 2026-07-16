FROM oven/bun:1 AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production PORT=9000
COPY --from=install /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER bun
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD bun -e "const r=await fetch('http://127.0.0.1:9000/status');process.exit(r.ok?0:1)"
CMD ["bun", "run", "src/index.ts"]
