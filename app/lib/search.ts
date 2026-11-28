export const SEARCH_MAX_LENGTH = 100;

/** ทำความสะอาดคำค้น: ตัดช่องว่างซ้ำ ตัด # หน้าคำ (เผื่อพิมพ์แท็ก) และจำกัดความยาว */
export function normalizeQuery(raw: string | null): string {
  return (raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+/, "")
    .slice(0, SEARCH_MAX_LENGTH)
    .toLowerCase();
}

/**
 * แปลงคำค้นเป็น pattern สำหรับ LIKE ... ESCAPE '\'
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงค้นแบบ "มีข้อความนี้อยู่ตรงไหนก็ได้" ซึ่งหาคำกลางชื่อเรื่องเจอ
 * และใช้ได้กับคำสั้น 1-2 ตัวอักษร (FTS5 trigram ต้องยาว 3 ตัวขึ้นไป)
 */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
