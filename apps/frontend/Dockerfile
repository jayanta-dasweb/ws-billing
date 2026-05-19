FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/
RUN npm install --workspace=@billing/shared --workspace=@billing/frontend
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
RUN npm run build -w @billing/shared
WORKDIR /app/apps/frontend
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
COPY --from=builder /app/apps/frontend/.next ./.next
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/package.json ./
COPY --from=builder /app/node_modules ../node_modules
EXPOSE 3000
CMD ["npm", "start"]
