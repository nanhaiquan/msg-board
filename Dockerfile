FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate 2>/dev/null || true
EXPOSE 3000
CMD ["node", "dist/index.js"]
