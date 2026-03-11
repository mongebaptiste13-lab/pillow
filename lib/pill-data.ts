// Liste officielle — ANSM janv. 2026
export type PillCategory = "combinée" | "micro-progestative" | "séquentielle"
export type PillGeneration = "2" | "3" | "4"

export interface PillInfo {
  name: string
  substance: string
  category: PillCategory
  generation: PillGeneration
  daysPerBox: number
  pillType: "21_7" | "28_continu"
  isGeneric?: boolean
}

export const FRENCH_PILLS: PillInfo[] = [
  // 2e gen — Lévonorgestrel
  { name: "Adepal",                              substance: "EE + LNG biphasique",              category: "séquentielle",     generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Minidril",                            substance: "EE 30 µg + LNG 150 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Optidril",                            substance: "EE 30 µg + LNG 150 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Optilova",                            substance: "EE 30 µg + LNG 150 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Daily",                               substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Ludéal",                              substance: "EE 30 µg + LNG 150 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Trinordiol",                          substance: "EE + LNG triphasique",              category: "séquentielle",     generation: "2", daysPerBox: 21, pillType: "21_7" },
  { name: "Seasonique",                          substance: "EE 30 µg + LNG 150 µg (84j)",      category: "combinée",         generation: "2", daysPerBox: 91, pillType: "28_continu" },
  { name: "Asterluna",                           substance: "EE 30 µg + LNG 150 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Asterluna Continu",                   substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Leeloo",                              substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Leeloo Continu",                      substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Qiade",                               substance: "EE 20 µg + LNG 100 µg (84j)",      category: "combinée",         generation: "2", daysPerBox: 91, pillType: "28_continu", isGeneric: true },
  { name: "Lévonorgestrel/EE Biogaran 100/20",   substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Lévonorgestrel/EE Biogaran Continu",  substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Lévonorgestrel/EE Cristers 100/20",   substance: "EE 20 µg + LNG 100 µg",            category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  // Micro-progestative 2e gen
  { name: "Microval",                            substance: "LNG 30 µg",                         category: "micro-progestative", generation: "2", daysPerBox: 35, pillType: "28_continu" },
  // 3e gen — Désogestrel
  { name: "Mercilon",                            substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7" },
  { name: "Varnoline",                           substance: "EE 30 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7" },
  { name: "Varnoline Continu",                   substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Desobel",                             substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Désogestrel/EE Biogaran",             substance: "EE 30 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Désogestrel/EE Biogaran Continu",     substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Désogestrel/EE EG",                   substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Désogestrel/EE Viatris",              substance: "EE 20 µg + Désogestrel 150 µg",    category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  // 3e gen — Gestodène
  { name: "Harmonet",                            substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7" },
  { name: "Minesse",                             substance: "EE 15 µg + Gestodène 60 µg",       category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Minulet",                             substance: "EE 30 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7" },
  { name: "Carlin",                              substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Perléane",                            substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE BGR 60/15",              substance: "EE 15 µg + Gestodène 60 µg",       category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Gestodène/EE Biogaran 75/20",         substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE Biogaran 75/30",         substance: "EE 30 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE EG Labo",                substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE Teva 75/20",             substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE Teva 75/30",             substance: "EE 30 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE Viatris 60",             substance: "EE 15 µg + Gestodène 60 µg",       category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Gestodène/EE Viatris 75/20",          substance: "EE 20 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Gestodène/EE Viatris 75/30",          substance: "EE 30 µg + Gestodène 75 µg",       category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  // 3e gen — Norgestimate
  { name: "Triafemi",                            substance: "EE + Norgestimate triphasique",     category: "séquentielle",     generation: "3", daysPerBox: 21, pillType: "21_7" },
  { name: "Femi",                                substance: "EE 35 µg + Norgestimate 250 µg",   category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Naravela",                            substance: "EE 25 µg + Norgestimate 250 µg",   category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Optikinzy",                           substance: "EE 25 µg + Norgestimate 250 µg",   category: "combinée",         generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Trinara",                             substance: "EE + Norgestimate triphasique",     category: "séquentielle",     generation: "3", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Trinara Continu",                     substance: "EE 25 µg + Norgestimate 250 µg",   category: "combinée",         generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  // Micro-progestatives 3e gen — Désogestrel
  { name: "Cerazette",                           substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Optimizette",                         substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Antigone",                            substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Elfasette",                           substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu" },
  { name: "Désogestrel Biogaran",                substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Désogestrel Cristers",                substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Désogestrel Sandoz",                  substance: "Désogestrel 75 µg",                 category: "micro-progestative", generation: "3", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  // 4e gen — Chlormadinone
  { name: "Belara",                              substance: "EE 30 µg + Chlormadinone 2 mg",    category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7" },
  { name: "Belara Continu",                      substance: "EE 30 µg + Chlormadinone 2 mg",    category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  // 4e gen — Diénogest
  { name: "Qlaira",                              substance: "Estradiol valérate + Diénogest",    category: "séquentielle",     generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Misolfa",                             substance: "EE 30 µg + Diénogest 2 mg",        category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7" },
  { name: "Oedien",                              substance: "EE 30 µg + Diénogest 2 mg",        category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7" },
  // 4e gen — Drospirénone
  { name: "Jasmine",                             substance: "EE 30 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7" },
  { name: "Jasminelle",                          substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7" },
  { name: "Jasminelle Continu",                  substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Yaz",                                 substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Drovelis",                            substance: "Estradiol 1,5 mg + Drospirénone",  category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Phizoe",                              substance: "Estradiol 1,5 mg + Drospirénone",  category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Drospibel",                           substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Espizene Continu",                    substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Drospirénone/EE Cristers Continu",    substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Drospirénone/EE Viatris",             substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "Drospirénone/EE Viatris Continu",     substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "EE/Drospirénone BGR",                 substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  { name: "EE/Drospirénone BGR Continu",         substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "EE/Drospirénone Cristers",            substance: "EE 20 µg + Drospirénone 3 mg",     category: "combinée",         generation: "4", daysPerBox: 21, pillType: "21_7",      isGeneric: true },
  // Micro-progestative 4e gen — Drospirénone
  { name: "Slinda",                              substance: "Drospirénone 4 mg",                 category: "micro-progestative", generation: "4", daysPerBox: 28, pillType: "28_continu" },
  // 4e gen — Nomégestrol
  { name: "Zoely",                               substance: "Estradiol 1,5 mg + Nomégestrol",   category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu" },
  { name: "Nomégestrol/Estradiol Viatris",       substance: "Estradiol 1,5 mg + Nomégestrol",   category: "combinée",         generation: "4", daysPerBox: 28, pillType: "28_continu", isGeneric: true },
  { name: "Autre / Non listée",                  substance: "",                                  category: "combinée",         generation: "2", daysPerBox: 21, pillType: "21_7" },
]

export const PILL_NAMES = FRENCH_PILLS.map((p) => p.name)

export function findPill(name?: string | null): PillInfo | undefined {
  if (!name) return undefined
  return FRENCH_PILLS.find((p) => p.name.toLowerCase() === name.toLowerCase())
}
