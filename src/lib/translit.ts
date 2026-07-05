// Lotin → kirill translit — hudud/tuman qidiruvi uchun (nomlar kirillcha,
// foydalanuvchi lotinda yozsa ham topilsin). Backenddagi to'liq variantning
// qidiruv uchun yetarli soddalashtirilgani.

const APOSTROPHES = /[ʻʼ‘’`´]/g;

// Uzunroq birikmalar birinchi — greedy moslashuv uchun tartib muhim.
const LAT_TO_CYR: [string, string][] = [
  ["o'", "ў"],
  ["g'", "ғ"],
  ["sh", "ш"],
  ["ch", "ч"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ts", "ц"],
  ["a", "а"],
  ["b", "б"],
  ["d", "д"],
  ["e", "е"],
  ["f", "ф"],
  ["g", "г"],
  ["h", "ҳ"],
  ["i", "и"],
  ["j", "ж"],
  ["k", "к"],
  ["l", "л"],
  ["m", "м"],
  ["n", "н"],
  ["o", "о"],
  ["p", "п"],
  ["q", "қ"],
  ["r", "р"],
  ["s", "с"],
  ["t", "т"],
  ["u", "у"],
  ["v", "в"],
  ["w", "в"],
  ["x", "х"],
  ["y", "й"],
  ["z", "з"],
];

export function latinToCyrillic(s: string): string {
  const src = s.replace(APOSTROPHES, "'").toLowerCase();
  let out = "";
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (const [from, to] of LAT_TO_CYR) {
      if (src.startsWith(from, i)) {
        out += to;
        i += from.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += src[i];
      i++;
    }
  }
  return out;
}

// Fonetik folding — o'zbek/rus toponim yozuv farqlarini tenglashtiradi
// ("Тошкент" ↔ "Ташкент", "Қашқадарё" ↔ "Кашкадарья").
const FOLD_MAP: Record<string, string> = {
  а: "о",
  қ: "к",
  ғ: "г",
  ҳ: "х",
  ў: "у",
  ё: "е",
  й: "и",
  э: "е",
  ы: "и",
  ь: "",
  ъ: "",
  "'": "",
};

const fold = (s: string): string =>
  [...s.toLowerCase()].map((c) => FOLD_MAP[c] ?? c).join("");

/** Nom qidiruv so'roviga mosmi — to'g'ridan-to'g'ri, translit yoki folding orqali. */
export function matchesQuery(name: string, q: string): boolean {
  const n = name.toLowerCase();
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  if (n.includes(ql)) return true;
  const fn = fold(n);
  return fn.includes(fold(ql)) || fn.includes(fold(latinToCyrillic(ql)));
}
