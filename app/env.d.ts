// secret ที่ไม่บังคับ ตั้งใน Cloudflare dashboard หรือไฟล์ .dev.vars ถ้าไม่ตั้ง ปุ่มล็อกอินนั้นจะไม่แสดง
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    LINE_CHANNEL_ID?: string;
    LINE_CHANNEL_SECRET?: string;
  }
}
