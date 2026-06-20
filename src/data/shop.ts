// Lotex — Electron Shop dataset.
// Toifa → sub-toifa (tovar turi) → dinamik maydon sxemalari.
// Sxemalar generik "Tovar qo'shish" formini boshqaradi; xuddi shu specs
// tovar detali modalida render qilinadi. Mazmun realistik e-xarid
// (xarid.uzex.uz) elektronika katalogi.

import type {
  LegalEntity,
  ShopCategory,
  ShopField,
  ShopProduct,
  ShopStatus,
  ShopStatusMeta,
  ShopSpec,
  ShopSubCategory,
} from "@/types/shop";

/* ---------------- legal entities (do'kon / YaTT) ---------------- */
export const LEGAL_ENTITIES: LegalEntity[] = [
  {
    id: "le1",
    name: "To'raqulova Shahnoza YaTT",
    inn: "512 894 037",
    region: "Toshkent sh.",
  },
  {
    id: "le2",
    name: "Aziz Savdo Plyus MChJ",
    inn: "308 451 720",
    region: "Toshkent sh.",
  },
  {
    id: "le3",
    name: "Rahimov Bobur YaTT",
    inn: "447 203 916",
    region: "Samarqand vil.",
  },
  {
    id: "le4",
    name: "Global Trade Group MChJ",
    inn: "201 778 634",
    region: "Toshkent sh.",
  },
  {
    id: "le5",
    name: "Nodira Biznes YaTT",
    inn: "639 015 882",
    region: "Farg'ona vil.",
  },
  {
    id: "le6",
    name: "Tashkent Supply MChJ",
    inn: "150 442 097",
    region: "Toshkent sh.",
  },
];

export const REGIONS = [
  "Toshkent sh.",
  "Toshkent vil.",
  "Samarqand vil.",
  "Buxoro vil.",
  "Andijon vil.",
  "Farg'ona vil.",
  "Namangan vil.",
  "Qashqadaryo vil.",
  "Surxondaryo vil.",
  "Navoiy vil.",
  "Jizzax vil.",
  "Sirdaryo vil.",
  "Xorazm vil.",
] as const;

/* ---------------- field option pools ---------------- */
const OPT = {
  birlik: ["dona", "komplekt", "to'plam"],
  ram: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB"],
  diskType: ["SSD", "HDD", "SSD NVMe", "eMMC"],
  diskCap: ["256 GB", "512 GB", "1 TB", "2 TB"],
  cores: ["2", "4", "6", "8", "10", "12+"],
  screen: ["13.3″", "14″", "15.6″", "17.3″", "21.5″", "23.8″", "27″"],
  res: ["1366×768", "1920×1080 (Full HD)", "2560×1440 (2K)", "3840×2160 (4K)"],
  matrix: ["TN", "IPS", "VA", "OLED"],
  yesno: ["Bor", "Yo'q"],
  ports: ["HDMI", "HDMI + VGA", "HDMI + DP", "HDMI + VGA + DP", "USB-C + HDMI"],
  warranty: ["6 oy", "12 oy", "24 oy", "36 oy"],
  warrantyType: [
    "Ishlab chiqaruvchi kafolati",
    "Sotuvchi kafolati",
    "Servis markazi",
  ],
  deliveryDays: ["1-3 kun", "3-7 kun", "7-14 kun", "14-30 kun"],
  deliveryType: ["Yetkazib berish bilan", "O'zi olib ketish", "Pochta orqali"],
  freqGhz: ["1.8 GHz", "2.0 GHz", "2.4 GHz", "2.6 GHz", "3.0 GHz"],
  speed: ["100 Mbit/s", "1 Gbit/s", "2.5 Gbit/s", "10 Gbit/s"],
  ipRating: ["IP20", "IP54", "IP65", "IP66", "IP67"],
  btu: ["7 000 BTU", "9 000 BTU", "12 000 BTU", "18 000 BTU", "24 000 BTU"],
  energy: ["A", "A+", "A++", "A+++"],
} as const;

/* shared trailing field groups appended to every schema */
function deliveryFields(): ShopField[] {
  return [
    {
      key: "warranty",
      label: "Kafolat muddati",
      type: "select",
      required: true,
      options: [...OPT.warranty],
      group: "delivery",
    },
    {
      key: "warrantyType",
      label: "Kafolat turi",
      type: "select",
      required: true,
      options: [...OPT.warrantyType],
      group: "delivery",
    },
    {
      key: "deliveryDays",
      label: "Yetkazib berish muddati",
      type: "select",
      required: true,
      options: [...OPT.deliveryDays],
      group: "delivery",
    },
    {
      key: "deliveryType",
      label: "Yetkazish turi",
      type: "select",
      required: false,
      options: [...OPT.deliveryType],
      group: "delivery",
    },
    {
      key: "region",
      label: "Hudud (viloyat / tuman)",
      type: "region",
      required: true,
      group: "delivery",
    },
  ];
}

function priceFields(): ShopField[] {
  return [
    {
      key: "price",
      label: "Narx",
      type: "number",
      required: true,
      unit: "so'm",
      group: "price",
    },
    {
      key: "stock",
      label: "Zaxira miqdori",
      type: "number",
      required: true,
      unit: "dona",
      group: "price",
    },
    {
      key: "minOrder",
      label: "Min. buyurtma",
      type: "number",
      required: false,
      unit: "dona",
      group: "price",
    },
    {
      key: "maxOrder",
      label: "Maks. buyurtma",
      type: "number",
      required: false,
      unit: "dona",
      group: "price",
    },
  ];
}

/* ---------------- category → sub-category schemas ---------------- */
type RawSub = Pick<ShopSubCategory, "id" | "name" | "suppliers"> & {
  specs: ShopSpec[];
};
interface RawCategory {
  id: string;
  name: string;
  subs: RawSub[];
}

const RAW_CATEGORIES: RawCategory[] = [
  {
    id: "comp",
    name: "Kompyuter texnikasi",
    subs: [
      {
        id: "noutbuk",
        name: "Noutbuk",
        suppliers: ["HP", "Dell", "Lenovo", "Acer", "ASUS"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "cores",
            label: "Protsessor yadrolari soni",
            required: true,
            options: [...OPT.cores],
          },
          {
            key: "freq",
            label: "Protsessor chastotasi",
            required: true,
            options: [...OPT.freqGhz],
          },
          {
            key: "ram",
            label: "Operativ xotira hajmi",
            required: true,
            options: [...OPT.ram],
          },
          {
            key: "diskType",
            label: "Xotira turi",
            required: true,
            options: [...OPT.diskType],
          },
          {
            key: "diskCap",
            label: "Xotira hajmi",
            required: true,
            options: [...OPT.diskCap],
          },
          {
            key: "screen",
            label: "Ekran o'lchami",
            required: true,
            options: [...OPT.screen],
          },
          {
            key: "res",
            label: "Ekran aniqligi",
            required: true,
            options: [...OPT.res],
          },
          {
            key: "matrix",
            label: "Matritsa turi",
            required: false,
            options: [...OPT.matrix],
          },
          {
            key: "touch",
            label: "Sensorli ekran",
            required: false,
            options: [...OPT.yesno],
          },
          {
            key: "fingerprint",
            label: "Barmoq izi skaneri",
            required: false,
            options: [...OPT.yesno],
          },
          {
            key: "webcam",
            label: "Veb-kamera",
            required: false,
            options: [...OPT.yesno],
          },
        ],
      },
      {
        id: "monitor",
        name: "Monitor",
        suppliers: ["Samsung", "LG", "Dell", "Acer", "ASUS"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "screen",
            label: "Ekran o'lchami",
            required: true,
            options: [...OPT.screen],
          },
          {
            key: "res",
            label: "Ekran aniqligi",
            required: true,
            options: [...OPT.res],
          },
          {
            key: "matrix",
            label: "Matritsa turi",
            required: true,
            options: [...OPT.matrix],
          },
          {
            key: "ports",
            label: "Ulanish portlari",
            required: true,
            options: [...OPT.ports],
          },
          {
            key: "refresh",
            label: "Yangilanish chastotasi",
            required: false,
            options: ["60 Hz", "75 Hz", "144 Hz", "165 Hz"],
          },
        ],
      },
      {
        id: "printer",
        name: "Printer / MFU",
        suppliers: ["Canon", "Epson", "HP", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "tech",
            label: "Bosib chiqarish texnologiyasi",
            required: true,
            options: ["Lazerli", "Siyohli", "Sublimatsiya"],
          },
          {
            key: "color",
            label: "Rangli bosma",
            required: true,
            options: [...OPT.yesno],
          },
          {
            key: "format",
            label: "Qog'oz formati",
            required: true,
            options: ["A4", "A3"],
          },
          {
            key: "speed",
            label: "Bosma tezligi (bet/daq)",
            required: false,
            options: ["18", "22", "28", "33"],
          },
          {
            key: "duplex",
            label: "Ikki tomonlama bosma",
            required: false,
            options: [...OPT.yesno],
          },
        ],
      },
    ],
  },
  {
    id: "net",
    name: "Tarmoq jihozlari",
    subs: [
      {
        id: "router",
        name: "Wi-Fi router",
        suppliers: ["TP-Link", "ASUS", "Cisco", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "wifi",
            label: "Wi-Fi standarti",
            required: true,
            options: ["Wi-Fi 5 (ac)", "Wi-Fi 6 (ax)", "Wi-Fi 6E"],
          },
          {
            key: "speed",
            label: "Port tezligi",
            required: true,
            options: [...OPT.speed],
          },
          {
            key: "bands",
            label: "Diapazonlar",
            required: true,
            options: ["Bir diapazon", "Ikki diapazon", "Uch diapazon"],
          },
          {
            key: "antenna",
            label: "Antennalar soni",
            required: false,
            options: ["2", "3", "4", "6+"],
          },
        ],
      },
      {
        id: "switch",
        name: "Kommutator (Switch)",
        suppliers: ["TP-Link", "Cisco", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "ports",
            label: "Portlar soni",
            required: true,
            options: ["8 port", "16 port", "24 port", "48 port"],
          },
          {
            key: "speed",
            label: "Port tezligi",
            required: true,
            options: [...OPT.speed],
          },
          {
            key: "managed",
            label: "Boshqariladigan",
            required: true,
            options: [...OPT.yesno],
          },
          {
            key: "poe",
            label: "PoE qo'llab-quvvatlash",
            required: false,
            options: [...OPT.yesno],
          },
        ],
      },
      {
        id: "ipcam",
        name: "IP kamera",
        suppliers: ["Hikvision", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "res",
            label: "Tasvir aniqligi",
            required: true,
            options: ["2 MP", "4 MP", "5 MP", "8 MP (4K)"],
          },
          {
            key: "ip",
            label: "Himoya darajasi",
            required: true,
            options: [...OPT.ipRating],
          },
          {
            key: "night",
            label: "Tungi ko'rish (IR)",
            required: true,
            options: [...OPT.yesno],
          },
          {
            key: "poe",
            label: "PoE quvvatlash",
            required: false,
            options: [...OPT.yesno],
          },
        ],
      },
    ],
  },
  {
    id: "appliance",
    name: "Maishiy texnika",
    subs: [
      {
        id: "ac",
        name: "Konditsioner",
        suppliers: ["Samsung", "LG", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "power",
            label: "Sovutish quvvati",
            required: true,
            options: [...OPT.btu],
          },
          {
            key: "type",
            label: "Turi",
            required: true,
            options: ["Split", "Inverter", "Mobil"],
          },
          {
            key: "energy",
            label: "Energiya sinfi",
            required: true,
            options: [...OPT.energy],
          },
          {
            key: "heat",
            label: "Isitish rejimi",
            required: false,
            options: [...OPT.yesno],
          },
        ],
      },
      {
        id: "tv",
        name: "Televizor",
        suppliers: ["Samsung", "LG", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "screen",
            label: "Ekran o'lchami",
            required: true,
            options: ["32″", "43″", "50″", "55″", "65″"],
          },
          {
            key: "res",
            label: "Ekran aniqligi",
            required: true,
            options: ["1366×768 (HD)", "1920×1080 (Full HD)", "3840×2160 (4K)"],
          },
          {
            key: "smart",
            label: "Smart TV",
            required: true,
            options: [...OPT.yesno],
          },
          {
            key: "matrix",
            label: "Matritsa turi",
            required: false,
            options: ["LED", "QLED", "OLED"],
          },
        ],
      },
    ],
  },
  {
    id: "acc",
    name: "Aksesuarlar",
    subs: [
      {
        id: "kbm",
        name: "Klaviatura + sichqoncha to'plami",
        suppliers: ["HP", "Lenovo", "Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "conn",
            label: "Ulanish turi",
            required: true,
            options: ["Simli (USB)", "Simsiz (2.4G)", "Bluetooth"],
          },
          {
            key: "layout",
            label: "Klaviatura tartibi",
            required: false,
            options: ["Standart", "Raqamli blokli"],
          },
        ],
      },
      {
        id: "ups",
        name: "Uzluksiz quvvat manbai (UPS)",
        suppliers: ["Boshqa"],
        specs: [
          {
            key: "birlik",
            label: "O'lchov birligi",
            required: true,
            options: [...OPT.birlik],
          },
          {
            key: "power",
            label: "Quvvat",
            required: true,
            options: ["650 VA", "850 VA", "1000 VA", "1500 VA"],
          },
          {
            key: "outlets",
            label: "Rozetkalar soni",
            required: false,
            options: ["2", "4", "6", "8"],
          },
        ],
      },
    ],
  },
];

/* attach price + delivery + description to every sub schema */
export const SHOP_CATEGORIES: ShopCategory[] = RAW_CATEGORIES.map((cat) => ({
  id: cat.id,
  name: cat.name,
  subs: cat.subs.map((sub) => ({
    ...sub,
    fields: [
      ...sub.specs.map(
        (s): ShopField => ({
          ...s,
          type: "select",
          group: s.required ? "specs-req" : "specs-opt",
        }),
      ),
      ...priceFields(),
      ...deliveryFields(),
      {
        key: "conditions",
        label: "Tavsif va shartlar",
        type: "textarea",
        required: false,
        group: "desc",
      },
    ],
  })),
}));

/* lookup helpers */
export function shopSub(catId: string, subId: string): ShopSubCategory | null {
  const c = SHOP_CATEGORIES.find((x) => x.id === catId);
  return c ? (c.subs.find((s) => s.id === subId) ?? null) : null;
}

export function shopCatName(catId: string): string {
  return SHOP_CATEGORIES.find((x) => x.id === catId)?.name ?? "";
}

/** id'lar ro'yxatidan legal entity nomlarini qaytaradi. */
export function entityNames(ids: string[]): string[] {
  return ids
    .map((id) => LEGAL_ENTITIES.find((e) => e.id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

/* ---------------- status meta ---------------- */
export const STATUS_SHOP: Record<ShopStatus, ShopStatusMeta> = {
  published: { label: "E'lon qilingan", cls: "published" },
  moderation: { label: "Moderatsiyada", cls: "moderation" },
  rejected: { label: "Rad etilgan", cls: "rejected" },
};

/* ---------------- existing products (Page A list) ---------------- */
export const SHOP_PRODUCTS: ShopProduct[] = [
  // Kompyuter texnikasi
  {
    id: "p1",
    cat: "comp",
    sub: "noutbuk",
    name: "Noutbuk HP ProBook 450 G10",
    brand: "HP",
    price: 9_850_000,
    entities: ["le1", "le4", "le6"],
    status: "published",
    specs: [
      ["Protsessor yadrolari soni", "10"],
      ["Operativ xotira hajmi", "16 GB"],
      ["Xotira turi", "SSD NVMe"],
      ["Xotira hajmi", "512 GB"],
      ["Ekran o'lchami", "15.6″"],
      ["Ekran aniqligi", "1920×1080 (Full HD)"],
      ["Matritsa turi", "IPS"],
      ["Barmoq izi skaneri", "Bor"],
    ],
  },
  {
    id: "p2",
    cat: "comp",
    sub: "noutbuk",
    name: "Noutbuk Lenovo V15 G4",
    brand: "Lenovo",
    price: 7_240_000,
    entities: ["le1", "le2"],
    status: "moderation",
    specs: [
      ["Protsessor yadrolari soni", "8"],
      ["Operativ xotira hajmi", "8 GB"],
      ["Xotira turi", "SSD"],
      ["Xotira hajmi", "256 GB"],
      ["Ekran o'lchami", "15.6″"],
      ["Ekran aniqligi", "1920×1080 (Full HD)"],
    ],
  },
  {
    id: "p3",
    cat: "comp",
    sub: "monitor",
    name: "Monitor Samsung S24R350 23.8″ IPS",
    brand: "Samsung",
    price: 1_690_000,
    entities: ["le4"],
    status: "published",
    specs: [
      ["Ekran o'lchami", "23.8″"],
      ["Ekran aniqligi", "1920×1080 (Full HD)"],
      ["Matritsa turi", "IPS"],
      ["Ulanish portlari", "HDMI + VGA"],
      ["Yangilanish chastotasi", "75 Hz"],
    ],
  },
  {
    id: "p4",
    cat: "comp",
    sub: "printer",
    name: "Canon i-SENSYS LBP6030 lazerli printer",
    brand: "Canon",
    price: 1_280_000,
    entities: ["le1", "le2", "le4", "le6"],
    status: "published",
    specs: [
      ["Bosib chiqarish texnologiyasi", "Lazerli"],
      ["Rangli bosma", "Yo'q"],
      ["Qog'oz formati", "A4"],
      ["Bosma tezligi (bet/daq)", "18"],
    ],
  },
  {
    id: "p5",
    cat: "comp",
    sub: "printer",
    name: "Epson L3250 rangli MFU (siyohli)",
    brand: "Epson",
    price: 3_120_000,
    entities: ["le3"],
    status: "rejected",
    specs: [
      ["Bosib chiqarish texnologiyasi", "Siyohli"],
      ["Rangli bosma", "Bor"],
      ["Qog'oz formati", "A4"],
      ["Ikki tomonlama bosma", "Yo'q"],
    ],
  },

  // Tarmoq jihozlari
  {
    id: "p6",
    cat: "net",
    sub: "router",
    name: "Wi-Fi router TP-Link Archer AX23 (Wi-Fi 6)",
    brand: "TP-Link",
    price: 720_000,
    entities: ["le4", "le6"],
    status: "published",
    specs: [
      ["Wi-Fi standarti", "Wi-Fi 6 (ax)"],
      ["Port tezligi", "1 Gbit/s"],
      ["Diapazonlar", "Ikki diapazon"],
      ["Antennalar soni", "4"],
    ],
  },
  {
    id: "p7",
    cat: "net",
    sub: "switch",
    name: "Kommutator TP-Link TL-SG1024 (24 port)",
    brand: "TP-Link",
    price: 1_540_000,
    entities: ["le4"],
    status: "moderation",
    specs: [
      ["Portlar soni", "24 port"],
      ["Port tezligi", "1 Gbit/s"],
      ["Boshqariladigan", "Yo'q"],
      ["PoE qo'llab-quvvatlash", "Yo'q"],
    ],
  },
  {
    id: "p8",
    cat: "net",
    sub: "ipcam",
    name: "IP kamera Hikvision DS-2CD1043G2 (4 MP)",
    brand: "Hikvision",
    price: 890_000,
    entities: ["le1", "le4", "le6"],
    status: "published",
    specs: [
      ["Tasvir aniqligi", "4 MP"],
      ["Himoya darajasi", "IP67"],
      ["Tungi ko'rish (IR)", "Bor"],
      ["PoE quvvatlash", "Bor"],
    ],
  },

  // Maishiy texnika
  {
    id: "p9",
    cat: "appliance",
    sub: "ac",
    name: "Konditsioner Samsung AR12 (12 000 BTU, Inverter)",
    brand: "Samsung",
    price: 5_450_000,
    entities: ["le2", "le4"],
    status: "published",
    specs: [
      ["Sovutish quvvati", "12 000 BTU"],
      ["Turi", "Inverter"],
      ["Energiya sinfi", "A++"],
      ["Isitish rejimi", "Bor"],
    ],
  },
  {
    id: "p10",
    cat: "appliance",
    sub: "tv",
    name: "Televizor LG 50UR78 50″ 4K Smart",
    brand: "LG",
    price: 6_180_000,
    entities: ["le1"],
    status: "moderation",
    specs: [
      ["Ekran o'lchami", "50″"],
      ["Ekran aniqligi", "3840×2160 (4K)"],
      ["Smart TV", "Bor"],
      ["Matritsa turi", "LED"],
    ],
  },

  // Aksesuarlar
  {
    id: "p11",
    cat: "acc",
    sub: "kbm",
    name: "Klaviatura + sichqoncha to'plami HP CS10 (simsiz)",
    brand: "HP",
    price: 240_000,
    entities: ["le1", "le2", "le3", "le4", "le5", "le6"],
    status: "published",
    specs: [
      ["Ulanish turi", "Simsiz (2.4G)"],
      ["Klaviatura tartibi", "Raqamli blokli"],
    ],
  },
  {
    id: "p12",
    cat: "acc",
    sub: "ups",
    name: "UPS 850 VA (liniya-interaktiv)",
    brand: "Boshqa",
    price: 680_000,
    entities: ["le4", "le6"],
    status: "published",
    specs: [
      ["Quvvat", "850 VA"],
      ["Rozetkalar soni", "4"],
    ],
  },
];
