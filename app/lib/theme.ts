/** ธีมของเว็บ ผู้ใช้เลือกเองได้ เก็บใน cookie และในบัญชี (ถ้าล็อกอิน) */
export const THEME_IDS = ["paper", "market", "cinema"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "paper";
export const THEME_COOKIE = "rb_theme";

export type ThemeInfo = {
  id: ThemeId;
  name: string;
  description: string;
  /** สีตัวอย่างในตัวเลือกธีม: พื้น, ตัวอักษร, สีเน้น */
  swatch: [string, string, string];
  /** ฟอนต์จาก Google Fonts ที่ธีมนี้ใช้ */
  fontsHref: string;
};

export const THEMES: Record<ThemeId, ThemeInfo> = {
  paper: {
    id: "paper",
    name: "หน้ากระดาษ",
    description: "พื้นขาว สีน้ำเงินคราม เรียบ เน้นตัวหนังสือ",
    swatch: ["#ffffff", "#16171c", "#2b3a8f"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@400;600;700&display=swap",
  },
  market: {
    id: "market",
    name: "ตลาดนัดเรื่องเล่า",
    description: "สีแดงเหลืองสดใส การ์ดขอบหนา สนุก",
    swatch: ["#ffc93c", "#1d1b1a", "#e8432e"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Sarabun:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
  cinema: {
    id: "cinema",
    name: "โรงฉายนิยาย",
    description: "โทนมืด ภาพปกเด่น สบายตาตอนกลางคืน",
    swatch: ["#17121c", "#f3ece6", "#ef7a6a"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap",
  },
};

export const THEME_LIST: ThemeInfo[] = THEME_IDS.map((id) => THEMES[id]);

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

/** ธีมที่ใช้จริง: ค่าในบัญชีมาก่อน ถ้าไม่มีใช้ cookie ถ้าไม่มีอีกใช้ค่าเริ่มต้น */
export function resolveTheme(userTheme: string | null | undefined, cookieTheme: string | null | undefined): ThemeId {
  if (isThemeId(userTheme)) return userTheme;
  if (isThemeId(cookieTheme)) return cookieTheme;
  return DEFAULT_THEME;
}
