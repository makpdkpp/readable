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

## หน้าเว็บหลัก

| URL | ใช้ทำอะไร |
|---|---|
| `/write` | นิยายของฉัน สร้างเรื่อง แก้ข้อมูลเรื่อง อัปโหลดปก เผยแพร่เรื่อง |
| `/write/:id/chapters/:chapterId` | เขียนตอน บันทึกร่าง เผยแพร่ทันที หรือตั้งเวลาเผยแพร่ (เวลาไทย) |
| `/novel/:id` | หน้าเรื่องสำหรับนักอ่าน พร้อมสารบัญ |
| `/novel/:id/chapter/:chapterId` | หน้าอ่านตอน ปรับขนาดตัวอักษร ระยะบรรทัด และสีพื้นหลังได้ |
| `/library` | ชั้นหนังสือและประวัติการอ่าน |
| `/search` | ค้นหาชื่อเรื่อง ชื่อนักเขียน แท็ก และเลือกหมวด |
| `/privacy` | นโยบายความเป็นส่วนตัว (PDPA) ลิงก์อยู่ท้ายทุกหน้าและในหน้าสมัคร |
| `/admin` | (admin) อนุมัติ 18+ ซ่อนเรื่อง/คอมเมนต์ ตั้งสิทธิ์ผู้ใช้ |

กฎเรื่อง 18+

- เรื่อง 18+ กดเผยแพร่แล้วจะเป็น "รอ admin อนุมัติ" อนุมัติครั้งเดียวต่อเรื่อง ตอนใหม่หลังจากนั้นเผยแพร่ได้เลย
- ถ้าเรื่องที่ขึ้นเว็บแล้วเปลี่ยนเรตเป็น 18+ จะกลับไปรออนุมัติใหม่
- นักอ่านต้องล็อกอินและกรอกวันเกิดว่าอายุ 18 ปีขึ้นไป คนอื่นเห็นแค่ชื่อเรื่องกับป้าย 18+ หน้าเรื่อง 18+ ตั้ง `noindex`
- ตอนที่ตั้งเวลาไว้จะขึ้นเว็บเองเมื่อถึงเวลา ไม่ต้องมี cron

## แอดมิน

หน้าแอดมินอยู่ที่ `/admin` มี 5 แท็บ

| แท็บ | ใช้ทำอะไร |
|---|---|
| อนุมัติ 18+ (`/admin/review`) | อนุมัติหรือไม่อนุมัติเรื่อง 18+ และเปิดเรื่องที่ถูกซ่อนคืน |
| เรื่อง (`/admin/novels`) | ค้นหาเรื่องที่เผยแพร่อยู่แล้วซ่อน (ต้องใส่เหตุผล นักเขียนจะเห็น) |
| คอมเมนต์ (`/admin/comments`) | ดูคอมเมนต์ล่าสุด ซ่อน/เลิกซ่อน (ซ่อนจากหน้าอ่านตอนได้ด้วย) |
| ผู้ใช้ (`/admin/users`) | ตั้งสิทธิ์ นักอ่าน / นักเขียน / แอดมิน |
| ติดตามระบบ (`/admin/monitor`) | สถานะเว็บ โควตาฟรีของ Cloudflare ค่าใช้จ่ายโดยประมาณ และสถิติการใช้งาน |

ตั้งแอดมินคนแรกโดยไม่ต้องใช้คำสั่ง

1. สมัครสมาชิกบนเว็บด้วยอีเมลของคุณ **ก่อน** (สำคัญ: ถ้าตั้งตัวแปรก่อนสมัคร คนอื่นอาจสมัครด้วยอีเมลนั้นก่อนได้ เพราะยังไม่มีระบบยืนยันอีเมล)
2. Cloudflare dashboard → Workers & Pages → readable → Settings → Variables and Secrets → Add → ชนิด Text ชื่อ `ADMIN_EMAILS` ค่าเป็นอีเมลของคุณ (หลายคนคั่นด้วยจุลภาค)
3. เปิดเว็บใหม่ บัญชีนั้นจะเป็นแอดมินทันที จากนั้นตั้งแอดมินคนอื่นได้ที่ `/admin/users`

คนที่อยู่ใน `ADMIN_EMAILS` จะเป็นแอดมินเสมอ ลดสิทธิ์จากหน้าเว็บไม่ได้ และแอดมินลดสิทธิ์ตัวเองไม่ได้ (กันไม่ให้ไม่มีแอดมินเหลือ)

ยังใช้คำสั่งเดิมได้ถ้าต้องการ

```bash
npx wrangler d1 execute readable-db --remote --command "UPDATE users SET role='admin' WHERE email='อีเมลของคุณ'"
```

## ติดตามระบบและค่าใช้จ่าย (`/admin/monitor`)

แท็บ "ติดตามระบบ" ในหน้าแอดมินแสดง

- สถานะตอนนี้: ความเร็ว D1, requests และ error วันนี้, CPU ต่อ request (แผนฟรีจำกัด 10 ms)
- โควตาฟรีรายวัน: Workers 100,000 requests, D1 อ่าน 5 ล้านแถว, เขียน 100,000 แถว (รีเซ็ต 07:00 น. เวลาไทย) และพื้นที่ D1 5 GB
- ค่าใช้จ่ายโดยประมาณต่อเดือน ทั้งแผนที่ใช้อยู่และถ้าเปลี่ยนแผน (ราคาอยู่ใน `app/lib/monitor/pricing.ts`)
- กราฟ requests 30 วัน และกิจกรรมบนเว็บ (สมาชิก คนอ่าน เรื่อง ตอน คอมเมนต์ สมัครใหม่รายวัน)

กิจกรรมบนเว็บใช้ได้ทันที ส่วนข้อมูลจาก Cloudflare ต้องตั้งค่าก่อน

1. Cloudflare dashboard → รูปโปรไฟล์ขวาบน → My Profile → API Tokens → Create Token → Create Custom Token
2. ตั้งชื่อ เช่น `readable-analytics` · Permissions: **Account → Account Analytics → Read** อย่างเดียว · Account Resources: บัญชีของคุณ → Continue to summary → Create Token แล้วคัดลอก token (แสดงครั้งเดียว)
3. Workers & Pages → readable → Settings → Variables and Secrets → Add → ชนิด **Secret** ชื่อ `CF_ANALYTICS_TOKEN`
4. Add อีกตัว ชนิด Text ชื่อ `CF_ACCOUNT_ID` ค่าเป็น Account ID (เลขยาวใน URL ของ dashboard หรือเมนู ⋯ ข้างชื่อบัญชี → Copy account ID)
5. ถ้าอัปเกรดเป็น Workers Paid ให้เพิ่ม Text ชื่อ `CF_PLAN` ค่า `paid`

token นี้อ่านสถิติได้อย่างเดียว แก้ไขหรือลบอะไรในบัญชีไม่ได้ ข้อมูลจาก Cloudflare เก็บ cache ไว้ 5 นาที กดปุ่ม "ดึงข้อมูลใหม่" เพื่อโหลดทันที

## นโยบายความเป็นส่วนตัว (PDPA)

หน้า `/privacy` อธิบายข้อมูลที่เก็บ วัตถุประสงค์ ผู้ที่ได้รับข้อมูล (Cloudflare, Google/LINE, Google Fonts) ระยะเวลาเก็บ และสิทธิ์ของผู้ใช้
ผู้ใช้ลบบัญชีและข้อมูลทั้งหมดได้เองที่หน้าโปรไฟล์

ตั้งอีเมลติดต่อที่จะแสดงในหน้านี้: Cloudflare dashboard → Workers & Pages → readable → Settings → Variables and Secrets → Add → ชนิด Text ชื่อ `CONTACT_EMAIL`
ถ้าไม่ตั้ง หน้าจะขึ้นว่า "ผู้ดูแลเว็บยังไม่ได้ระบุอีเมลติดต่อ"

## รูปปก (R2)

ปกนิยายเก็บใน R2 bucket ชื่อ `readable-covers` (binding `COVERS` ใน `wrangler.jsonc`) ต้องสร้าง bucket ก่อน deploy ครั้งแรก ไม่งั้น deploy จะล้ม

- Cloudflare dashboard → R2 Object Storage → Create bucket → ชื่อ `readable-covers` → Create
- หรือใช้คำสั่ง `npx wrangler r2 bucket create readable-covers`

ในเครื่องและใน Docker ไม่ต้องทำอะไร wrangler จำลอง R2 ให้เอง

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
