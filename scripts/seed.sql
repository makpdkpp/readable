-- ข้อมูลตัวอย่างสำหรับทดสอบในเครื่อง รันซ้ำได้ไม่ซ้ำข้อมูล
INSERT OR IGNORE INTO users (id, email, display_name, role, birth_date) VALUES
  ('seed-writer', 'writer@example.com', 'นักเขียนตัวอย่าง', 'writer', '1995-04-12'),
  ('seed-admin', 'admin@example.com', 'แอดมิน', 'admin', '1990-01-01');

INSERT OR IGNORE INTO categories (id, slug, name) VALUES
  (1, 'romance', 'โรแมนติก'),
  (2, 'fantasy', 'แฟนตาซี');

INSERT OR IGNORE INTO novels (id, author_id, title, synopsis, category_id, rating, status) VALUES
  (1, 'seed-writer', 'ฝนแรกที่เชียงใหม่', 'เรื่องราวของสองคนที่บังเอิญติดฝนอยู่ร้านกาแฟเดียวกัน', 1, 'all', 'ongoing'),
  (2, 'seed-writer', 'ประตูมิติหลังตลาดนัด', 'เด็กมัธยมเจอประตูลึกลับที่พาไปอีกโลก', 2, '13+', 'completed'),
  (3, 'seed-writer', 'คืนที่ไม่มีใครหลับ', 'เรื่อง 18+ ที่รอ admin อนุมัติ ไม่ควรขึ้นหน้าแรก', 1, '18+', 'pending_review');

INSERT OR IGNORE INTO chapters (id, novel_id, number, title, content_json, content_html, word_count, status, publish_at) VALUES
  (1, 1, 1, 'ร้านกาแฟตอนบ่าย',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ฝนตกลงมาโดยไม่มีใครทันตั้งตัว"}]}]}',
   '<p>ฝนตกลงมาโดยไม่มีใครทันตั้งตัว</p>', 8, 'published', unixepoch()),
  (2, 1, 2, 'แก้วที่สอง',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"เธอสั่งลาเต้แก้วที่สองโดยไม่ได้ตั้งใจ"}]}]}',
   '<p>เธอสั่งลาเต้แก้วที่สองโดยไม่ได้ตั้งใจ</p>', 9, 'draft', NULL);
