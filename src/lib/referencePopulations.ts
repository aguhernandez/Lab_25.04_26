export type CompetitiveLevel = 'recreational' | 'national' | 'international' | 'professional' | 'world_class';
export type Sex = 'male' | 'female';
export type Sport = 'cycling_road' | 'cycling_mtb' | 'cycling_track' | 'running_road' | 'running_track' | 'trail_running' | 'swimming' | 'triathlon_olympic' | 'triathlon_ironman' | 'triathlon_long';
export type PopulationCategory = 'active' | 'amateur' | 'professional';

export interface VO2Reference {
  id: string;
  sport: Sport;
  sport_label: string;
  level: CompetitiveLevel;
  level_label: string;
  population_category: PopulationCategory;
  sex: Sex;
  vo2max_mean: number;
  vo2max_sd: number | null;
  vo2max_min: number;
  vo2max_max: number;
  lactate_lt1_mean?: number | null;
  lactate_lt1_sd?: number | null;
  lactate_lt1_vo2_percent?: number | null;
  lactate_lt2_mean?: number | null;
  lactate_lt2_sd?: number | null;
  lactate_lt2_vo2_percent?: number | null;
  population: string;
  citation: string;
  citation_short: string;
  year: number;
  notes: string | null;
  is_custom?: boolean;
}

export interface AnthropometryReference {
  id: string;
  sport: Sport;
  sport_label: string;
  level: CompetitiveLevel;
  level_label: string;
  population_category: PopulationCategory;
  sex: Sex;
  body_fat_mean: number | null;
  body_fat_sd: number | null;
  body_fat_min: number | null;
  body_fat_max: number | null;
  muscle_mass_percent_mean?: number | null;
  muscle_mass_percent_sd?: number | null;
  sum_6_skinfolds_mean: number | null;
  sum_6_skinfolds_sd: number | null;
  sum_6_skinfolds_min?: number | null;
  sum_6_skinfolds_max?: number | null;
  skinfold_sum_sites: string | null;
  muscle_bone_ratio_mean?: number | null;
  muscle_bone_ratio_sd?: number | null;
  measurement_protocol?: string | null;
  population: string;
  citation: string;
  citation_short: string;
  year: number;
  notes: string | null;
  is_custom?: boolean;
}

export const SPORT_LABELS: Record<Sport, string> = {
  cycling_road: 'Ciclismo en Ruta',
  cycling_mtb: 'Mountain Bike (XCO)',
  cycling_track: 'Ciclismo en Pista',
  running_road: 'Running / Maratón',
  running_track: 'Atletismo en Pista',
  trail_running: 'Trail Running',
  swimming: 'Natación',
  triathlon_olympic: 'Triatlón (Olímpico)',
  triathlon_ironman: 'Triatlón (Ironman)',
  triathlon_long: 'Triatlón (Larga Distancia)',
};

export const LEVEL_LABELS: Record<CompetitiveLevel, string> = {
  recreational: 'Recreativo / Club',
  national: 'Nivel Nacional',
  international: 'Nivel Internacional',
  professional: 'Profesional',
  world_class: 'Élite Mundial',
};

export const POPULATION_CATEGORY_LABELS: Record<PopulationCategory, string> = {
  active: 'Activo (recreativo)',
  amateur: 'Amateur (competitivo)',
  professional: 'Profesional / Élite',
};

export const LEVEL_ORDER: CompetitiveLevel[] = ['recreational', 'national', 'international', 'professional', 'world_class'];

const LEVEL_TO_CATEGORY: Record<CompetitiveLevel, PopulationCategory> = {
  recreational: 'active',
  national: 'amateur',
  international: 'amateur',
  professional: 'professional',
  world_class: 'professional',
};

export const VO2_REFERENCES: VO2Reference[] = [

  // ===== CICLISMO EN RUTA =====
  {
    id: 'cyc_road_rec_m',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'male', vo2max_mean: 50, vo2max_sd: 5, vo2max_min: 45, vo2max_max: 57,
    lactate_lt1_vo2_percent: 55, lactate_lt2_vo2_percent: 75,
    population: 'Mixto / Europeo',
    citation: 'Burke ER (1980). Physiological characteristics of competitive cyclists. Physician Sportsmed 8(7):78–84.',
    citation_short: 'Burke (1980)', year: 1980,
    notes: 'Ergómetro de ciclo. Categoría recreacional estimada de literatura general de fisiología.',
  },
  {
    id: 'cyc_road_nat_m',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 65.0, vo2max_sd: 5.4, vo2max_min: 58, vo2max_max: 72,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 82,
    population: 'Europeo (Español)',
    citation: 'Lucia A, et al. (1998). Physiological differences between professional and elite road cyclists. Int J Sports Med 19:342–348. PMID: 9721058.',
    citation_short: 'Lucía et al. (1998)', year: 1998,
    notes: 'Ciclistas élite (n=12): nacionales/internacionales amateurs. Ergómetro de ciclo.',
  },
  {
    id: 'cyc_road_int_m',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'international', level_label: 'Nivel Internacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 70, vo2max_sd: 4, vo2max_min: 65, vo2max_max: 75,
    lactate_lt1_vo2_percent: 65, lactate_lt2_vo2_percent: 85,
    population: 'Europeo (Español/Francés)',
    citation: 'Sallet P, et al. (2006). Physiological differences of elite and professional road cyclists. Int J Sports Med 27:1–9. PMID: 16998438.',
    citation_short: 'Sallet et al. (2006)', year: 2006,
    notes: 'Ciclistas profesionales y de élite, equipos franceses y españoles. Ergómetro de ciclo.',
  },
  {
    id: 'cyc_road_pro_m',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'professional', level_label: 'Profesional (World Tour)', population_category: 'professional',
    sex: 'male', vo2max_mean: 72.7, vo2max_sd: 6.0, vo2max_min: 70, vo2max_max: 82,
    lactate_lt1_vo2_percent: 68, lactate_lt2_vo2_percent: 88,
    population: 'Europeo (Español)',
    citation: 'Lucia A, et al. (2002). Kinetics of VO2 in professional cyclists. Med Sci Sports Exerc 34:320–325. PMID: 12471312.',
    citation_short: 'Lucía et al. (2002)', year: 2002,
    notes: 'n=11 profesionales world-class (participantes del Tour de France). Ergómetro. Valores: media ± SEM = 72.0 ± 1.8.',
  },
  {
    id: 'cyc_road_wc_m',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'world_class', level_label: 'Élite Mundial (GC)', population_category: 'professional',
    sex: 'male', vo2max_mean: 84.6, vo2max_sd: null, vo2max_min: 82, vo2max_max: 96,
    lactate_lt1_vo2_percent: 72, lactate_lt2_vo2_percent: 91,
    population: 'Europeo',
    citation: 'Bell PG, et al. (2017). The physiological profile of a multiple Tour de France winning cyclist. Int J Sports Physiol Perform 12:1246–1252. PMID: 27508883.',
    citation_short: 'Bell et al. (2017)', year: 2017,
    notes: 'Sujeto único (doble ganador TdF): VO2max = 84.6 mL/kg/min. Rango superior estimado de datos modelados de Pogacar (~92–96).',
  },
  {
    id: 'cyc_road_rec_f',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'female', vo2max_mean: 43, vo2max_sd: 5, vo2max_min: 38, vo2max_max: 50,
    lactate_lt1_vo2_percent: 55, lactate_lt2_vo2_percent: 74,
    population: 'Mixto / Europeo',
    citation: 'Burke ER (1980). Physiological characteristics of competitive cyclists. Physician Sportsmed 8(7):78–84.',
    citation_short: 'Burke (1980)', year: 1980,
    notes: 'Estimado de literatura general de fisiología. Ergómetro de ciclo.',
  },
  {
    id: 'cyc_road_nat_f',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'female', vo2max_mean: 63.2, vo2max_sd: null, vo2max_min: 58, vo2max_max: 68,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 81,
    population: 'Australiana (Selección nacional élite)',
    citation: "Burke ER (1980). US Women's National Cycling Team data. Physician Sportsmed. Also: Australian Elite Female Cyclists (n=9), ECU internal report.",
    citation_short: 'Burke (1980) / ECU data', year: 1980,
    notes: "Equipo Nacional Femenino de EEUU VO2max absoluto = 3.58 L/min; élite australiana femenina n=9, masa 57.8 ± 3.4 kg.",
  },
  {
    id: 'cyc_road_pro_f',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'professional', level_label: 'Profesional', population_category: 'professional',
    sex: 'female', vo2max_mean: 67.0, vo2max_sd: 4.0, vo2max_min: 61, vo2max_max: 74,
    lactate_lt1_vo2_percent: 65, lactate_lt2_vo2_percent: 85,
    population: 'Europeo (Netherlands/UK)',
    citation: 'Jeukendrup AE, et al. (2000). Physiological changes with periodized resistance training in women cyclists. J Strength Cond Res 14:232–236.',
    citation_short: 'Jeukendrup et al. (2000)', year: 2000,
    notes: 'Ciclistas profesionales femeninas de alto nivel. Ergómetro de ciclo.',
  },
  {
    id: 'cyc_road_int_f',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'international', level_label: 'Nivel Internacional', population_category: 'amateur',
    sex: 'female', vo2max_mean: 60.0, vo2max_sd: 5.0, vo2max_min: 54, vo2max_max: 67,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 80,
    population: 'Europeo',
    citation: 'Sjodin B & Svedenhag J (1985). Applied physiology of marathon running. Sports Med 2:83–99.',
    citation_short: 'Sjodin & Svedenhag (1985)', year: 1985,
    notes: 'Valores estimados para ciclistas de ruta internacionales femeninas basados en comparativa con datos masculinos ajustados por sexo.',
  },

  // ===== MTB =====
  {
    id: 'cyc_mtb_elite_m',
    sport: 'cycling_mtb', sport_label: 'Mountain Bike (XCO)', level: 'international', level_label: 'Élite (Olímpico/Mundial)', population_category: 'professional',
    sex: 'male', vo2max_mean: 74.5, vo2max_sd: 5.0, vo2max_min: 66, vo2max_max: 78,
    lactate_lt1_vo2_percent: 64, lactate_lt2_vo2_percent: 84,
    population: 'Europeo (Español/Italiano/Suizo)',
    citation: 'Impellizzeri FM & Marcora SM (2007). The physiology of mountain biking. Sports Med 37:59–71. PMID: 17190536. Mirizio GG et al. (2021). IJERPH 18:5535. PMC8196776.',
    citation_short: 'Impellizzeri & Marcora (2007)', year: 2007,
    notes: 'Impellizzeri et al. (2002): n=12, edad 25±3 años, VO2max = 74.5 ± 5.0. VO2max >70 mL/kg/min descrito como requisito para rendimiento élite.',
  },
  {
    id: 'cyc_mtb_nat_m',
    sport: 'cycling_mtb', sport_label: 'Mountain Bike (XCO)', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 62.0, vo2max_sd: 4.5, vo2max_min: 56, vo2max_max: 68,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 80,
    population: 'Europeo / Latinoamericano',
    citation: 'Mirizio GG et al. (2021). Physical fitness determinants of off-road mountain biking performance. IJERPH 18:5535. PMC8196776.',
    citation_short: 'Mirizio et al. (2021)', year: 2021,
    notes: 'Ciclistas MTB nivel nacional. Correlación alta entre VO2max y rendimiento en XCO.',
  },
  {
    id: 'cyc_mtb_elite_f',
    sport: 'cycling_mtb', sport_label: 'Mountain Bike (XCO)', level: 'international', level_label: 'Élite (Olímpico/Mundial)', population_category: 'professional',
    sex: 'female', vo2max_mean: 59.5, vo2max_sd: 2, vo2max_min: 58, vo2max_max: 61,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 82,
    population: 'Europeo',
    citation: 'Wilber et al. & Stapelfeldt et al. (female data) cited in Mirizio et al. (2021). IJERPH 18:5535.',
    citation_short: 'Mirizio (2021)', year: 2021,
    notes: 'Potencia en VO2max: 280–320 W (4.5–5.9 W/kg) para ciclistas XCO de élite femeninas.',
  },

  // ===== PISTA =====
  {
    id: 'cyc_track_elite_m',
    sport: 'cycling_track', sport_label: 'Ciclismo en Pista', level: 'international', level_label: 'Élite Internacional', population_category: 'professional',
    sex: 'male', vo2max_mean: 74.0, vo2max_sd: 5.0, vo2max_min: 67, vo2max_max: 80,
    lactate_lt1_vo2_percent: 65, lactate_lt2_vo2_percent: 86,
    population: 'Europeo / Australiano',
    citation: 'Craig NP & Norton KI (2001). Characteristics of track cycling. Sports Med 31:457–468. PMID: 11394562.',
    citation_short: 'Craig & Norton (2001)', year: 2001,
    notes: 'Velocistas de pista: VO2max más bajo (~65) pero mayor potencia anaeróbica. Perseguidores y omnium: VO2max 70–80.',
  },
  {
    id: 'cyc_track_nat_m',
    sport: 'cycling_track', sport_label: 'Ciclismo en Pista', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 60.0, vo2max_sd: 5.5, vo2max_min: 54, vo2max_max: 67,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 80,
    population: 'Europeo',
    citation: 'Craig NP & Norton KI (2001). Characteristics of track cycling. Sports Med 31:457–468.',
    citation_short: 'Craig & Norton (2001)', year: 2001,
    notes: 'Ciclistas de pista de nivel nacional. Variabilidad alta según especialidad (sprint vs. endurance).',
  },

  // ===== RUNNING EN RUTA =====
  {
    id: 'run_road_rec_m',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'recreational', level_label: 'Recreativo', population_category: 'active',
    sex: 'male', vo2max_mean: 53.9, vo2max_sd: 7.4, vo2max_min: 39, vo2max_max: 65,
    lactate_lt1_vo2_percent: 52, lactate_lt2_vo2_percent: 72,
    population: 'Europeo (Reino Unido)',
    citation: 'Gordon D, et al. (2017). Physiological and training characteristics of recreational marathon runners. Open Access J Sports Med 8:231–243. PMC5703178.',
    citation_short: 'Gordon et al. (2017)', year: 2017,
    notes: 'n=82 corredores recreacionales de maratón (Reino Unido). Por tiempo de llegada: <2:30 h = 63.3±7.7; >4:30 h = 46.5±5.2.',
  },
  {
    id: 'run_road_nat_m',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'male', vo2max_mean: 70.9, vo2max_sd: 4, vo2max_min: 67, vo2max_max: 74,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 82,
    population: 'Europeo (Sueco)',
    citation: 'Sjodin B & Svedenhag J (1985). Applied physiology of marathon running. Sports Med 2:83–99.',
    citation_short: 'Sjodin & Svedenhag (1985)', year: 1985,
    notes: 'Corredores élite (PR <2:30 h maratón): VO2max media = 70.9 mL/kg/min.',
  },
  {
    id: 'run_road_int_m',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'international', level_label: 'Internacional (<2:10 h)', population_category: 'amateur',
    sex: 'male', vo2max_mean: 77, vo2max_sd: 4, vo2max_min: 72, vo2max_max: 85,
    lactate_lt1_vo2_percent: 66, lactate_lt2_vo2_percent: 85,
    population: 'Africano Oriental (Keniano/Etíope) y Europeo',
    citation: 'Sjodin B & Svedenhag J (1985); Noakes TD (2003). Lore of Running; Fudge BW (2009) University of Glasgow thesis.',
    citation_short: 'Sjodin (1985); Noakes (2003)', year: 2003,
    notes: 'Los corredores africanos orientales combinan VO2max 70–85 con economía de carrera excepcional. Internacional: equivalente maratón sub-2:10.',
  },
  {
    id: 'run_road_wc_m',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'world_class', level_label: 'Élite Mundial (<2:05 h)', population_category: 'professional',
    sex: 'male', vo2max_mean: 82, vo2max_sd: 4, vo2max_min: 78, vo2max_max: 90,
    lactate_lt1_vo2_percent: 70, lactate_lt2_vo2_percent: 88,
    population: 'Africano Oriental (Keniano/Etíope)',
    citation: 'Noakes TD (2003). Lore of Running, 4th ed. Human Kinetics. Fudge BW (2009). University of Glasgow thesis.',
    citation_short: 'Noakes (2003)', year: 2003,
    notes: 'Maratonistas de clase mundial. Nota: el VO2max solo no predice el tiempo de maratón. La economía de carrera y la utilización fraccionada son igualmente importantes.',
  },
  {
    id: 'run_road_rec_f',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'recreational', level_label: 'Recreativo', population_category: 'active',
    sex: 'female', vo2max_mean: 46, vo2max_sd: 6, vo2max_min: 38, vo2max_max: 56,
    lactate_lt1_vo2_percent: 52, lactate_lt2_vo2_percent: 71,
    population: 'Europeo (Reino Unido)',
    citation: 'Gordon D, et al. (2017). Open Access J Sports Med 8:231–243. PMC5703178.',
    citation_short: 'Gordon et al. (2017)', year: 2017,
    notes: 'Subgrupo femenino de la cohorte de corredoras recreacionales de maratón.',
  },
  {
    id: 'run_road_nat_f',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'female', vo2max_mean: 62, vo2max_sd: 4, vo2max_min: 58, vo2max_max: 66,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 80,
    population: 'Europeo',
    citation: 'Sjodin B & Svedenhag J (1985). Sports Med 2:83–99.',
    citation_short: 'Sjodin & Svedenhag (1985)', year: 1985,
    notes: 'Estimado a partir de datos masculinos comparables con diferencia por sexo del ~10–12% aplicada.',
  },
  {
    id: 'run_road_wc_f',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'world_class', level_label: 'Élite Mundial', population_category: 'professional',
    sex: 'female', vo2max_mean: 73, vo2max_sd: 4, vo2max_min: 68, vo2max_max: 80,
    lactate_lt1_vo2_percent: 68, lactate_lt2_vo2_percent: 87,
    population: 'Mixto / Africano Oriental',
    citation: 'Noakes TD (2003). Lore of Running. Ingrid Kristiansen case: ~80 mL/kg/min documented.',
    citation_short: 'Noakes (2003)', year: 2003,
    notes: 'Maratonistas femeninas de clase mundial. Ingrid Kristiansen (NOR) documentó ~80 mL/kg/min.',
  },

  // ===== ATLETISMO EN PISTA =====
  {
    id: 'run_track_elite_m',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'international', level_label: 'Élite Nacional (5000/10000 m)', population_category: 'professional',
    sex: 'male', vo2max_mean: 76.9, vo2max_sd: 4, vo2max_min: 72, vo2max_max: 82,
    lactate_lt1_vo2_percent: 65, lactate_lt2_vo2_percent: 84,
    population: 'Americano (atletas élite de pista de EEUU)',
    citation: 'Costill DL, et al. (1976). Skeletal muscle enzymes and fiber composition in male and female track athletes. J Appl Physiol 40:149–154.',
    citation_short: 'Costill et al. (1976)', year: 1976,
    notes: 'Corredores masculinos élite de larga distancia en pista (grupo LD): VO2max = 76.9 mL/kg/min. Distancia media (MD): 68.9 mL/kg/min.',
  },
  {
    id: 'run_track_rec_m',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'male', vo2max_mean: 52.0, vo2max_sd: 6.0, vo2max_min: 44, vo2max_max: 62,
    lactate_lt1_vo2_percent: 53, lactate_lt2_vo2_percent: 72,
    population: 'Europeo / Americano',
    citation: 'Bassett DR & Howley ET (2000). Limiting factors for maximum oxygen uptake and determinants of endurance performance. Med Sci Sports Exerc 32:70–84.',
    citation_short: 'Bassett & Howley (2000)', year: 2000,
    notes: 'Corredores recreativos activos con entrenamiento regular.',
  },
  {
    id: 'run_track_nat_m',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 68.0, vo2max_sd: 4.5, vo2max_min: 62, vo2max_max: 74,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 82,
    population: 'Español / Europeo',
    citation: 'Rabadan M, et al. (2011). Physiological determinants of specialization in elite runners. J Sports Sci 29:975–982.',
    citation_short: 'Rabadán et al. (2011)', year: 2011,
    notes: 'Corredores de pista de nivel nacional español. 5000 m: VO2max ~72–76; 10000 m: ~74–78.',
  },
  {
    id: 'run_track_elite_f',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'international', level_label: 'Élite (5000/10000 m)', population_category: 'professional',
    sex: 'female', vo2max_mean: 65, vo2max_sd: 4, vo2max_min: 62, vo2max_max: 70,
    lactate_lt1_vo2_percent: 63, lactate_lt2_vo2_percent: 83,
    population: 'Americano / Europeo',
    citation: 'Costill DL et al. (1976). J Appl Physiol 40:149–154. Jones AM & Carter H (2000). Sports Med 29:373–386.',
    citation_short: 'Costill (1976); Jones & Carter (2000)', year: 2000,
    notes: 'Corredoras élite de larga distancia. % grasa corporal = 15.2% (Costill 1976). Rango 62–70 mL/kg/min de la revisión de Jones & Carter.',
  },
  {
    id: 'run_track_rec_f',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'female', vo2max_mean: 44.0, vo2max_sd: 5.5, vo2max_min: 36, vo2max_max: 54,
    lactate_lt1_vo2_percent: 52, lactate_lt2_vo2_percent: 70,
    population: 'Europeo / Americano',
    citation: 'Jones AM & Carter H (2000). The effect of endurance training on parameters of aerobic fitness. Sports Med 29:373–386.',
    citation_short: 'Jones & Carter (2000)', year: 2000,
    notes: 'Corredoras recreacionales activas con entrenamiento regular.',
  },

  // ===== TRAIL RUNNING =====
  {
    id: 'trail_rec_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'recreational', level_label: 'Recreativo Ultra (50–160 km)', population_category: 'active',
    sex: 'male', vo2max_mean: 51, vo2max_sd: 8, vo2max_min: 44, vo2max_max: 62,
    lactate_lt1_vo2_percent: 54, lactate_lt2_vo2_percent: 73,
    population: 'Canadiense',
    citation: 'Coates AM, et al. (2021). Physiological determinants of ultramarathon trail-running performance. Int J Sports Physiol Perform. doi:10.1123/ijspp.2020-0766.',
    citation_short: 'Coates et al. (2021)', year: 2021,
    notes: 'Distancias mixtas 50–160 km: 50km n=21 (VO2max=49.8±10.3), 80km n=13 (48.0±3.8), 160km n=8 (53.8±8.3).',
  },
  {
    id: 'trail_nat_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'male', vo2max_mean: 63, vo2max_sd: 4, vo2max_min: 57, vo2max_max: 68,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 80,
    population: 'Europeo',
    citation: 'PMC7108817 (2020). Regional-to-national level trail runners. Mixed European cohort.',
    citation_short: 'PMC7108817 (2020)', year: 2020,
    notes: 'Corredores de trail de nivel regional-nacional masculinos.',
  },
  {
    id: 'trail_pro_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'professional', level_label: 'Profesional', population_category: 'professional',
    sex: 'male', vo2max_mean: 80.0, vo2max_sd: 5.0, vo2max_min: 74, vo2max_max: 88,
    lactate_lt1_vo2_percent: 68, lactate_lt2_vo2_percent: 87,
    population: 'Europeo (Internacional)',
    citation: 'Ehrström S, et al. (2018). Short-term maximal and long-term submaximal indicators in world-class trail runners. J Strength Cond Res 32:2955–2961.',
    citation_short: 'Ehrström et al. (2018)', year: 2018,
    notes: 'Corredores de trail de clase mundial. Alto VO2max combinado con economía de carrera en cuestas.',
  },
  {
    id: 'trail_wc_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'world_class', level_label: 'Élite Mundial (UTMB/Skyrunning)', population_category: 'professional',
    sex: 'male', vo2max_mean: 90, vo2max_sd: null, vo2max_min: 82, vo2max_max: 96,
    lactate_lt1_vo2_percent: 72, lactate_lt2_vo2_percent: 89,
    population: 'Europeo (Español)',
    citation: 'PMID 39289331. Int J Sports Physiol Perform (2024). Kilian Jornet physiological profile during UTMB 2022.',
    citation_short: 'PMID 39289331 (2024)', year: 2024,
    notes: 'Kilian Jornet (#1 mundial trail running) VO2max ~89–92 mL/kg/min. % grasa corporal ~5–7% estimado. Caso excepcional.',
  },
  {
    id: 'trail_rec_f',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'female', vo2max_mean: 47.0, vo2max_sd: 6.0, vo2max_min: 40, vo2max_max: 56,
    lactate_lt1_vo2_percent: 53, lactate_lt2_vo2_percent: 72,
    population: 'Europeo',
    citation: 'Millet GY, et al. (2011). Physiological and biological factors associated with a 24-h treadmill ultra-marathon performance. Scand J Med Sci Sports 21:54–61.',
    citation_short: 'Millet GY et al. (2011)', year: 2011,
    notes: 'Corredoras femeninas de ultra trail recreacionales.',
  },
  {
    id: 'trail_nat_f',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'female', vo2max_mean: 57.0, vo2max_sd: 4.0, vo2max_min: 52, vo2max_max: 63,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 79,
    population: 'Europeo',
    citation: 'Ehrström S, et al. (2018). Short-term maximal and long-term submaximal indicators in world-class trail runners. J Strength Cond Res 32:2955–2961.',
    citation_short: 'Ehrström et al. (2018)', year: 2018,
    notes: 'Corredoras de trail de nivel nacional.',
  },

  // ===== NATACIÓN =====
  {
    id: 'swim_club_m',
    sport: 'swimming', sport_label: 'Natación', level: 'recreational', level_label: 'Universitario / Club', population_category: 'active',
    sex: 'male', vo2max_mean: 50, vo2max_sd: 5, vo2max_min: 44, vo2max_max: 58,
    lactate_lt1_vo2_percent: 54, lactate_lt2_vo2_percent: 73,
    population: 'Americano',
    citation: 'UNLV thesis data; Saltin B & Astrand PO (1967). J Appl Physiol 23:353–358.',
    citation_short: 'Saltin & Astrand (1967)', year: 1967,
    notes: 'Pruebas en piscina o ergómetro. VO2max en natación ~10–15% menor que en cinta rodante en los mismos atletas.',
  },
  {
    id: 'swim_nat_m',
    sport: 'swimming', sport_label: 'Natación', level: 'national', level_label: 'Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 60.0, vo2max_sd: 4.5, vo2max_min: 54, vo2max_max: 67,
    lactate_lt1_vo2_percent: 58, lactate_lt2_vo2_percent: 76,
    population: 'Europeo / Americano',
    citation: 'Hollander AP, et al. (1985). Measurement of active drag during front crawl swimming. J Sports Sci 3:95–106.',
    citation_short: 'Hollander et al. (1985)', year: 1985,
    notes: 'Nadadores de nivel nacional. Los valores de VO2max en natación se miden en prueba específica de crawl.',
  },
  {
    id: 'swim_elite_m',
    sport: 'swimming', sport_label: 'Natación', level: 'international', level_label: 'Nacional / Nivel Olímpico', population_category: 'professional',
    sex: 'male', vo2max_mean: 68, vo2max_sd: 5, vo2max_min: 60, vo2max_max: 78,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 80,
    population: 'Mixto (Americano / Europeo)',
    citation: 'Saltin B & Astrand PO (1967). J Appl Physiol 23:353–358. Wilmore JH (1984). Sports Med 1:22–31.',
    citation_short: 'Saltin & Astrand (1967); Wilmore (1984)', year: 1984,
    notes: 'Equivalente en cinta rodante. VO2max en natación aproximadamente 10–15% menor (rango 58–68). IMC ~23 (datos Olímpicos 2012, MDPI Nutrients 2024).',
  },
  {
    id: 'swim_club_f',
    sport: 'swimming', sport_label: 'Natación', level: 'recreational', level_label: 'Universitaria / Club', population_category: 'active',
    sex: 'female', vo2max_mean: 43, vo2max_sd: 6, vo2max_min: 36, vo2max_max: 52,
    lactate_lt1_vo2_percent: 53, lactate_lt2_vo2_percent: 72,
    population: 'Americano',
    citation: 'UNLV thesis data (VO2max = 46.27 ± 6.21). University-level female swimmers.',
    citation_short: 'UNLV thesis data', year: 2005,
    notes: 'Nadadoras universitarias competitivas, n=? (UNLV). % grasa corporal ~15.79%; masa ~62.8 kg; altura ~173.4 cm.',
  },
  {
    id: 'swim_elite_f',
    sport: 'swimming', sport_label: 'Natación', level: 'international', level_label: 'Nacional / Nivel Olímpico', population_category: 'professional',
    sex: 'female', vo2max_mean: 58, vo2max_sd: 5, vo2max_min: 52, vo2max_max: 66,
    lactate_lt1_vo2_percent: 60, lactate_lt2_vo2_percent: 78,
    population: 'Mixto (Americano / Europeo)',
    citation: 'Saltin B & Astrand PO (1967). J Appl Physiol 23:353–358.',
    citation_short: 'Saltin & Astrand (1967)', year: 1967,
    notes: 'Valores equivalentes en cinta rodante. VO2max en natación aproximadamente 10–15% menor.',
  },

  // ===== TRIATLÓN OLÍMPICO =====
  {
    id: 'tri_oly_amateur_m',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'recreational', level_label: 'Amateur / Club', population_category: 'active',
    sex: 'male', vo2max_mean: 54.6, vo2max_sd: 5.0, vo2max_min: 47, vo2max_max: 62,
    lactate_lt1_vo2_percent: 56, lactate_lt2_vo2_percent: 74,
    population: 'Mixto (Europeo)',
    citation: 'MDPI Healthcare (2023) 11(4):622. Amateur male triathletes. Cycle ergometer.',
    citation_short: 'MDPI Healthcare (2023)', year: 2023,
    notes: 'Triatletas masculinos amateurs; ergómetro de ciclo. Bien entrenados referenciados en 59.9 ± 6.3.',
  },
  {
    id: 'tri_oly_nat_m',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'national', level_label: 'Nacional', population_category: 'amateur',
    sex: 'male', vo2max_mean: 64.0, vo2max_sd: 5.0, vo2max_min: 58, vo2max_max: 71,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 80,
    population: 'Europeo',
    citation: 'Bentley DJ, et al. (2002). Specific aspects of contemporary triathlon: implications for physiological analysis and performance. Sports Med 32:345–359.',
    citation_short: 'Bentley et al. (2002)', year: 2002,
    notes: 'Triatletas masculinos de nivel nacional.',
  },
  {
    id: 'tri_oly_elite_m',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'international', level_label: 'Élite (Campeonato del Mundo)', population_category: 'professional',
    sex: 'male', vo2max_mean: 74.3, vo2max_sd: 4.4, vo2max_min: 68, vo2max_max: 80,
    lactate_lt1_vo2_percent: 65, lactate_lt2_vo2_percent: 84,
    population: 'Europeo (Selección nacional francesa)',
    citation: 'Millet GP, Dreano P, Bentley DJ (2003). Physiological characteristics of elite short- and long-distance triathletes. Eur J Appl Physiol 88:427–430.',
    citation_short: 'Millet et al. (2003)', year: 2003,
    notes: 'n=9 selección nacional francesa, participantes en Campeonato del Mundo. Ergómetro. Potencia pico = 384.7 ± 50.2 W (5.47 W/kg). % grasa corporal 10.4 ± 2.1%.',
  },
  {
    id: 'tri_oly_elite_f',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'international', level_label: 'Élite Femenina', population_category: 'professional',
    sex: 'female', vo2max_mean: 65.6, vo2max_sd: 6.0, vo2max_min: 58, vo2max_max: 72,
    lactate_lt1_vo2_percent: 63, lactate_lt2_vo2_percent: 82,
    population: 'Mixto (Australiano/Europeo)',
    citation: 'Zhou S, et al. (1997). Physiological characteristics of elite and club level female triathletes. Int J Sports Med. PMID: 8300272.',
    citation_short: 'Zhou et al. (1997)', year: 1997,
    notes: 'n=10 mujeres élite vs. n=9 nivel club (60.4 ± 3.1). Diferencia significativa p=0.03.',
  },
  {
    id: 'tri_oly_amateur_f',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'recreational', level_label: 'Amateur / Club', population_category: 'active',
    sex: 'female', vo2max_mean: 48.0, vo2max_sd: 5.0, vo2max_min: 41, vo2max_max: 56,
    lactate_lt1_vo2_percent: 55, lactate_lt2_vo2_percent: 73,
    population: 'Europeo / Australiano',
    citation: 'Zhou S, et al. (1997). Physiological characteristics of elite and club level female triathletes. Int J Sports Med. PMID: 8300272.',
    citation_short: 'Zhou et al. (1997)', year: 1997,
    notes: 'Triatletas femeninas nivel club/amateur.',
  },

  // ===== IRONMAN =====
  {
    id: 'tri_ironman_rec_m',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'recreational', level_label: 'Age-Grouper Recreativo', population_category: 'active',
    sex: 'male', vo2max_mean: 58.1, vo2max_sd: 8.6, vo2max_min: 46, vo2max_max: 72,
    lactate_lt1_vo2_percent: 58, lactate_lt2_vo2_percent: 75,
    population: 'Mixto (Age-group internacional)',
    citation: 'Dovepress (2016). Variables that influence Ironman triathlon performance. Open Access J Sports Med.',
    citation_short: 'Dovepress (2016)', year: 2016,
    notes: 'Finishers masculinos recreacionales de Ironman. Base de datos age-group (Malkinson et al., J Exerc Physiol 2022): hombres 20–29 media ~49.8–51.8 mL/kg/min.',
  },
  {
    id: 'tri_ironman_nat_m',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'male', vo2max_mean: 65.0, vo2max_sd: 5.0, vo2max_min: 59, vo2max_max: 72,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 80,
    population: 'Europeo / Australiano',
    citation: 'Laursen PB & Jenkins DG (2002). The scientific basis for high-intensity interval training. Sports Med 32:53–73.',
    citation_short: 'Laursen & Jenkins (2002)', year: 2002,
    notes: 'Triatletas de larga distancia nivel nacional.',
  },
  {
    id: 'tri_ironman_rec_f',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'recreational', level_label: 'Age-Grouper Recreativo', population_category: 'active',
    sex: 'female', vo2max_mean: 52.8, vo2max_sd: 5.7, vo2max_min: 44, vo2max_max: 62,
    lactate_lt1_vo2_percent: 57, lactate_lt2_vo2_percent: 74,
    population: 'Mixto (Age-group internacional)',
    citation: 'Dovepress (2016). Variables that influence Ironman triathlon performance. Open Access J Sports Med.',
    citation_short: 'Dovepress (2016)', year: 2016,
    notes: 'Finishers femeninas recreacionales de Ironman.',
  },

  // ===== TRIATLÓN LARGA DISTANCIA =====
  {
    id: 'tri_long_elite_m',
    sport: 'triathlon_long', sport_label: 'Triatlón (Larga Distancia)', level: 'professional', level_label: 'Profesional / Clase Mundial', population_category: 'professional',
    sex: 'male', vo2max_mean: 85, vo2max_sd: 8, vo2max_min: 72, vo2max_max: 101,
    lactate_lt1_vo2_percent: 70, lactate_lt2_vo2_percent: 88,
    population: 'Europeo (Noruego, Belga, etc.)',
    citation: 'Millet GP et al. (2003). Eur J Appl Physiol 88:427–430. Kristian Blummenfelt reported VO2max (running) = 101.1 mL/kg/min.',
    citation_short: 'Millet (2003); caso Blummenfelt', year: 2020,
    notes: 'Triatletas LD de élite: selección francesa 72.3 ± 2.3 (ergómetro). Blummenfelt (Olímpico + Ironman WC): 101.1 corriendo — outlier extremo.',
  },
  {
    id: 'tri_long_nat_m',
    sport: 'triathlon_long', sport_label: 'Triatlón (Larga Distancia)', level: 'national', level_label: 'Nacional / Amateur Avanzado', population_category: 'amateur',
    sex: 'male', vo2max_mean: 65.0, vo2max_sd: 5.0, vo2max_min: 58, vo2max_max: 73,
    lactate_lt1_vo2_percent: 62, lactate_lt2_vo2_percent: 80,
    population: 'Europeo / Americano',
    citation: 'Laursen PB & Jenkins DG (2002). Sports Med 32:53–73.',
    citation_short: 'Laursen & Jenkins (2002)', year: 2002,
    notes: 'Triatletas de larga distancia nivel nacional/avanzado.',
  },
  {
    id: 'tri_long_elite_f',
    sport: 'triathlon_long', sport_label: 'Triatlón (Larga Distancia)', level: 'professional', level_label: 'Profesional / Clase Mundial', population_category: 'professional',
    sex: 'female', vo2max_mean: 70.0, vo2max_sd: 5.0, vo2max_min: 63, vo2max_max: 78,
    lactate_lt1_vo2_percent: 67, lactate_lt2_vo2_percent: 85,
    population: 'Europeo / Internacional',
    citation: 'Millet GP et al. (2003). Eur J Appl Physiol 88:427–430.',
    citation_short: 'Millet et al. (2003)', year: 2003,
    notes: 'Triatletas femeninas de larga distancia de clase mundial.',
  },
];

export const ANTHRO_REFERENCES: AnthropometryReference[] = [

  // ===== CICLISMO EN RUTA =====
  {
    id: 'cyc_road_pro_m_anthro',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'professional', level_label: 'Profesional', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 9.5, body_fat_sd: null, body_fat_min: 5, body_fat_max: 12,
    muscle_mass_percent_mean: 50.2, muscle_mass_percent_sd: null,
    sum_6_skinfolds_mean: 38.0, sum_6_skinfolds_sd: null, sum_6_skinfolds_min: 28, sum_6_skinfolds_max: 52,
    skinfold_sum_sites: '6 pliegues (tríceps, subescapular, supraespinal, abdominal, muslo anterior, pantorrilla medial)',
    muscle_bone_ratio_mean: 5.8, muscle_bone_ratio_sd: null,
    measurement_protocol: 'DEXA',
    population: 'Europeo',
    citation: 'Bell PG et al. (2017). Int J Sports Physiol Perform 12:1246–1252. PMID: 27508883.',
    citation_short: 'Bell et al. (2017)', year: 2017,
    notes: 'Doble ganador TdF: DEXA % grasa = 9.5%, masa grasa = 6.7 kg. Rango profesional: 5–9% en máxima forma. Júnior élite: ~10.3%.',
  },
  {
    id: 'cyc_road_nat_m_anthro',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'national', level_label: 'Nacional / Amateur Competitivo', population_category: 'amateur',
    sex: 'male',
    body_fat_mean: 12.5, body_fat_sd: 3, body_fat_min: 8, body_fat_max: 18,
    muscle_mass_percent_mean: 47.5, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 58.0, sum_6_skinfolds_sd: 10.0, sum_6_skinfolds_min: 40, sum_6_skinfolds_max: 80,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.4, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Mixto / Europeo',
    citation: 'Burke ER (1980). Physician Sportsmed 8(7):78–84. Sallet P et al. (2006). Int J Sports Med 27:1–9.',
    citation_short: 'Burke (1980); Sallet et al. (2006)', year: 2006,
    notes: 'Selección masculina senior nacional EEUU: recomendado 5–9% máxima forma. Júnior: 9–12%. Amateur competitivo: 10–15%.',
  },
  {
    id: 'cyc_road_rec_m_anthro',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'male',
    body_fat_mean: 16.5, body_fat_sd: 4.0, body_fat_min: 10, body_fat_max: 24,
    muscle_mass_percent_mean: 44.0, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 85.0, sum_6_skinfolds_sd: 20.0, sum_6_skinfolds_min: 55, sum_6_skinfolds_max: 130,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.0, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo / Americano',
    citation: 'Jeukendrup AE & Martin J (2001). Improving cycling performance: how should we spend our time and money. Sports Med 31:559–569.',
    citation_short: 'Jeukendrup & Martin (2001)', year: 2001,
    notes: 'Ciclistas recreacionales con entrenamiento regular (5–10 h/semana). Alto rango de variabilidad.',
  },
  {
    id: 'cyc_road_nat_f_anthro',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'national', level_label: 'Nacional Femenino', population_category: 'amateur',
    sex: 'female',
    body_fat_mean: 15.4, body_fat_sd: null, body_fat_min: 12, body_fat_max: 18,
    muscle_mass_percent_mean: 41.5, muscle_mass_percent_sd: null,
    sum_6_skinfolds_mean: 70.0, sum_6_skinfolds_sd: null, sum_6_skinfolds_min: 54, sum_6_skinfolds_max: 90,
    skinfold_sum_sites: '6 pliegues (hidrostático)',
    muscle_bone_ratio_mean: 4.8, muscle_bone_ratio_sd: null,
    measurement_protocol: 'Pesaje Hidrostático',
    population: 'Americano',
    citation: "Burke ER (1980). US Women's National Cycling Team. Physician Sportsmed 8(7):78–84.",
    citation_short: 'Burke (1980)', year: 1980,
    notes: "Equipo nacional femenino de EEUU: 15.4% grasa (pesaje hidrostático). Rango recomendado para competitivas: 12–15%.",
  },
  {
    id: 'cyc_road_pro_f_anthro',
    sport: 'cycling_road', sport_label: 'Ciclismo en Ruta', level: 'professional', level_label: 'Profesional', population_category: 'professional',
    sex: 'female',
    body_fat_mean: 13.0, body_fat_sd: 2.0, body_fat_min: 9, body_fat_max: 17,
    muscle_mass_percent_mean: 43.0, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 60.0, sum_6_skinfolds_sd: 10.0, sum_6_skinfolds_min: 45, sum_6_skinfolds_max: 80,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.0, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo',
    citation: 'Jeukendrup AE, et al. (2000). J Strength Cond Res 14:232–236.',
    citation_short: 'Jeukendrup et al. (2000)', year: 2000,
    notes: 'Ciclistas profesionales femeninas de alto nivel.',
  },

  // ===== MTB =====
  {
    id: 'cyc_mtb_elite_m_anthro',
    sport: 'cycling_mtb', sport_label: 'Mountain Bike (XCO)', level: 'international', level_label: 'Élite Masculino', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 9.8, body_fat_sd: 3, body_fat_min: 5.3, body_fat_max: 14.3,
    muscle_mass_percent_mean: 51.5, muscle_mass_percent_sd: 3.5,
    sum_6_skinfolds_mean: 47.71, sum_6_skinfolds_sd: 8.24, sum_6_skinfolds_min: 34, sum_6_skinfolds_max: 70,
    skinfold_sum_sites: '6 pliegues (tríceps, subescapular, suprailiaco, muslo, abdominal, pantorrilla medial)',
    muscle_bone_ratio_mean: 6.0, muscle_bone_ratio_sd: 0.5,
    measurement_protocol: 'ISAK',
    population: 'Europeo / Sudamericano',
    citation: 'Mirizio GG et al. (2021). IJERPH 18:5535. PMC8196776. Impellizzeri FM & Marcora SM (2007). Sports Med 37:59–71.',
    citation_short: 'Mirizio et al. (2021)', year: 2021,
    notes: 'Σ6 pliegues = 47.71 ± 8.24 mm (nacional juvenil argentino). Rango adultos élite 5.3–14.3% GC de 4 estudios.',
  },
  {
    id: 'cyc_mtb_nat_m_anthro',
    sport: 'cycling_mtb', sport_label: 'Mountain Bike (XCO)', level: 'national', level_label: 'Nivel Nacional', population_category: 'amateur',
    sex: 'male',
    body_fat_mean: 13.0, body_fat_sd: 3.0, body_fat_min: 8, body_fat_max: 18,
    muscle_mass_percent_mean: 48.0, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 68.0, sum_6_skinfolds_sd: 15.0, sum_6_skinfolds_min: 46, sum_6_skinfolds_max: 90,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.5, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Latinoamericano / Europeo',
    citation: 'Mirizio GG et al. (2021). IJERPH 18:5535. PMC8196776.',
    citation_short: 'Mirizio et al. (2021)', year: 2021,
    notes: 'Ciclistas MTB nacionales. Valores de Σ6 pliegues más altos que pros.',
  },

  // ===== RUNNING =====
  {
    id: 'run_road_rec_m_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'recreational', level_label: 'Recreativo', population_category: 'active',
    sex: 'male',
    body_fat_mean: 14.0, body_fat_sd: 4.0, body_fat_min: 7, body_fat_max: 22,
    muscle_mass_percent_mean: 44.5, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 80.0, sum_6_skinfolds_sd: 22.0, sum_6_skinfolds_min: 50, sum_6_skinfolds_max: 130,
    skinfold_sum_sites: '6 pliegues ISAK estimado',
    muscle_bone_ratio_mean: 5.1, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo (Reino Unido)',
    citation: 'Gordon D et al. (2017). Open Access J Sports Med 8:231–243. PMC5703178.',
    citation_short: 'Gordon et al. (2017)', year: 2017,
    notes: 'n=82 corredores recreacionales de maratón (UK). Alta variabilidad según tiempo de llegada.',
  },
  {
    id: 'run_elite_m_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'international', level_label: 'Élite / Internacional', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 6, body_fat_sd: 2, body_fat_min: 4, body_fat_max: 10,
    muscle_mass_percent_mean: 47.5, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 32.0, sum_6_skinfolds_sd: 7.0, sum_6_skinfolds_min: 22, sum_6_skinfolds_max: 48,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.5, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK / DEXA',
    population: 'Mixto (Africano Oriental / Europeo)',
    citation: 'Costill DL et al. (1976). J Appl Physiol 40:149–154. Weston AR et al. (1999). J Physiol 520(pt 1):211–222.',
    citation_short: 'Costill et al. (1976); Weston et al. (1999)', year: 1999,
    notes: 'Corredores élite de larga distancia masculinos: ~4–8% GC. Bajo peso típico de corredores élite.',
  },
  {
    id: 'run_nat_m_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'male',
    body_fat_mean: 9.5, body_fat_sd: 2.5, body_fat_min: 6, body_fat_max: 14,
    muscle_mass_percent_mean: 46.0, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 48.0, sum_6_skinfolds_sd: 12.0, sum_6_skinfolds_min: 32, sum_6_skinfolds_max: 66,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.3, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo',
    citation: 'Sjodin B & Svedenhag J (1985). Applied physiology of marathon running. Sports Med 2:83–99.',
    citation_short: 'Sjodin & Svedenhag (1985)', year: 1985,
    notes: 'Corredores de maratón sub-élite (PR <2:30 h). Σ6 pliegues estimado a partir del % grasa.',
  },
  {
    id: 'run_elite_f_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'international', level_label: 'Élite Femenina', population_category: 'professional',
    sex: 'female',
    body_fat_mean: 15.2, body_fat_sd: 2.5, body_fat_min: 12, body_fat_max: 19,
    muscle_mass_percent_mean: 42.5, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 58.0, sum_6_skinfolds_sd: 10.0, sum_6_skinfolds_min: 40, sum_6_skinfolds_max: 76,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.9, muscle_bone_ratio_sd: null,
    measurement_protocol: 'Hidrostático / ISAK',
    population: 'Americano / Europeo',
    citation: 'Costill DL et al. (1976). J Appl Physiol 40:149–154.',
    citation_short: 'Costill et al. (1976)', year: 1976,
    notes: 'Corredoras élite de larga distancia: GC = 15.2% (Costill 1976). Referencia clásica ampliamente citada.',
  },
  {
    id: 'run_nat_f_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'female',
    body_fat_mean: 18.0, body_fat_sd: 3.0, body_fat_min: 13, body_fat_max: 23,
    muscle_mass_percent_mean: 40.0, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 78.0, sum_6_skinfolds_sd: 15.0, sum_6_skinfolds_min: 55, sum_6_skinfolds_max: 100,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.7, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo',
    citation: 'Sjodin B & Svedenhag J (1985). Sports Med 2:83–99.',
    citation_short: 'Sjodin & Svedenhag (1985)', year: 1985,
    notes: 'Corredoras de maratón nacionales.',
  },
  {
    id: 'run_rec_f_anthro',
    sport: 'running_road', sport_label: 'Running / Maratón', level: 'recreational', level_label: 'Recreativo', population_category: 'active',
    sex: 'female',
    body_fat_mean: 22.0, body_fat_sd: 5.0, body_fat_min: 14, body_fat_max: 30,
    muscle_mass_percent_mean: 38.0, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 110.0, sum_6_skinfolds_sd: 28.0, sum_6_skinfolds_min: 70, sum_6_skinfolds_max: 160,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.4, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo (Reino Unido)',
    citation: 'Gordon D et al. (2017). Open Access J Sports Med 8:231–243. PMC5703178.',
    citation_short: 'Gordon et al. (2017)', year: 2017,
    notes: 'Corredoras recreacionales de maratón (UK).',
  },

  // ===== TRAIL RUNNING =====
  {
    id: 'trail_rec_anthro_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'recreational', level_label: 'Recreativo Ultra', population_category: 'active',
    sex: 'male',
    body_fat_mean: 16.5, body_fat_sd: 4.0, body_fat_min: 10, body_fat_max: 26,
    muscle_mass_percent_mean: 44.0, muscle_mass_percent_sd: 3.5,
    sum_6_skinfolds_mean: 88.0, sum_6_skinfolds_sd: 22.0, sum_6_skinfolds_min: 58, sum_6_skinfolds_max: 140,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.0, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Canadiense',
    citation: 'Coates AM et al. (2021). Int J Sports Physiol Perform. doi:10.1123/ijspp.2020-0766.',
    citation_short: 'Coates et al. (2021)', year: 2021,
    notes: 'Mayor Σ6 pliegues que corredores de ruta, refleja constitución más musculosa en la comunidad trail.',
  },
  {
    id: 'trail_nat_anthro_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'national', level_label: 'Nacional / Sub-élite', population_category: 'amateur',
    sex: 'male',
    body_fat_mean: 12.0, body_fat_sd: 3.0, body_fat_min: 7, body_fat_max: 18,
    muscle_mass_percent_mean: 46.5, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 58.0, sum_6_skinfolds_sd: 14.0, sum_6_skinfolds_min: 38, sum_6_skinfolds_max: 80,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.2, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo',
    citation: 'Ehrström S, et al. (2018). J Strength Cond Res 32:2955–2961.',
    citation_short: 'Ehrström et al. (2018)', year: 2018,
    notes: 'Corredores de trail nacionales europeos.',
  },
  {
    id: 'trail_pro_anthro_m',
    sport: 'trail_running', sport_label: 'Trail Running', level: 'world_class', level_label: 'Élite Mundial', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 7.5, body_fat_sd: 2.0, body_fat_min: 5, body_fat_max: 11,
    muscle_mass_percent_mean: 49.0, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 38.0, sum_6_skinfolds_sd: 8.0, sum_6_skinfolds_min: 26, sum_6_skinfolds_max: 52,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.7, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo (Español)',
    citation: 'PMID 39289331. Int J Sports Physiol Perform (2024). Kilian Jornet physiological profile.',
    citation_short: 'PMID 39289331 (2024)', year: 2024,
    notes: 'Kilian Jornet: GC ~5–7%. Excepcional relación músculo/hueso.',
  },

  // ===== ATLETISMO EN PISTA =====
  {
    id: 'run_track_elite_m_anthro',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'international', level_label: 'Élite (5000/10000 m)', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 7.5, body_fat_sd: 2.0, body_fat_min: 4, body_fat_max: 12,
    muscle_mass_percent_mean: 49.0, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 36.0, sum_6_skinfolds_sd: 8.0, sum_6_skinfolds_min: 24, sum_6_skinfolds_max: 52,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.6, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK / Hidrostático',
    population: 'Americano / Europeo',
    citation: 'Costill DL et al. (1976). J Appl Physiol 40:149–154. Withers RT et al. (1997). J Sci Med Sport.',
    citation_short: 'Costill et al. (1976); Withers et al. (1997)', year: 1997,
    notes: 'Corredores de pista de larga distancia masculinos élite. % grasa corporal muy bajo.',
  },
  {
    id: 'run_track_elite_f_anthro',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'international', level_label: 'Élite (5000/10000 m)', population_category: 'professional',
    sex: 'female',
    body_fat_mean: 15.2, body_fat_sd: 2.5, body_fat_min: 12, body_fat_max: 19,
    muscle_mass_percent_mean: 42.0, muscle_mass_percent_sd: 2.5,
    sum_6_skinfolds_mean: 62.0, sum_6_skinfolds_sd: 12.0, sum_6_skinfolds_min: 44, sum_6_skinfolds_max: 80,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.9, muscle_bone_ratio_sd: null,
    measurement_protocol: 'Hidrostático / ISAK',
    population: 'Americano / Europeo',
    citation: 'Costill DL et al. (1976). J Appl Physiol 40:149–154.',
    citation_short: 'Costill et al. (1976)', year: 1976,
    notes: 'Corredoras élite de fondo en pista.',
  },
  {
    id: 'run_track_rec_m_anthro',
    sport: 'running_track', sport_label: 'Atletismo en Pista', level: 'recreational', level_label: 'Recreativo / Club', population_category: 'active',
    sex: 'male',
    body_fat_mean: 15.0, body_fat_sd: 4.0, body_fat_min: 8, body_fat_max: 22,
    muscle_mass_percent_mean: 44.0, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 80.0, sum_6_skinfolds_sd: 22.0, sum_6_skinfolds_min: 48, sum_6_skinfolds_max: 130,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.1, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo / Americano',
    citation: 'Bassett DR & Howley ET (2000). Med Sci Sports Exerc 32:70–84.',
    citation_short: 'Bassett & Howley (2000)', year: 2000,
    notes: 'Atletas recreacionales de pista.',
  },

  // ===== NATACIÓN =====
  {
    id: 'swim_univ_m_anthro',
    sport: 'swimming', sport_label: 'Natación', level: 'recreational', level_label: 'Universitario / Club', population_category: 'active',
    sex: 'male',
    body_fat_mean: 14.0, body_fat_sd: 3.5, body_fat_min: 8, body_fat_max: 20,
    muscle_mass_percent_mean: 46.0, muscle_mass_percent_sd: 3.5,
    sum_6_skinfolds_mean: 72.0, sum_6_skinfolds_sd: 18.0, sum_6_skinfolds_min: 46, sum_6_skinfolds_max: 100,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.3, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Americano / Europeo',
    citation: 'UNLV thesis data; Saltin B & Astrand PO (1967). J Appl Physiol 23:353–358.',
    citation_short: 'UNLV / Saltin & Astrand (1967)', year: 1967,
    notes: 'Nadadores universitarios masculinos. Los nadadores tienden a tener mayor % grasa que otros deportistas de resistencia.',
  },
  {
    id: 'swim_elite_m_anthro',
    sport: 'swimming', sport_label: 'Natación', level: 'international', level_label: 'Nacional / Nivel Olímpico', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 10.5, body_fat_sd: 2.5, body_fat_min: 7, body_fat_max: 15,
    muscle_mass_percent_mean: 52.0, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 50.0, sum_6_skinfolds_sd: 12.0, sum_6_skinfolds_min: 34, sum_6_skinfolds_max: 70,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.9, muscle_bone_ratio_sd: null,
    measurement_protocol: 'DEXA / ISAK',
    population: 'Mixto (Americano / Europeo / Australiano)',
    citation: 'Saltin B & Astrand PO (1967). J Appl Physiol 23:353–358. MDPI Nutrients (2024). Body composition of Olympic swimmers.',
    citation_short: 'Saltin & Astrand (1967); MDPI Nutrients (2024)', year: 2024,
    notes: 'Nadadores olímpicos masculinos. Alta masa muscular relativa. Los sprinters tienen mayor masa que los fondistas.',
  },
  {
    id: 'swim_univ_f_anthro',
    sport: 'swimming', sport_label: 'Natación', level: 'recreational', level_label: 'Universitaria / Club', population_category: 'active',
    sex: 'female',
    body_fat_mean: 15.79, body_fat_sd: null, body_fat_min: 12, body_fat_max: 22,
    muscle_mass_percent_mean: 42.0, muscle_mass_percent_sd: null,
    sum_6_skinfolds_mean: 78.0, sum_6_skinfolds_sd: null, sum_6_skinfolds_min: 56, sum_6_skinfolds_max: 105,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.8, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Americano',
    citation: 'UNLV university swimmer physiological profile data.',
    citation_short: 'UNLV/Train Daly data', year: 2005,
    notes: 'Nadadoras universitarias competitivas: masa 62.8 kg; altura 173.4 cm; GC ~15.79%. IMC ~23 reportado para nivel olímpico (MDPI Nutrients 2024).',
  },
  {
    id: 'swim_elite_f_anthro',
    sport: 'swimming', sport_label: 'Natación', level: 'international', level_label: 'Nacional / Nivel Olímpico', population_category: 'professional',
    sex: 'female',
    body_fat_mean: 17.5, body_fat_sd: 3.0, body_fat_min: 13, body_fat_max: 23,
    muscle_mass_percent_mean: 44.5, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 82.0, sum_6_skinfolds_sd: 14.0, sum_6_skinfolds_min: 60, sum_6_skinfolds_max: 110,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.1, muscle_bone_ratio_sd: null,
    measurement_protocol: 'DEXA / ISAK',
    population: 'Internacional (Olímpico)',
    citation: 'MDPI Nutrients (2024). Body composition of Olympic swimmers. Saltin B & Astrand PO (1967).',
    citation_short: 'MDPI Nutrients (2024); Saltin (1967)', year: 2024,
    notes: 'Nadadoras olímpicas femeninas. Los nadadores mantienen mayor adiposidad que otros deportistas de resistencia para flotabilidad.',
  },

  // ===== TRIATLÓN OLÍMPICO =====
  {
    id: 'tri_oly_elite_m_anthro',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'international', level_label: 'Élite (Campeonato del Mundo)', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 10.4, body_fat_sd: 2.1, body_fat_min: 7, body_fat_max: 14,
    muscle_mass_percent_mean: 50.5, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 48.0, sum_6_skinfolds_sd: 10.0, sum_6_skinfolds_min: 34, sum_6_skinfolds_max: 66,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.8, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo (Selección nacional francesa)',
    citation: 'Millet GP, Dreano P, Bentley DJ (2003). Eur J Appl Physiol 88:427–430.',
    citation_short: 'Millet et al. (2003)', year: 2003,
    notes: 'n=9 equipo francés (distancia olímpica). Masa corporal 70.2 ± 5.2 kg; altura ~178 cm. Larga distancia: 9.3 ± 0.7%. Dato reciente: triatleta olímpico élite GC 8.77 ± 1.62%.',
  },
  {
    id: 'tri_oly_amateur_m_anthro',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'recreational', level_label: 'Amateur / Club', population_category: 'active',
    sex: 'male',
    body_fat_mean: 15.5, body_fat_sd: 4.0, body_fat_min: 10, body_fat_max: 22,
    muscle_mass_percent_mean: 46.5, muscle_mass_percent_sd: 3.5,
    sum_6_skinfolds_mean: 80.0, sum_6_skinfolds_sd: 22.0, sum_6_skinfolds_min: 52, sum_6_skinfolds_max: 120,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.2, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Europeo',
    citation: 'MDPI Healthcare (2023) 11(4):622.',
    citation_short: 'MDPI Healthcare (2023)', year: 2023,
    notes: 'Triatletas amateurs masculinos.',
  },
  {
    id: 'tri_oly_elite_f_anthro',
    sport: 'triathlon_olympic', sport_label: 'Triatlón (Olímpico)', level: 'international', level_label: 'Élite Femenina', population_category: 'professional',
    sex: 'female',
    body_fat_mean: 16.5, body_fat_sd: 3.0, body_fat_min: 12, body_fat_max: 21,
    muscle_mass_percent_mean: 43.5, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 72.0, sum_6_skinfolds_sd: 14.0, sum_6_skinfolds_min: 52, sum_6_skinfolds_max: 94,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.0, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Mixto (Australiano/Europeo)',
    citation: 'Zhou S, et al. (1997). Int J Sports Med. PMID: 8300272.',
    citation_short: 'Zhou et al. (1997)', year: 1997,
    notes: 'Triatletas femeninas olímpicas élite.',
  },

  // ===== IRONMAN =====
  {
    id: 'tri_ironman_rec_m_anthro',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'recreational', level_label: 'Age-Grouper Recreativo', population_category: 'active',
    sex: 'male',
    body_fat_mean: 17.0, body_fat_sd: 5.0, body_fat_min: 10, body_fat_max: 26,
    muscle_mass_percent_mean: 45.0, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 88.0, sum_6_skinfolds_sd: 24.0, sum_6_skinfolds_min: 56, sum_6_skinfolds_max: 140,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.1, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Mixto Internacional',
    citation: 'Dovepress (2016). Open Access J Sports Med. Malkinson TJ, et al. (2022). J Exerc Physiol.',
    citation_short: 'Dovepress (2016)', year: 2016,
    notes: 'Finishers masculinos de Ironman age-group. Alta variabilidad antropométrica.',
  },
  {
    id: 'tri_ironman_pro_m_anthro',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'professional', level_label: 'Profesional', population_category: 'professional',
    sex: 'male',
    body_fat_mean: 8.5, body_fat_sd: 2.0, body_fat_min: 5, body_fat_max: 12,
    muscle_mass_percent_mean: 51.0, muscle_mass_percent_sd: 3.0,
    sum_6_skinfolds_mean: 42.0, sum_6_skinfolds_sd: 9.0, sum_6_skinfolds_min: 28, sum_6_skinfolds_max: 58,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 5.8, muscle_bone_ratio_sd: null,
    measurement_protocol: 'DEXA / ISAK',
    population: 'Europeo (Noruego / Alemán)',
    citation: 'Millet GP et al. (2003). Eur J Appl Physiol 88:427–430. Blummenfelt case data (2021).',
    citation_short: 'Millet et al. (2003)', year: 2021,
    notes: 'Triatletas profesionales de Ironman. Blummenfelt (campeón olímpico + Ironman): índice músculo/hueso excepcional.',
  },
  {
    id: 'tri_ironman_rec_f_anthro',
    sport: 'triathlon_ironman', sport_label: 'Triatlón (Ironman)', level: 'recreational', level_label: 'Age-Grouper Recreativo', population_category: 'active',
    sex: 'female',
    body_fat_mean: 22.0, body_fat_sd: 5.0, body_fat_min: 15, body_fat_max: 30,
    muscle_mass_percent_mean: 39.5, muscle_mass_percent_sd: 4.0,
    sum_6_skinfolds_mean: 115.0, sum_6_skinfolds_sd: 28.0, sum_6_skinfolds_min: 76, sum_6_skinfolds_max: 165,
    skinfold_sum_sites: '6 pliegues ISAK',
    muscle_bone_ratio_mean: 4.6, muscle_bone_ratio_sd: null,
    measurement_protocol: 'ISAK',
    population: 'Mixto Internacional',
    citation: 'Dovepress (2016). Open Access J Sports Med.',
    citation_short: 'Dovepress (2016)', year: 2016,
    notes: 'Finishers femeninas de Ironman age-group.',
  },
];

export function getVO2References(sport: Sport, sex: Sex): VO2Reference[] {
  return VO2_REFERENCES.filter(r => r.sport === sport && r.sex === sex)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

export function getVO2ReferencesByCategory(sport: Sport, sex: Sex, category: PopulationCategory): VO2Reference[] {
  return VO2_REFERENCES.filter(r => r.sport === sport && r.sex === sex && r.population_category === category)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

export function getAnthroReferences(sport: Sport, sex: Sex): AnthropometryReference[] {
  return ANTHRO_REFERENCES.filter(r => r.sport === sport && r.sex === sex)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

export function getAnthroReferencesByCategory(sport: Sport, sex: Sex, category: PopulationCategory): AnthropometryReference[] {
  return ANTHRO_REFERENCES.filter(r => r.sport === sport && r.sex === sex && r.population_category === category)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

export function getLevelFromCategory(category: PopulationCategory): CompetitiveLevel[] {
  return LEVEL_ORDER.filter(l => LEVEL_TO_CATEGORY[l] === category);
}

export function classifyVO2Level(vo2max: number, sport: Sport, sex: Sex): {
  level: CompetitiveLevel;
  label: string;
  percentile: string;
  color: string;
  distance: number;
} {
  const refs = getVO2References(sport, sex);
  if (refs.length === 0) return { level: 'recreational', label: 'Sin datos de referencia', percentile: 'N/A', color: 'gray', distance: 0 };

  let best: VO2Reference = refs[0];
  let minDist = Infinity;

  for (const ref of refs) {
    const dist = Math.abs(vo2max - ref.vo2max_mean);
    if (dist < minDist) { minDist = dist; best = ref; }
  }

  const COLOR_MAP: Record<CompetitiveLevel, string> = {
    recreational: 'gray',
    national: 'blue',
    international: 'green',
    professional: 'amber',
    world_class: 'red',
  };

  const pct = best.vo2max_sd
    ? ((vo2max - best.vo2max_mean) / best.vo2max_sd * 15 + 50).toFixed(0)
    : 'N/A';

  return {
    level: best.level,
    label: best.level_label,
    percentile: pct,
    color: COLOR_MAP[best.level],
    distance: Math.round((vo2max - best.vo2max_mean) * 10) / 10,
  };
}

export function getVO2ScalePositions(sport: Sport, sex: Sex): Array<{
  x: number;
  level: CompetitiveLevel;
  label: string;
  vo2max: number;
}> {
  const refs = getVO2References(sport, sex);
  if (refs.length === 0) return [];

  const minVO2 = Math.min(...refs.map(r => r.vo2max_min)) - 5;
  const maxVO2 = Math.max(...refs.map(r => r.vo2max_max)) + 5;
  const range = maxVO2 - minVO2;

  return refs.map(ref => ({
    x: ((ref.vo2max_mean - minVO2) / range) * 100,
    level: ref.level,
    label: ref.level_label,
    vo2max: ref.vo2max_mean,
  }));
}
