FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3005
ENV MCP_TRANSPORT=sse
ENV BOUNTYOS_API_URL=http://server:8000
ENV BOUNTYOS_USERNAME=admin
ENV BOUNTYOS_PASSWORD=admin

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3005
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3005/health || exit 1

CMD ["node", "dist/index.js", "--sse", "--port", "3005"]
