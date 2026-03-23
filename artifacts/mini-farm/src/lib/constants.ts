export interface CropConfig {
  id: string;
  name: string;
  emoji: string;
  seedCost: number;
  sellPrice: number;
  growTimeSec: number;
  description: string;
  unlockLevel: number;
}

export interface AnimalConfig {
  type: string;
  name: string;
  emoji: string;
  cost: number;
  productType: string;
  productReadySec: number;
  unlockLevel: number;
}

export interface BuildingConfig {
  type: string;
  name: string;
  emoji: string;
  cost: number;
  unlockLevel: number;
  shelter?: boolean;
}

export interface RecipeConfig {
  id: string;
  name: string;
  building: string;
  inputs: { itemId: string; quantity: number }[];
  outputId: string;
  outputQty: number;
  craftSec: number;
  sellPrice: number;
}

export const CROPS: Record<string, CropConfig> = {
  wheat:        { id: "wheat",        name: "Пшеница",        emoji: "🌾", seedCost: 5,   sellPrice: 8,   growTimeSec: 30,   description: "Быстро растёт, идеально для начала.", unlockLevel: 1 },
  carrot:       { id: "carrot",       name: "Морковь",        emoji: "🥕", seedCost: 10,  sellPrice: 16,  growTimeSec: 60,   description: "Хрустящая и прибыльная.", unlockLevel: 1 },
  tomato:       { id: "tomato",       name: "Помидор",        emoji: "🍅", seedCost: 20,  sellPrice: 35,  growTimeSec: 120,  description: "Сочный и выгодный.", unlockLevel: 2 },
  corn:         { id: "corn",         name: "Кукуруза",       emoji: "🌽", seedCost: 35,  sellPrice: 80,  growTimeSec: 300,  description: "Золото полей.", unlockLevel: 3 },
  strawberry:   { id: "strawberry",   name: "Клубника",       emoji: "🍓", seedCost: 60,  sellPrice: 180, growTimeSec: 600,  description: "Сладкий и дорогой ягодный.", unlockLevel: 4 },
  sunflower:    { id: "sunflower",    name: "Подсолнух",      emoji: "🌻", seedCost: 80,  sellPrice: 220, growTimeSec: 900,  description: "Яркий символ лета.", unlockLevel: 5 },
  pumpkin:      { id: "pumpkin",      name: "Тыква",          emoji: "🎃", seedCost: 150, sellPrice: 500, growTimeSec: 1800, description: "Осенняя королева.", unlockLevel: 7 },
  // 🌲 Лесная ферма
  blueberry:    { id: "blueberry",    name: "Голубика",       emoji: "🫐", seedCost: 25,  sellPrice: 65,  growTimeSec: 180,  description: "Лесная ягода, растёт быстро.", unlockLevel: 1 },
  mushroom:     { id: "mushroom",     name: "Гриб",           emoji: "🍄", seedCost: 70,  sellPrice: 185, growTimeSec: 500,  description: "Дикий гриб, редкий и ценный.", unlockLevel: 1 },
  // 🏜️ Пустыня
  cactus_fruit: { id: "cactus_fruit", name: "Плод кактуса",  emoji: "🌵", seedCost: 110, sellPrice: 330, growTimeSec: 1200, description: "Медленно, но очень выгодно.", unlockLevel: 1 },
  dates:        { id: "dates",        name: "Финики",         emoji: "🌴", seedCost: 190, sellPrice: 680, growTimeSec: 2400, description: "Редкий деликатес пустыни.", unlockLevel: 1 },
  // ❄️ Снежная ферма
  cranberry:    { id: "cranberry",    name: "Клюква",         emoji: "🍒", seedCost: 45,  sellPrice: 115, growTimeSec: 400,  description: "Кислая ягода севера.", unlockLevel: 1 },
  ice_root:     { id: "ice_root",     name: "Ледяной корень", emoji: "🌿", seedCost: 110, sellPrice: 285, growTimeSec: 800,  description: "Мистический корень тундры.", unlockLevel: 1 },
};

export const ANIMALS: Record<string, AnimalConfig> = {
  chicken: { type: "chicken", name: "Курица",   emoji: "🐔", cost: 200,  productType: "egg",   productReadySec: 300, unlockLevel: 2 },
  cow:     { type: "cow",     name: "Корова",   emoji: "🐄", cost: 600,  productType: "milk",  productReadySec: 600, unlockLevel: 4 },
  sheep:   { type: "sheep",   name: "Овца",     emoji: "🐑", cost: 400,  productType: "wool",  productReadySec: 480, unlockLevel: 3 },
  pig:     { type: "pig",     name: "Свинья",   emoji: "🐷", cost: 800,  productType: "meat",  productReadySec: 720, unlockLevel: 5 },
  bee:     { type: "bee",     name: "Пчела",    emoji: "🐝", cost: 1200, productType: "honey", productReadySec: 600, unlockLevel: 7 },
};

export const BUILDINGS: Record<string, BuildingConfig> = {
  barn:    { type: "barn",    name: "Амбар",        emoji: "🏚️", cost: 150, unlockLevel: 1, shelter: true },
  mill:    { type: "mill",    name: "Мельница",     emoji: "⚙️",  cost: 300, unlockLevel: 3 },
  bakery:  { type: "bakery",  name: "Пекарня",      emoji: "🍞",  cost: 600, unlockLevel: 5 },
  kitchen: { type: "kitchen", name: "Кухня",        emoji: "🍳",  cost: 900, unlockLevel: 6 },
  dairy:   { type: "dairy",   name: "Молочный цех", emoji: "🧀",  cost: 800, unlockLevel: 7 },
};

export const RECIPES: Record<string, RecipeConfig> = {
  // ── Мельница
  flour:        { id: "flour",        name: "Мука",               building: "mill",   inputs: [{ itemId: "wheat",      quantity: 2 }],                                                    outputId: "flour",        outputQty: 1, craftSec: 60,   sellPrice: 20   },
  corn_starch:  { id: "corn_starch",  name: "Кукурузный крахмал", building: "mill",   inputs: [{ itemId: "corn",       quantity: 2 }],                                                    outputId: "corn_starch",  outputQty: 1, craftSec: 90,   sellPrice: 180  },
  berry_juice:  { id: "berry_juice",  name: "Ягодный сок",        building: "mill",   inputs: [{ itemId: "blueberry",  quantity: 3 }],                                                    outputId: "berry_juice",  outputQty: 1, craftSec: 120,  sellPrice: 160  },
  // ── Пекарня
  bread:        { id: "bread",        name: "Хлеб",               building: "bakery", inputs: [{ itemId: "flour",       quantity: 1 }, { itemId: "egg",      quantity: 1 }],              outputId: "bread",        outputQty: 1, craftSec: 120,  sellPrice: 70   },
  corn_bread:   { id: "corn_bread",   name: "Кукурузный хлеб",    building: "bakery", inputs: [{ itemId: "corn_starch", quantity: 1 }, { itemId: "egg",      quantity: 1 }],              outputId: "corn_bread",   outputQty: 1, craftSec: 240,  sellPrice: 380  },
  pumpkin_pie:  { id: "pumpkin_pie",  name: "Тыквенный пирог",    building: "bakery", inputs: [{ itemId: "pumpkin",     quantity: 1 }, { itemId: "flour",    quantity: 2 }, { itemId: "egg", quantity: 1 }], outputId: "pumpkin_pie",  outputQty: 1, craftSec: 1200, sellPrice: 1100 },
  // ── Молочный цех
  cheese:       { id: "cheese",       name: "Сыр",                building: "dairy",   inputs: [{ itemId: "milk",        quantity: 2 }],                                                    outputId: "cheese",       outputQty: 1, craftSec: 600,  sellPrice: 90   },
  berry_jam:    { id: "berry_jam",    name: "Ягодный джем",       building: "dairy",   inputs: [{ itemId: "blueberry",   quantity: 4 }],                                                    outputId: "berry_jam",    outputQty: 1, craftSec: 300,  sellPrice: 200  },
  mushroom_soup:{ id: "mushroom_soup",name: "Грибной суп",        building: "dairy",   inputs: [{ itemId: "mushroom",    quantity: 2 }, { itemId: "milk",     quantity: 1 }],              outputId: "mushroom_soup",outputQty: 1, craftSec: 600,  sellPrice: 420  },
  ice_cream:    { id: "ice_cream",    name: "Мороженое",          building: "dairy",   inputs: [{ itemId: "milk",        quantity: 2 }, { itemId: "ice_root", quantity: 1 }],              outputId: "ice_cream",    outputQty: 1, craftSec: 900,  sellPrice: 620  },
  honey_yogurt: { id: "honey_yogurt", name: "Медовый йогурт",     building: "dairy",   inputs: [{ itemId: "honey",       quantity: 1 }, { itemId: "milk",     quantity: 1 }],              outputId: "honey_yogurt", outputQty: 1, craftSec: 400,  sellPrice: 360  },
  // ── Кухня
  bacon:        { id: "bacon",        name: "Бекон",              building: "kitchen", inputs: [{ itemId: "meat",        quantity: 1 }],                                                    outputId: "bacon",        outputQty: 1, craftSec: 180,  sellPrice: 220  },
  honey_bread:  { id: "honey_bread",  name: "Медовый хлеб",       building: "kitchen", inputs: [{ itemId: "honey",       quantity: 1 }, { itemId: "flour",    quantity: 1 }],              outputId: "honey_bread",  outputQty: 1, craftSec: 300,  sellPrice: 400  },
  roast:        { id: "roast",        name: "Жаркое",             building: "kitchen", inputs: [{ itemId: "meat",        quantity: 1 }, { itemId: "mushroom", quantity: 1 }],              outputId: "roast",        outputQty: 1, craftSec: 480,  sellPrice: 600  },
  fish_soup:    { id: "fish_soup",    name: "Рыбный суп",         building: "kitchen", inputs: [{ itemId: "carp",        quantity: 1 }, { itemId: "milk",     quantity: 1 }],              outputId: "fish_soup",    outputQty: 1, craftSec: 360,  sellPrice: 280  },
  grilled_fish: { id: "grilled_fish", name: "Жареная рыба",       building: "kitchen", inputs: [{ itemId: "salmon",      quantity: 1 }],                                                    outputId: "grilled_fish", outputQty: 1, craftSec: 300,  sellPrice: 420  },
};

export const PRODUCTS: Record<string, { name: string; emoji: string; sellPrice: number }> = {
  egg:          { name: "Яйцо",               emoji: "🥚",  sellPrice: 15   },
  milk:         { name: "Молоко",             emoji: "🥛",  sellPrice: 25   },
  wool:         { name: "Шерсть",             emoji: "🧶",  sellPrice: 22   },
  meat:         { name: "Мясо",               emoji: "🥩",  sellPrice: 35   },
  honey:        { name: "Мёд",                emoji: "🍯",  sellPrice: 50   },
  flour:        { name: "Мука",               emoji: "🌾",  sellPrice: 20   },
  bread:        { name: "Хлеб",               emoji: "🍞",  sellPrice: 70   },
  cheese:       { name: "Сыр",                emoji: "🧀",  sellPrice: 90   },
  corn_starch:  { name: "Кукурузный крахмал", emoji: "🌽",  sellPrice: 180  },
  berry_juice:  { name: "Ягодный сок",        emoji: "🍹",  sellPrice: 160  },
  corn_bread:   { name: "Кукурузный хлеб",    emoji: "🫓",  sellPrice: 380  },
  pumpkin_pie:  { name: "Тыквенный пирог",    emoji: "🥧",  sellPrice: 1100 },
  berry_jam:    { name: "Ягодный джем",       emoji: "🫙",  sellPrice: 200  },
  mushroom_soup:{ name: "Грибной суп",        emoji: "🍲",  sellPrice: 420  },
  ice_cream:    { name: "Мороженое",          emoji: "🍦",  sellPrice: 620  },
  honey_yogurt: { name: "Медовый йогурт",     emoji: "🫙",  sellPrice: 360  },
  bacon:        { name: "Бекон",              emoji: "🥓",  sellPrice: 220  },
  honey_bread:  { name: "Медовый хлеб",       emoji: "🍯",  sellPrice: 400  },
  roast:        { name: "Жаркое",             emoji: "🍖",  sellPrice: 600  },
};

// ── Эксклюзивные культуры (только из кейсов) ─────────────────────────────────
export const EXCLUSIVE_CROPS: Record<string, CropConfig> = {
  dragon_fruit:  { id: "dragon_fruit",  name: "Драконий плод",      emoji: "🐲", seedCost: 0, sellPrice: 2000, growTimeSec: 7200, description: "Легендарный плод дракона. Только из кейсов.", unlockLevel: 1 },
  starfruit:     { id: "starfruit",     name: "Карамбола",           emoji: "⭐", seedCost: 0, sellPrice: 900,  growTimeSec: 3600, description: "Экзотический звёздный фрукт. Только из кейсов.", unlockLevel: 1 },
  moonberry:     { id: "moonberry",     name: "Лунная ягода",        emoji: "🌙", seedCost: 0, sellPrice: 700,  growTimeSec: 2400, description: "Ягода, созревающая под луной. Только из кейсов.", unlockLevel: 1 },
  lucky_clover:  { id: "lucky_clover",  name: "Клевер удачи",        emoji: "🍀", seedCost: 0, sellPrice: 350,  growTimeSec: 900,  description: "Приносит удачу тому, кто его вырастит.", unlockLevel: 1 },
  rainbow_corn:  { id: "rainbow_corn",  name: "Радужная кукуруза",   emoji: "🌈", seedCost: 0, sellPrice: 290,  growTimeSec: 600,  description: "Яркая кукуруза всех цветов радуги.", unlockLevel: 1 },
};

export type CaseRarity = "rare" | "epic" | "legendary";

export interface GemCaseConfig {
  id: string;
  name: string;
  emoji: string;
  gemCost: number;
  description: string;
  color: string;
  glowColor: string;
  borderColor: string;
  textColor: string;
  weights: { rarity: CaseRarity; chance: number }[];
  minSeeds: number;
  maxSeeds: number;
}

export const CASE_CROP_RARITY: Record<string, CaseRarity> = {
  rainbow_corn: "rare",
  lucky_clover: "rare",
  moonberry:    "epic",
  starfruit:    "epic",
  dragon_fruit: "legendary",
};

export const CASE_RARITY_CROPS: Record<CaseRarity, string[]> = {
  rare:      ["rainbow_corn", "lucky_clover"],
  epic:      ["moonberry", "starfruit"],
  legendary: ["dragon_fruit"],
};

export const GEM_CASES: GemCaseConfig[] = [
  {
    id: "green_case",
    name: "Зелёный кейс",
    emoji: "🌿",
    gemCost: 25,
    description: "Редкие и эпические семена с шансом легенды",
    color: "from-emerald-500 to-green-600",
    glowColor: "rgba(52,211,153,0.5)",
    borderColor: "border-emerald-400",
    textColor: "text-emerald-600",
    weights: [
      { rarity: "rare",      chance: 0.70 },
      { rarity: "epic",      chance: 0.25 },
      { rarity: "legendary", chance: 0.05 },
    ],
    minSeeds: 2,
    maxSeeds: 4,
  },
  {
    id: "blue_case",
    name: "Синий кейс",
    emoji: "💠",
    gemCost: 55,
    description: "Больше шансов на эпик и легендарные семена",
    color: "from-blue-500 to-indigo-600",
    glowColor: "rgba(99,102,241,0.5)",
    borderColor: "border-blue-400",
    textColor: "text-blue-600",
    weights: [
      { rarity: "rare",      chance: 0.20 },
      { rarity: "epic",      chance: 0.60 },
      { rarity: "legendary", chance: 0.20 },
    ],
    minSeeds: 3,
    maxSeeds: 5,
  },
  {
    id: "golden_case",
    name: "Золотой кейс",
    emoji: "👑",
    gemCost: 110,
    description: "Только эпик и легендарные — гарантированно",
    color: "from-amber-400 to-orange-500",
    glowColor: "rgba(251,191,36,0.6)",
    borderColor: "border-amber-400",
    textColor: "text-amber-600",
    weights: [
      { rarity: "rare",      chance: 0.00 },
      { rarity: "epic",      chance: 0.35 },
      { rarity: "legendary", chance: 0.65 },
    ],
    minSeeds: 5,
    maxSeeds: 8,
  },
];

export const CASE_RARITY_LABELS: Record<CaseRarity, string> = {
  rare:      "Редкое",
  epic:      "Эпическое",
  legendary: "Легендарное",
};

export const CASE_RARITY_COLORS: Record<CaseRarity, { text: string; bg: string; border: string; glow: string }> = {
  rare:      { text: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-300",   glow: "rgba(59,130,246,0.4)"  },
  epic:      { text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-300", glow: "rgba(147,51,234,0.4)"  },
  legendary: { text: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-300",  glow: "rgba(245,158,11,0.5)"  },
};

export const FISH_META: Record<string, { name: string; emoji: string; sellPrice: number }> = {
  bass:           { name: "Окунь",           emoji: "🐟", sellPrice: 25  },
  carp:           { name: "Карп",            emoji: "🐠", sellPrice: 40  },
  pike:           { name: "Щука",            emoji: "🐡", sellPrice: 70  },
  salmon:         { name: "Лосось",          emoji: "🐟", sellPrice: 120 },
  legendary_fish: { name: "Легендарная рыба",emoji: "✨", sellPrice: 500 },
};

export const ITEM_NAMES: Record<string, string> = {
  wheat: "Пшеница", carrot: "Морковь", tomato: "Помидор", corn: "Кукуруза",
  strawberry: "Клубника", sunflower: "Подсолнух", pumpkin: "Тыква",
  blueberry: "Голубика", mushroom: "Гриб", cactus_fruit: "Плод кактуса",
  dates: "Финики", cranberry: "Клюква", ice_root: "Ледяной корень",
  egg: "Яйцо", milk: "Молоко", wool: "Шерсть", meat: "Мясо", honey: "Мёд",
  flour: "Мука", bread: "Хлеб", cheese: "Сыр",
  corn_starch: "Кукурузный крахмал", berry_juice: "Ягодный сок",
  corn_bread: "Кукурузный хлеб", pumpkin_pie: "Тыквенный пирог",
  berry_jam: "Ягодный джем", mushroom_soup: "Грибной суп", ice_cream: "Мороженое",
  honey_yogurt: "Медовый йогурт", bacon: "Бекон", honey_bread: "Медовый хлеб", roast: "Жаркое",
  // Эксклюзивные из кейсов
  dragon_fruit: "Драконий плод", starfruit: "Карамбола", moonberry: "Лунная ягода",
  lucky_clover: "Клевер удачи", rainbow_corn: "Радужная кукуруза",
  // Рыба
  bass: "Окунь", carp: "Карп", pike: "Щука", salmon: "Лосось", legendary_fish: "Легендарная рыба",
  // Рыбные блюда
  fish_soup: "Рыбный суп", grilled_fish: "Жареная рыба",
};

export const ITEM_EMOJIS: Record<string, string> = {
  wheat: "🌾", carrot: "🥕", tomato: "🍅", corn: "🌽",
  strawberry: "🍓", sunflower: "🌻", pumpkin: "🎃",
  blueberry: "🫐", mushroom: "🍄", cactus_fruit: "🌵", dates: "🌴",
  cranberry: "🍒", ice_root: "🌿",
  egg: "🥚", milk: "🥛", wool: "🧶", meat: "🥩", honey: "🍯",
  flour: "🌾", bread: "🍞", cheese: "🧀",
  corn_starch: "🌽", berry_juice: "🍹", corn_bread: "🫓",
  pumpkin_pie: "🥧", berry_jam: "🫙", mushroom_soup: "🍲", ice_cream: "🍦",
  honey_yogurt: "🫙", bacon: "🥓", honey_bread: "🍯", roast: "🍖",
  // Эксклюзивные из кейсов
  dragon_fruit: "🐲", starfruit: "⭐", moonberry: "🌙",
  lucky_clover: "🍀", rainbow_corn: "🌈",
  // Рыба
  bass: "🐟", carp: "🐠", pike: "🐡", salmon: "🐟", legendary_fish: "✨",
  // Рыбные блюда
  fish_soup: "🍲", grilled_fish: "🐟",
};

export const SEASON_CONFIG: Record<string, { name: string; emoji: string; color: string; bgColor: string }> = {
  spring: { name: "Весна",  emoji: "🌸", color: "text-pink-600",   bgColor: "bg-pink-100" },
  summer: { name: "Лето",   emoji: "☀️", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  autumn: { name: "Осень",  emoji: "🍂", color: "text-orange-600", bgColor: "bg-orange-100" },
  winter: { name: "Зима",   emoji: "❄️", color: "text-blue-600",   bgColor: "bg-blue-100" },
};

export const LEVEL_XP = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6000, 10000, 15000];

export function getLevelProgress(xp: number, level: number) {
  const currentThreshold = LEVEL_XP[level - 1] ?? 0;
  const nextThreshold = LEVEL_XP[level] ?? (currentThreshold + 5000);
  const progress = Math.min(100, Math.max(0, ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100));
  return { progress, current: xp - currentThreshold, needed: nextThreshold - currentThreshold };
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}м`;
  return `${Math.floor(seconds / 3600)}ч ${Math.floor((seconds % 3600) / 60)}м`;
}

export function formatCountdown(readyAt: string | null): string {
  if (!readyAt) return "";
  const remaining = Math.max(0, Math.floor((new Date(readyAt).getTime() - Date.now()) / 1000));
  return formatTime(remaining);
}

export interface SkinDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bg1: string;
  bg2: string;
  priceCoin?: number;
  priceGem?: number;
  free?: boolean;
}

export interface MedalDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "bronze" | "silver" | "gold" | "legendary";
  hint: string;
}

export const MEDALS: MedalDef[] = [
  { id: "first_harvest",   emoji: "🌱", name: "Первый росток",    rarity: "bronze",    description: "Собрал первый урожай",                      hint: "Собери любой урожай" },
  { id: "streak_7",        emoji: "🔥", name: "Огонь стрика",     rarity: "bronze",    description: "7 дней подряд в игре",                       hint: "Заходи 7 дней подряд" },
  { id: "coins_5000",      emoji: "💰", name: "Богатый фермер",   rarity: "silver",    description: "Накопил 5 000 монет",                        hint: "Накопи 5 000 монет" },
  { id: "fish_10",         emoji: "🎣", name: "Рыбный барон",     rarity: "silver",    description: "Поймал 10 рыб",                              hint: "Налови 10 рыб" },
  { id: "level_5",         emoji: "⭐", name: "Опытный фермер",   rarity: "silver",    description: "Достиг 5 уровня",                            hint: "Прокачайся до уровня 5" },
  { id: "streak_30",       emoji: "🔥🔥","name": "Несгибаемый",  rarity: "gold",      description: "30 дней подряд в игре",                      hint: "Заходи 30 дней подряд" },
  { id: "harvest_200",     emoji: "🏆", name: "Легенда жатвы",    rarity: "gold",      description: "Собрал урожай 200 раз",                      hint: "Собери урожай 200 раз" },
  { id: "level_10",        emoji: "🌟", name: "Мастер фермы",     rarity: "gold",      description: "Достиг 10 уровня",                           hint: "Прокачайся до уровня 10" },
  { id: "playtime_3h",     emoji: "⏱️", name: "Преданный",        rarity: "gold",      description: "Провёл 3 часа в игре",                       hint: "Проведи 3+ часа в игре" },
  { id: "golden_skin",     emoji: "✨", name: "Избранный",         rarity: "legendary", description: "Разблокировал золотой скин",                  hint: "Купи золотой скин фермы" },
  { id: "gems_100",        emoji: "💎", name: "Кристальный лорд", rarity: "legendary", description: "Накопил 100 кристаллов",                      hint: "Накопи 100 кристаллов" },
];

export const MEDAL_RARITY_STYLE: Record<string, { border: string; bg: string; text: string; glow: string; label: string }> = {
  bronze:    { border: "border-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-700 dark:text-amber-400",   glow: "shadow-amber-400/30",   label: "Бронза" },
  silver:    { border: "border-slate-400",  bg: "bg-slate-50 dark:bg-slate-800/40",    text: "text-slate-600 dark:text-slate-300",   glow: "shadow-slate-400/30",   label: "Серебро" },
  gold:      { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30",  text: "text-yellow-600 dark:text-yellow-400", glow: "shadow-yellow-400/40",  label: "Золото" },
  legendary: { border: "border-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30",  text: "text-purple-600 dark:text-purple-400", glow: "shadow-purple-500/50",  label: "Легенда" },
};

export const SKINS: SkinDef[] = [
  { id: "default",  name: "Стандарт",       emoji: "🌿", description: "Классическое поле по сезону", bg1: "", bg2: "", free: true },
  { id: "green",    name: "Зелёная долина",  emoji: "🍀", description: "Сочная зелёная трава круглый год", bg1: "#c8f0a0", bg2: "#84cc16", priceCoin: 800 },
  { id: "desert",   name: "Пустыня",         emoji: "🏜️", description: "Знойные пески и жёлтый закат",    bg1: "#f5e6a0", bg2: "#e8a030", priceCoin: 1200 },
  { id: "snow",     name: "Снежная ферма",   emoji: "❄️", description: "Зима круглый год — морозный воздух", bg1: "#dceeff", bg2: "#7eb8e8", priceCoin: 2000 },
  { id: "tropical", name: "Тропики",         emoji: "🌴", description: "Яркие краски тропического острова", bg1: "#a0f0c8", bg2: "#06b6d4", priceGem: 40 },
  { id: "night",    name: "Ночная ферма",    emoji: "🌙", description: "Звёздное небо над тихим полем",     bg1: "#2d3a5c", bg2: "#1a2040", priceGem: 60 },
  { id: "golden",   name: "Золотая ферма",   emoji: "✨", description: "Легендарный золотой облик",          bg1: "#fff0a0", bg2: "#f59e0b", priceGem: 100 },
];

// ─── Pets ─────────────────────────────────────────────────────────────────────

export type PetBonusType = "harvest_coins" | "harvest_xp" | "grow_speed" | "fish_coins" | "energy_regen" | "gem_daily";

export interface PetDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bonusType: PetBonusType;
  bonusValue: number;
  bonusLabel: string;
  priceCoin?: number;
  priceGem?: number;
  source?: "pass" | "shop";
}

export const PET_DEFS: PetDef[] = [
  {
    id: "cat",
    name: "Кот",
    emoji: "🐱",
    description: "Бдительный хранитель фермы, приносит удачу с деньгами.",
    bonusType: "harvest_coins",
    bonusValue: 0.12,
    bonusLabel: "+12% монет с урожая",
    priceCoin: 1500,
  },
  {
    id: "dog",
    name: "Пёс",
    emoji: "🐶",
    description: "Верный друг, помогает восполнять силы быстрее.",
    bonusType: "energy_regen",
    bonusValue: 0.25,
    bonusLabel: "+25% скорость восстановления энергии",
    priceCoin: 1200,
  },
  {
    id: "bee",
    name: "Пчела",
    emoji: "🐝",
    description: "Трудолюбивая пчела — больше опыта за каждый урожай.",
    bonusType: "harvest_xp",
    bonusValue: 0.20,
    bonusLabel: "+20% опыта с урожая",
    priceCoin: 2000,
  },
  {
    id: "rabbit",
    name: "Кролик",
    emoji: "🐰",
    description: "Шустрый помощник — культуры растут быстрее.",
    bonusType: "grow_speed",
    bonusValue: 0.10,
    bonusLabel: "-10% время роста",
    priceGem: 35,
  },
  {
    id: "fox",
    name: "Лиса",
    emoji: "🦊",
    description: "Ловкая лиса увеличивает выручку от продажи рыбы.",
    bonusType: "fish_coins",
    bonusValue: 0.25,
    bonusLabel: "+25% монет от рыбалки",
    priceGem: 45,
  },
  {
    id: "owl",
    name: "Сова",
    emoji: "🦉",
    description: "Мудрая сова увеличивает опыт от любых действий.",
    bonusType: "harvest_xp",
    bonusValue: 0.15,
    bonusLabel: "+15% опыта со всех действий",
    priceGem: 60,
  },
  {
    id: "unicorn",
    name: "Единорог",
    emoji: "🦄",
    description: "Легендарный питомец — каждый день приносит 5 кристаллов.",
    bonusType: "gem_daily",
    bonusValue: 5,
    bonusLabel: "+5 кристаллов каждый вход",
    source: "pass",
  },
];

// ─── Skill Tree ───────────────────────────────────────────────────────────────

export interface SkillNode {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bonusLabel: string;
  cost: number;
  prereq: string | null;
  branch: "farm" | "trade" | "fishing" | "energy";
  row: number;
}

export const SKILL_NODES: SkillNode[] = [
  // ── Farm branch ──────────────────────────────────────────────
  {
    id: "grow_1",
    name: "Быстрый рост I",
    emoji: "⚡",
    description: "Культуры созревают чуть быстрее.",
    bonusLabel: "-10% время роста",
    cost: 1,
    prereq: null,
    branch: "farm",
    row: 0,
  },
  {
    id: "grow_2",
    name: "Быстрый рост II",
    emoji: "⚡⚡",
    description: "Ещё быстрее! Суммируется с первым уровнем.",
    bonusLabel: "-20% время роста",
    cost: 2,
    prereq: "grow_1",
    branch: "farm",
    row: 1,
  },
  {
    id: "master_harvest",
    name: "Мастер жатвы",
    emoji: "🌾",
    description: "Каждый собранный урожай приносит дополнительные монеты.",
    bonusLabel: "+8 монет за каждый урожай",
    cost: 3,
    prereq: "grow_2",
    branch: "farm",
    row: 2,
  },
  // ── Trade branch ─────────────────────────────────────────────
  {
    id: "discount_1",
    name: "Скидка I",
    emoji: "🏷️",
    description: "Цены в магазине семян немного снижаются.",
    bonusLabel: "-8% цены семян",
    cost: 1,
    prereq: null,
    branch: "trade",
    row: 0,
  },
  {
    id: "discount_2",
    name: "Скидка II",
    emoji: "🏷️🏷️",
    description: "Дополнительная скидка в магазине.",
    bonusLabel: "-12% цены семян",
    cost: 2,
    prereq: "discount_1",
    branch: "trade",
    row: 1,
  },
  {
    id: "rich_harvest",
    name: "Богатый урожай",
    emoji: "💰",
    description: "Продажа урожая приносит на 15% больше монет.",
    bonusLabel: "+15% монет с урожая",
    cost: 2,
    prereq: "discount_2",
    branch: "trade",
    row: 2,
  },
  // ── Energy branch ────────────────────────────────────────────
  {
    id: "energy_1",
    name: "Запас энергии I",
    emoji: "⚡",
    description: "Увеличивает максимальный запас энергии.",
    bonusLabel: "+10 макс. энергии",
    cost: 2,
    prereq: null,
    branch: "energy",
    row: 0,
  },
  {
    id: "energy_2",
    name: "Запас энергии II",
    emoji: "⚡⚡",
    description: "Ещё больше максимальной энергии.",
    bonusLabel: "+10 макс. энергии",
    cost: 3,
    prereq: "energy_1",
    branch: "energy",
    row: 1,
  },
  // ── Fishing branch ───────────────────────────────────────────
  {
    id: "fish_sense",
    name: "Рыбий нюх",
    emoji: "🎣",
    description: "Рыба клюёт чуть чаще — меньше времени ожидания.",
    bonusLabel: "-15% время ожидания поклёвки",
    cost: 1,
    prereq: null,
    branch: "fishing",
    row: 0,
  },
  {
    id: "fish_luck",
    name: "Удача рыбака",
    emoji: "🍀",
    description: "Рыба продаётся по более высокой цене.",
    bonusLabel: "+20% монет от рыбалки",
    cost: 2,
    prereq: "fish_sense",
    branch: "fishing",
    row: 1,
  },
  {
    id: "master_fishing",
    name: "Мастер рыбалки",
    emoji: "🏆",
    description: "Вершина рыболовного мастерства.",
    bonusLabel: "+30% монет от рыбалки",
    cost: 3,
    prereq: "fish_luck",
    branch: "fishing",
    row: 2,
  },
];

export const SKILL_BRANCH_META: Record<SkillNode["branch"], { label: string; emoji: string; color: string; bg: string; border: string; text: string }> = {
  farm:    { label: "Фермер",   emoji: "🌱", color: "green",  bg: "bg-green-50 dark:bg-green-950/30",   border: "border-green-400",  text: "text-green-700 dark:text-green-400" },
  trade:   { label: "Торговец", emoji: "💰", color: "amber",  bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-400",  text: "text-amber-700 dark:text-amber-400" },
  energy:  { label: "Энергия",  emoji: "⚡", color: "yellow", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-400", text: "text-yellow-700 dark:text-yellow-400" },
  fishing: { label: "Рыбак",    emoji: "🎣", color: "blue",   bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-400",   text: "text-blue-700 dark:text-blue-400" },
};
