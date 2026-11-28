#!/bin/sh
set -e
# สร้างตารางใน D1 จำลอง (ข้อมูลเก็บใน .wrangler/state) แล้วใส่ข้อมูลตัวอย่าง
npx wrangler d1 migrations apply readable-db --local
npx wrangler d1 execute readable-db --local --file scripts/seed.sql
exec npx react-router dev --host 0.0.0.0 --port 5173
