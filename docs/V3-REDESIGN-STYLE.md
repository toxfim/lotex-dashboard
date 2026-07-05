# V3 Redesign — kod uslubi va arxitektura qoidalari

Bu hujjat v3 branchdagi qayta dizayn ishining **majburiy** uslub qoidalari.
CLAUDE.md dagi umumiy konventsiyalar amal qiladi; quyidagilar ularga qo'shimcha.

## Manba va maqsad

- Vizual manba: claude.ai/design ishlab chiqqan standalone HTML prototip
  (`~/Downloads/Lotex Dashboard*.html`). Undan **dizayn tokenlar, layout va
  vizual til** olinadi — markup yoki JS logikasi ko'chirilmaydi.
- Biznes-logika (stores, composables, api, mappers) **o'zgarmaydi**.
  Redesign = prezentatsion qatlam: tokenlar, komponent stillari, layout.

## CSS arxitekturasi (monolitni bo'lish)

`src/assets/main.css` (4300+ qator) v3 da qatlamlarga bo'linadi:

```text
src/assets/
  styles/
    tokens.css      # :root dizayn tokenlari — yagona haqiqat manbai
    base.css        # reset, body, typography, scrollbar
    layout.css      # .app-shell, sidebar, topbar, kontent panellari
    components.css  # umumiy primitivlar: btn, chip, card, table, modal, drawer
    pages/          # sahifaga xos stillar (queue.css, shop.css, ...)
  main.css          # faqat @import zanjiri + tailwind
```

Qoidalar:

- Har CSS fayl **≤ 400 qator**; oshsa mavzu bo'yicha bo'linadi.
- Rang/o'lcham literal yozilmaydi — faqat `var(--token)`. Yangi qiymat kerak
  bo'lsa avval `tokens.css` ga token qo'shiladi.
- Klass nomlari mavjud BEM-siz qisqa uslubda qoladi (`.lot-card`, `.ost-chip`) —
  ommaviy rename qilinmaydi, faqat stil qiymatlari yangilanadi.

## Komponent qoidalari

- Yangi vizual primitiv 2+ joyda takrorlansa — `src/components/ui/` ga
  komponent sifatida chiqariladi (`UiStatCard.vue`, `UiStatusChip.vue` kabi),
  props generic-typed, biznes-logikasiz.
- View fayllari **≤ 400 qator**ga intiladi: katta bo'laklar
  `src/components/<domen>/` ga ajratiladi.
- `<style scoped>` faqat shu komponentgagina xos, boshqa joyda takrorlanmaydigan
  stil uchun; umumiy narsa `styles/` ga.

## Jarayon tartibi

1. Prototip HTML dan tokenlarni chiqarish (palitra, radius, shadow, font).
2. `tokens.css` yangilash → butun app darhol yangi ranglarga o'tadi.
3. Layout (sidebar/topbar/shell) prototipga moslash.
4. Sahifama-sahifa stil yangilash, har sahifadan keyin vizual tekshirish
   (headless screenshot bilan solishtirish).
5. `bun run lint` + typecheck + build har bosqichda toza bo'lishi shart.

## Tekshiruv

- Har sahifa static-data rejimida (VITE_API_BASE=/api/staticDatas) ochilib
  screenshot qilinadi va prototip bilan yonma-yon solishtiriladi.
- Regressiya: barcha 10 sahifa render bo'lishi, konsolda xato yo'qligi.
