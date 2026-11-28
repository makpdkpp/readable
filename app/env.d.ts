// secret ที่ไม่บังคับ ตั้งใน Cloudflare dashboard หรือไฟล์ .dev.vars ถ้าไม่ตั้ง ปุ่มล็อกอินนั้นจะไม่แสดง
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    LINE_CHANNEL_ID?: string;
    LINE_CHANNEL_SECRET?: string;
    // อีเมลที่เป็น admin เสมอ คั่นด้วยจุลภาค เช่น "a@x.com, b@y.com" ใช้ตั้ง admin คนแรกโดยไม่ต้องใช้คำสั่ง
    ADMIN_EMAILS?: string;
    // อีเมลติดต่อเรื่องข้อมูลส่วนบุคคล แสดงในหน้า /privacy
    CONTACT_EMAIL?: string;
    // หน้า /admin/monitor ดึงสถิติจาก Cloudflare GraphQL API: token สิทธิ์ Account Analytics: Read (Secret) และ Account ID (Text)
    CF_ANALYTICS_TOKEN?: string;
    CF_ACCOUNT_ID?: string;
    // แผน Workers ที่ใช้อยู่ "free" (ค่าเริ่มต้น) หรือ "paid" ใช้คำนวณค่าใช้จ่าย
    CF_PLAN?: string;
  }
}
