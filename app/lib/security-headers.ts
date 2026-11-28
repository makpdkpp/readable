/**
 * header ด้านความปลอดภัยที่ใส่ให้ทุก response
 * - กันเว็บอื่นเอาหน้าเราไปใส่ iframe หลอกให้กดปุ่ม (clickjacking) เช่นปุ่มลบบัญชี
 * - กัน browser เดาชนิดไฟล์เอง, ไม่ส่ง URL เต็มไปเว็บอื่น, บังคับ HTTPS
 * - CSP ส่วนนี้ไม่จำกัด script เพราะ React Router ใส่ script ในหน้าเอง เนื้อหานิยายกรองที่ server แล้ว
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function withSecurityHeaders(response: Response, secure: boolean): Response {
  // response บางตัว (เช่นจาก fetch) แก้ header ไม่ได้ จึงสร้างใหม่
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value);
  }
  if (secure) res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}
