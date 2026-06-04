FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production 2>/dev/null || npm install
COPY . .
RUN npx prisma generate 2>/dev/null || true
EXPOSE 3000
CMD ["npx", "tsx", "index.ts"]
