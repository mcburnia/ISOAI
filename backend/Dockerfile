FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p /app/data

# 1. Create schemas (tenant_template + platform) — must exist before Prisma migrate
# 2. Run Prisma migrations (creates tenant model tables in tenant_template schema)
# 3. Seed platform + default tenant data
# 4. Start the dev server
CMD ["sh", "-c", "npx tsx prisma/setup-schemas.ts && npx prisma migrate deploy && npx prisma db seed && npm run dev"]
