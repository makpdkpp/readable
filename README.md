# readable

เว็บแอปสำหรับนักเขียนและนักอ่านนิยายภาษาไทย รันบน Cloudflare Workers

แผนพัฒนาทั้งหมดอยู่ที่ [docs/PLAN.md](docs/PLAN.md)

## Stack

React Router (SSR) · Cloudflare Workers · D1 + Drizzle ORM · Tailwind CSS · Vitest

## รันในเครื่องด้วย Docker (แนะนำ)

ไม่ต้องติดตั้ง Node และไม่ต้องมีบัญชี Cloudflare ฐานข้อมูล D1 จะจำลองอยู่ในเครื่อง

```bash
docker compose up --build
```

เปิด http://localhost:5173 จะเห็นนิยายตัวอย่าง 2 เรื่อง (เรื่อง 18+ ที่รออนุมัติจะไม่แสดง)

- แก้โค้ดแล้วหน้าเว็บจะรีเฟรชเอง
- ข้อมูลในฐานข้อมูลเก็บใน `.wrangler/state` ถ้าอยากล้างทั้งหมดให้ลบโฟลเดอร์นี้แล้วรันใหม่
- ถ้ามีการเพิ่ม package ใหม่ ให้รัน `docker compose up --build -V`
- รัน test ใน container: `docker compose run --rm web npm test`

## เริ่มพัฒนาในเครื่อง (ไม่ใช้ Docker)

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

## Deploy (Cloudflare Workers Builds)

repo นี้เชื่อมกับ Cloudflare Workers Builds ทุกครั้งที่ push เข้า `main` Cloudflare จะ build และ deploy ให้เอง

ตั้งค่าใน Cloudflare dashboard → Workers & Pages → readable → Settings → Build

| ช่อง | ค่า |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npm run deploy:workers-builds` |

Deploy command นี้จะสร้าง/อัปเดตตารางใน D1 (`readable-db`) ก่อน แล้วค่อย deploy ถ้าใช้ค่าเริ่มต้น `npx wrangler deploy` ตารางจะไม่ถูกสร้าง และหน้าเว็บจะขึ้น "เกิดข้อผิดพลาด"

ถ้าต้องการรัน migration เองจากเครื่อง:

```bash
npx wrangler login
npm run db:migrate:remote
```

## ระบบล็อกอิน

- สมัคร/ล็อกอินด้วยอีเมลและรหัสผ่านใช้ได้ทันที ไม่ต้องตั้งค่าอะไร
- ปุ่ม Google และ LINE จะแสดงเมื่อตั้ง secret ครบคู่เท่านั้น
- ในเครื่อง: คัดลอก `.dev.vars.example` เป็น `.dev.vars` แล้วใส่ค่า
- บนเว็บจริง: Cloudflare dashboard → Workers & Pages → readable → Settings → Variables and Secrets → Add → เลือกชนิด Secret

| Secret | ได้มาจาก |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application) |
| `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` | LINE Developers Console → Provider → LINE Login channel → Basic settings |

Callback URL ที่ต้องลงทะเบียนกับ Google/LINE

- `https://readable.b-kongman.workers.dev/auth/google/callback`
- `https://readable.b-kongman.workers.dev/auth/line/callback`
- (ทดสอบในเครื่อง) `http://localhost:5173/auth/google/callback`, `http://localhost:5173/auth/line/callback`
