# readable

เว็บแอปสำหรับนักเขียนและนักอ่านนิยายภาษาไทย รันบน Cloudflare Workers

แผนพัฒนาทั้งหมดอยู่ที่ [docs/PLAN.md](docs/PLAN.md)

## Stack

React Router (SSR) · Cloudflare Workers · D1 + Drizzle ORM · Tailwind CSS · Vitest

## เริ่มพัฒนาในเครื่อง

```bash
npm install
npm run db:migrate:local   # สร้างตารางใน D1 จำลองในเครื่อง
npm run dev                # เปิด http://localhost:5173
```

คำสั่งอื่น

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | รัน unit test |
| `npm run typecheck` | ตรวจ type |
| `npm run db:generate` | สร้างไฟล์ migration ใหม่หลังแก้ `app/db/schema.ts` |

## Deploy ครั้งแรก

1. `npx wrangler login`
2. `npx wrangler d1 create readable-db` แล้วนำ `database_id` ที่ได้ไปใส่ใน `wrangler.jsonc`
3. ใน GitHub repo ไปที่ Settings → Secrets and variables → Actions แล้วเพิ่ม `CLOUDFLARE_API_TOKEN` (สิทธิ์ Workers Scripts: Edit และ D1: Edit) กับ `CLOUDFLARE_ACCOUNT_ID`
4. ทุกครั้งที่ merge เข้า `main` ระบบจะรัน migration และ deploy ให้อัตโนมัติ
