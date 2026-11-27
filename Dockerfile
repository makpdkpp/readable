# สำหรับพัฒนาและทดสอบในเครื่องเท่านั้น (production รันบน Cloudflare Workers)
# ใช้ Debian ไม่ใช้ Alpine เพราะ workerd ของ Cloudflare ต้องใช้ glibc
FROM node:22-bookworm-slim

# ca-certificates: workerd ต้องใช้ตอนเริ่มทำงาน
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV WRANGLER_SEND_METRICS=false

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["sh", "scripts/docker-dev.sh"]
