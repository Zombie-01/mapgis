/**
 * Geospatial Intelligence Dataset for South Gobi, Mongolia (Монгол хэлээр)
 * Contains coordinates, names, types, and risk attributes for Mongolia-only GIS:
 * 1. Уул уурхайн лиценз (mining) - Red extruded 3D polygons
 * 2. Хайгуулын талбай (exploration) - Translucent blue polygons with animated scan effect styling
 * 3. Ордын нөөц (reserves) - Gold/orange extrusions where height = log(reserve_value)
 * 4. Тусгай хамгаалалттай бүс (protected) - Green transparent polygons
 * 5. Усны ай сав (watershed) - Blue polygons representing hydrology
 * 6. Компани / обьект (company) - Glowing orange points
 * 7. Аймаг, сумын хил (admin) - Grey boundary lines
 * 8. Замын сүлжээ (road) - Grey/slate lines
 * 9. Байгаль орчны эрсдэл (risk) - Pulsing/flashing red overlay
 */

export interface LatLng {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface GeoFeature {
  id: string;
  name: string;
  type: 'mining' | 'exploration' | 'reserves' | 'protected' | 'watershed' | 'company' | 'admin' | 'road' | 'risk';
  coordinates: LatLng[];
  properties: {
    status?: string;
    owner?: string;
    description: string;
    riskStatus?: string;
    areaSqKm?: number;
    resource?: string;
    level?: string;
    reserveValue?: number; // Reserve tonnage to compute log(height)
    reserveGrade?: 'Low' | 'Medium' | 'High';
  };
}

export const SOUTH_GOBI_CENTER = {
  lat: 43.450,
  lng: 105.450,
  altitude: 0,
  range: 160000 // In meters (160km view)
};

// Bound clamping limits (Mongolia boundaries)
// Latitude: 41.5 to 52.2, Longitude: 87.5 to 119.9
export const MONGOLIA_BOUNDS = {
  minLat: 41.5,
  maxLat: 52.2,
  minLng: 87.5,
  maxLng: 119.9
};

export function clampToMongolia(lat: number, lng: number): LatLng {
  const clampedLat = Math.max(MONGOLIA_BOUNDS.minLat, Math.min(MONGOLIA_BOUNDS.maxLat, lat));
  const clampedLng = Math.max(MONGOLIA_BOUNDS.minLng, Math.min(MONGOLIA_BOUNDS.maxLng, lng));
  return { lat: clampedLat, lng: clampedLng };
}

export const GEOSPATIAL_FEATURES: GeoFeature[] = [
  // =================== УУЛ УУРХАЙН ЛИЦЕНЗ (MINING - RED) ===================
  {
    id: 'mining_oyu_tolgoi',
    name: 'Оюу Толгой Зэс-Алтны Уурхайн Лицензтэй Талбай',
    type: 'mining',
    coordinates: [
      { lat: 43.12, lng: 106.75, altitude: 50 },
      { lat: 43.12, lng: 106.95, altitude: 50 },
      { lat: 42.92, lng: 106.95, altitude: 50 },
      { lat: 42.92, lng: 106.75, altitude: 50 },
      { lat: 43.12, lng: 106.75, altitude: 50 }
    ],
    properties: {
      owner: 'Оюу Толгой ХХК (Рио Тинто 66% / Монгол улсын Засгийн газар 34%)',
      status: 'Идэвхтэй ашиглалтын шатанд',
      resource: 'Зэс, Алт, Мөнгө',
      areaSqKm: 230,
      description: 'Дэлхийн хамгийн том зэс, алтны ордуудын нэг бөгөөд ил уурхай болон гүний блок-чейв олборлолтыг хослуулж буй мега төсөл.'
    }
  },
  {
    id: 'mining_tavan_tolgoi',
    name: 'Таван Толгой Нүүрсний Ордын Ашиглалтын Лицензүүд',
    type: 'mining',
    coordinates: [
      { lat: 43.70, lng: 105.35, altitude: 50 },
      { lat: 43.70, lng: 105.65, altitude: 50 },
      { lat: 43.52, lng: 105.65, altitude: 50 },
      { lat: 43.52, lng: 105.35, altitude: 50 },
      { lat: 43.70, lng: 105.35, altitude: 50 }
    ],
    properties: {
      owner: 'Эрдэнэс Тавантолгой ХК (Төрийн өмчит)',
      status: 'Идэвхтэй олборлолт',
      resource: 'Коксжих болон эрчим хүчний нүүрс',
      areaSqKm: 180,
      description: 'Маш өндөр чанарын коксжих нүүрсний асар их нөөцтэй орд. Өмнөд говийн эдийн засаг, тээврийн коридорын гол хөдөлгөгч хүч.'
    }
  },
  {
    id: 'mining_erdenet',
    name: 'Эрдэнэт Овоо Зэс-Молибдений Ил Уурхайн Ашиглалтын Талбай',
    type: 'mining',
    coordinates: [
      { lat: 49.08, lng: 104.04, altitude: 50 },
      { lat: 49.08, lng: 104.14, altitude: 50 },
      { lat: 48.98, lng: 104.14, altitude: 50 },
      { lat: 48.98, lng: 104.04, altitude: 50 },
      { lat: 49.08, lng: 104.04, altitude: 50 }
    ],
    properties: {
      owner: 'Эрдэнэт Үйлдвэр ТӨҮГ',
      status: 'Идэвхтэй олборлолт ба баяжуулалт',
      resource: 'Зэс, Молибден',
      areaSqKm: 110,
      description: 'Азийн хамгийн том ил уурхай ба баяжуулах үйлдвэрүүдийн нэг. Орхон аймаг дахь аж үйлдвэрийн гол цөм.'
    }
  },
  {
    id: 'mining_tsagaan_suvarga',
    name: 'Цагаан Суварга Зэсийн Ордын Ашиглалтын Лиценз',
    type: 'mining',
    coordinates: [
      { lat: 44.27, lng: 109.62, altitude: 45 },
      { lat: 44.27, lng: 109.72, altitude: 45 },
      { lat: 44.17, lng: 109.72, altitude: 45 },
      { lat: 44.17, lng: 109.62, altitude: 45 },
      { lat: 44.27, lng: 109.62, altitude: 45 }
    ],
    properties: {
      owner: 'МАК ХХК (Монголын Алт Корпораци)',
      status: 'Дэд бүтэц угсралт ба бүтээн байгуулалт',
      resource: 'Зэс-порфир',
      areaSqKm: 85,
      description: 'Дорноговь аймгийн нутагт шинээр хэрэгжиж буй зэс, молибдений том орд. Мега үйлдвэр барих ажил явагдаж байна.'
    }
  },
  {
    id: 'mining_baganuur',
    name: 'Багануур Нүүрсний Хормойт Ил Уурхайн Талбай',
    type: 'mining',
    coordinates: [
      { lat: 47.83, lng: 108.33, altitude: 40 },
      { lat: 47.83, lng: 108.43, altitude: 40 },
      { lat: 47.73, lng: 108.43, altitude: 40 },
      { lat: 47.73, lng: 108.33, altitude: 40 },
      { lat: 47.83, lng: 108.33, altitude: 40 }
    ],
    properties: {
      owner: 'Багануур ХК',
      status: 'Идэвхтэй олборлолт',
      resource: 'Хүрэн нүүрс',
      areaSqKm: 135,
      description: 'Улаанбаатар хот ба төвийн бүсийн цахилгаан станцуудыг нүүрсээр тасралтгүй хангадаг стратегийн гол ил уурхай.'
    }
  },
  {
    id: 'mining_khushuut',
    name: 'Хөшөөт Нүүрсний Ордын Ашиглалтын Лиценз (Баруун бүс)',
    type: 'mining',
    coordinates: [
      { lat: 46.17, lng: 92.40, altitude: 45 },
      { lat: 46.17, lng: 92.50, altitude: 45 },
      { lat: 46.07, lng: 92.50, altitude: 45 },
      { lat: 46.07, lng: 92.40, altitude: 45 },
      { lat: 46.17, lng: 92.40, altitude: 45 }
    ],
    properties: {
      owner: 'Моннис Групп / МоЭнКо ХХК',
      status: 'Идэвхтэй нүүрс олборлолт ба экспорт',
      resource: 'Коксжих өндөр чанартай нүүрс',
      areaSqKm: 60,
      description: 'Ховд аймгийн Дарви суманд байрлах нүүрсний орд. Баруун бүсийн эдийн засгийн маш чухал хөдөлгүүр.'
    }
  },

  // =================== ХАЙГУУЛЫН ТАЛБАЙ (EXPLORATION - BLUE TRANSLUCENT) ===================
  {
    id: 'explore_bayan_gobi',
    name: 'Баян Говь Хайгуулын Тусгай Зөвшөөрөл (Маргаантай)',
    type: 'exploration',
    coordinates: [
      { lat: 43.48, lng: 104.10, altitude: 15 },
      { lat: 43.48, lng: 104.38, altitude: 15 },
      { lat: 43.25, lng: 104.38, altitude: 15 },
      { lat: 43.25, lng: 104.10, altitude: 15 },
      { lat: 43.48, lng: 104.10, altitude: 15 }
    ],
    properties: {
      owner: 'Саутгоби Сэндс ХХК',
      status: 'Байгаль орчны маргаантай / Түр зогссон',
      resource: 'Чулуун нүүрсний илрэл',
      areaSqKm: 120,
      description: 'Говь Гурвансайхан байгалийн цогцолборт газрын экосистем болон усан хангамжийн бүстэй хэсэгчлэн давхцсан тул маргаантай байгаа.'
    }
  },
  {
    id: 'explore_bor_uul',
    name: 'Бор Уул Алт-Зэсийн Хайгуулын Бүс',
    type: 'exploration',
    coordinates: [
      { lat: 43.90, lng: 106.20, altitude: 15 },
      { lat: 43.90, lng: 106.50, altitude: 15 },
      { lat: 43.72, lng: 106.50, altitude: 15 },
      { lat: 43.72, lng: 106.20, altitude: 15 },
      { lat: 43.90, lng: 106.20, altitude: 15 }
    ],
    properties: {
      owner: 'Эрдэнэ Ресурс Девелопмент ХХК',
      status: 'Гүнзгийрүүлсэн нарийвчилсан хайгуул',
      resource: 'Зэс, Порфирын алт',
      areaSqKm: 95,
      description: 'Анимейшн бүхий сканердах эффектээр дүрслэгдсэн, шинээр нээгдсэн алт ба зэсийн илрэл бүхий хайгуулын ирээдүйтэй талбай.'
    }
  },
  {
    id: 'explore_asgat_silver',
    name: 'Асгат Мөнгөний Ордны Хайлтын Бүс (Алтай Алс Хязгаар)',
    type: 'exploration',
    coordinates: [
      { lat: 50.20, lng: 89.70, altitude: 20 },
      { lat: 50.20, lng: 89.80, altitude: 20 },
      { lat: 50.10, lng: 89.80, altitude: 20 },
      { lat: 50.10, lng: 89.70, altitude: 20 },
      { lat: 50.20, lng: 89.70, altitude: 20 }
    ],
    properties: {
      owner: 'Эрдэнэс Монгол ХК / Эрдэнэс Силвер',
      status: 'Эхний шатны нөөц тогтоох хайгуулын ажил',
      resource: 'Мөнгө, Холимог металл',
      areaSqKm: 50,
      description: 'Баян-Өлгий аймгийн өндөр уулын хүнд нөхцөл дэх мөнгөний асар том ирээдүйтэй хайгуулын бүс.'
    }
  },
  {
    id: 'explore_dornod_uranium',
    name: 'Дорнод Ураны Судлын Хайгуулын Сав Газар',
    type: 'exploration',
    coordinates: [
      { lat: 48.20, lng: 114.47, altitude: 22 },
      { lat: 48.20, lng: 114.57, altitude: 22 },
      { lat: 48.10, lng: 114.57, altitude: 22 },
      { lat: 48.10, lng: 114.47, altitude: 22 },
      { lat: 48.20, lng: 114.47, altitude: 22 }
    ],
    properties: {
      owner: 'Бадрах Энержи ХХК (Мон-Атом/Орано)',
      status: 'Нарийвчилсан хайгуул ба өрөмдлөг',
      resource: 'Уран, Ховор металл',
      areaSqKm: 140,
      description: 'Монгол Улсын зүүн бүс нутаг дахь ураны томоохон хайгуулын талбай бөгөөд хөрсний уусгах технологийг судалж буй зурвас.'
    }
  },
  {
    id: 'explore_zaamar_gold',
    name: 'Заамар Алтны Шороон ба Үндсэн Ордын Хайгуулын Нарийвчилсан Зурвас',
    type: 'exploration',
    coordinates: [
      { lat: 48.27, lng: 104.28, altitude: 15 },
      { lat: 48.27, lng: 104.38, altitude: 15 },
      { lat: 48.17, lng: 104.38, altitude: 15 },
      { lat: 48.17, lng: 104.28, altitude: 15 },
      { lat: 48.27, lng: 104.28, altitude: 15 }
    ],
    properties: {
      owner: 'Эрдэнэ Алт ХХК',
      status: 'Идэвхтэй гүн өрөмдлөгийн шат',
      resource: 'Шороон болон үндсэн алт',
      areaSqKm: 45,
      description: 'Туул голын савд олон жил олборлогдсон бүстэй уялдан шинээр үндсэн чулуулгийн алтны судал илрүүлэх хайгуулын хэсэг.'
    }
  },

  // =================== ОРДЫН НӨӨЦ (RESERVES - GOLD/ORANGE TOWERS) ===================
  // Visual Metaphor Rule: height = log(reserveValue) * Multiplier
  {
    id: 'reserve_oyu_tolgoi',
    name: 'Оюу Толгой Зэс-Алтны Гүн дэх Нөөцийн Цамхаг (High)',
    type: 'reserves',
    coordinates: [
      { lat: 43.011, lng: 106.844 }
    ],
    properties: {
      owner: 'Рио Тинто / Оюу Толгой ХХК',
      status: 'Гүний ордын нөөц өндөр ангилал',
      resource: 'Баталгаат зэсийн нөөц',
      reserveValue: 45000000000, // Large (45 billion tons ore potential equivalent)
      reserveGrade: 'High',
      description: 'Өндөр зэрэглэлийн хүдрийн асар том гүний нөөцийн хэмжээс. Манай 3D системд гэрэлтсэн Урт Алтлаг Цамхгаар дүрслэгдэв (High).'
    }
  },
  {
    id: 'reserve_tavan_tolgoi',
    name: 'Таван Толгой Коксжих Нүүрсний Нөөцийн Цамхаг (High)',
    type: 'reserves',
    coordinates: [
      { lat: 43.626, lng: 105.478 }
    ],
    properties: {
      owner: 'Эрдэнэс Тавантолгой ХК',
      status: 'Баталгаат нүүрсний нөөц',
      resource: 'Баяжуулсан коксжих нүүрс',
      reserveValue: 6400000000,
      reserveGrade: 'High',
      description: 'Аж үйлдвэрийн нүүрсний коксжих өндөр чанартай нөөцийн хэмжээ. Системд Гэрэлтсэн Урт Шар-Алтлаг Цамхгаар харуулав.'
    }
  },
  {
    id: 'reserve_nariin_sukhait',
    name: 'Нарийн Сухайт Нүүрсний Нөөцийн Цамхаг (Medium)',
    type: 'reserves',
    coordinates: [
      { lat: 43.005, lng: 101.250 }
    ],
    properties: {
      owner: 'МАК ХХК / Өсөх Зоос ХХК',
      status: 'Үйл ажиллагаа тогтвортой',
      resource: 'Чулуун нүүрсний нөөц',
      reserveValue: 380000000,
      reserveGrade: 'Medium',
      description: 'Дунд зэрэглэлийн нөөцийн хэмжээтэй нүүрсний орд. Метафор дүрмээр дунд хэмжээний 3D алтлаг цамхаг хэлбэрээр тэмдэглэв.'
    }
  },
  {
    id: 'reserve_oyut_ulaan',
    name: 'Оюут Улаан Зэсийн Илрэлийн Нөөцийн Цамхаг (Low)',
    type: 'reserves',
    coordinates: [
      { lat: 43.321, lng: 104.256 }
    ],
    properties: {
      owner: 'Саутгоби Энержи ХХК',
      status: 'Бага зэрэглэлийн илрэл',
      resource: 'Зэс-порфир илрэм',
      reserveValue: 25000000,
      reserveGrade: 'Low',
      description: 'Эхний шатны бага хэмжээний нөөцийн илрэл. Жижиг хавтгай 3D метафор хэлбэрээр дүрслэв.'
    }
  },
  {
    id: 'reserve_erdenet',
    name: 'Эрдэнэт Овоо Мега Зэс-Молибдений Нөөцийн Цамхаг (High)',
    type: 'reserves',
    coordinates: [
      { lat: 49.030, lng: 104.090 }
    ],
    properties: {
      owner: 'Монгол Улсын Засгийн газар',
      status: 'Үр ашиг үргэлжилж байна',
      resource: 'Маш өндөр зэсийн агууламж',
      reserveValue: 17200000000, // 17.2 Billion tons
      reserveGrade: 'High',
      description: 'Дэлхийд данстай зэс молибдений томоохон баталгаат нөөцийн хэмжээ. Системд гэрэлтсэн өндөр гэрэлт цамхгаар харуулав.'
    }
  },
  {
    id: 'reserve_tsagaan_suvarga',
    name: 'Цагаан Суварга Зэс-Молибдений Нөөцийн Цамхаг (Medium)',
    type: 'reserves',
    coordinates: [
      { lat: 44.220, lng: 109.670 }
    ],
    properties: {
      owner: 'МАК ХХК',
      status: 'Байгуулалтын шатны нөөц',
      resource: 'Зэсийн жинтэй хүдэр',
      reserveValue: 250000000,
      reserveGrade: 'Medium',
      description: 'Судалгаагаар тогтоогдсон баялаг нөөцийн хэмжээ. Системд дунд хэмжээний улбар шар цамхагтай.'
    }
  },
  {
    id: 'reserve_khushuut',
    name: 'Хөшөөт Баруун Бүсийн Нүүрсний Нөөцийн Цамхаг (Medium)',
    type: 'reserves',
    coordinates: [
      { lat: 46.120, lng: 92.450 }
    ],
    properties: {
      owner: 'МоЭнКо ХХК',
      status: 'Чанарын өндөр үзүүлэлт',
      resource: 'Антрацит коксжих нүүрс',
      reserveValue: 480000000,
      reserveGrade: 'Medium',
      description: 'Баруун бүсийн уулархаг хэсэг дэх коксжих нүүрсний өндөр агууламжтай дунд орд.'
    }
  },
  {
    id: 'reserve_baganuur',
    name: 'Багануур Улаанбаатар Тэжээх Нүүрсний Мега Нөөц (High)',
    type: 'reserves',
    coordinates: [
      { lat: 47.780, lng: 108.380 }
    ],
    properties: {
      owner: 'Багануур ХК',
      status: 'Цахилгаан дулааны уур хүч',
      resource: 'Хүрэн нүүрсний өргөн сав',
      reserveValue: 8120000000,
      reserveGrade: 'High',
      description: 'Улаанбаатарын цахилгаан станцуудын хэрэглээг даах 100 гаруй жилийн нөөц бүхий гэрэлтсэн өндөр цамхаг.'
    }
  },
  {
    id: 'reserve_asgat',
    name: 'Асгат Холимог Металл ба Мөнгөний Нөөцийн Цамхаг (Low)',
    type: 'reserves',
    coordinates: [
      { lat: 50.150, lng: 89.750 }
    ],
    properties: {
      owner: 'Эрдэнэс Силвер ХК',
      status: 'Түр зогссон/Баталгаажсан илрэл',
      resource: 'Нөөцийн мөнгө ба зэс',
      reserveValue: 25000000,
      reserveGrade: 'Low',
      description: 'Алтай таван богдын алс өндөрлөг дэх мөнгөний нөөцийн эх үүсвэрийг тэмдэглэсэн жижиг хавтгай цамхаг.'
    }
  },
  {
    id: 'reserve_dornod_uran',
    name: 'Дорнод Уран ба Ховор Элементийн Стратегийн Нөөц (Medium)',
    type: 'reserves',
    coordinates: [
      { lat: 48.150, lng: 114.520 }
    ],
    properties: {
      owner: 'Бадрах Энержи',
      status: 'Мэргэжлийн хяналтын ангилал',
      resource: 'Ураны исэл (U3O8)',
      reserveValue: 138000000,
      reserveGrade: 'Medium',
      description: 'Зүүн бүсийн стратегийн хамгийн том ураны ордуудын нэг бөгөөд дундаж зэрэглэлийн шар цамхгаар харуулав.'
    }
  },

  // =================== ТУСГАЙ ХАМГААЛАЛТТАЙ БҮС (PROTECTED - GREEN) ===================
  {
    id: 'protected_gurvansaikhan',
    name: 'Говь Гурвансайхан Байгалийн Цогцолборт Газар',
    type: 'protected',
    coordinates: [
      { lat: 44.15, lng: 103.10, altitude: 100 },
      { lat: 44.15, lng: 104.30, altitude: 100 },
      { lat: 43.20, lng: 104.30, altitude: 100 },
      { lat: 43.20, lng: 103.10, altitude: 100 },
      { lat: 44.15, lng: 103.10, altitude: 100 }
    ],
    properties: {
      status: 'Улсын Тусгай Хамгаалалттай Газар (Ангилал II)',
      level: 'Үндэсний хэмжээний дархан цаазат болон байгалийн нөөц',
      areaSqKm: 27000,
      description: 'Ёлын амны мөсөн хавцал, Хонгорын элс, ургамал амьтны ховор төрөл зүйлийг хамгаалж буй тусгай хамгаалалттай бүс.'
    }
  },
  {
    id: 'protected_gobi_restricted',
    name: 'Өмнөд Говийн Хилийн Зурвас Зэрлэг Амьтны Нарийн Коридор',
    type: 'protected',
    coordinates: [
      { lat: 43.10, lng: 105.00, altitude: 100 },
      { lat: 43.10, lng: 105.80, altitude: 100 },
      { lat: 42.60, lng: 105.80, altitude: 100 },
      { lat: 42.60, lng: 105.00, altitude: 100 },
      { lat: 43.10, lng: 105.00, altitude: 100 }
    ],
    properties: {
      status: 'Хилийн онцгой дэглэмт хамгаалалтын бүс',
      level: 'А ангиллын шилжилт хөдөлгөөний бүс',
      areaSqKm: 8500,
      description: 'Хулан, Аргал, Хар сүүлт зэрэг нүүдлийн ховор амьтдын улс дамнасан шилжилтийг уул уурхайн нөлөөллөөс хамгаална.'
    }
  },

  // =================== КОМПАНИ / ОБЪЕКТ (COMPANY - ORANGE POINTS) ===================
  {
    id: 'asset_tavan_tolgoi_camp',
    name: 'Таван Толгой Олборлох Штаб ба Барилгууд',
    type: 'company',
    coordinates: [{ lat: 43.626, lng: 105.478, altitude: 30 }],
    properties: {
      owner: 'Эрдэнэс Тавантолгой ХК',
      status: 'Олборлолт тээврийн удирдлагын төв',
      description: 'Уурхайчдын кемп, удирдлагын штаб ба хүнд даацын машины урсгалыг чиглүүлэх зангилаа обьект.'
    }
  },
  {
    id: 'asset_tsogt_tsetsii',
    name: 'Цогтцэций Салхин Цахилгаан Станц ба Сүлжээний Станц',
    type: 'company',
    coordinates: [{ lat: 43.725, lng: 105.570, altitude: 30 }],
    properties: {
      owner: 'Ньюком Групп / Цэций Станц',
      status: 'Идэвхтэй ажиллаж байна',
      description: 'Өмнөд говийн аж үйлдвэрийн бүсийг сэргээгдэх цэвэр эрчим хүчээр хангадаг салхин паркийн дэд станц.'
    }
  },
  {
    id: 'asset_erdenet_factory',
    name: 'Эрдэнэт Овоо Баяжуулах Мега Үйлдвэр',
    type: 'company',
    coordinates: [{ lat: 49.030, lng: 104.090, altitude: 35 }],
    properties: {
      owner: 'Эрдэнэт Үйлдвэр ТӨҮГ',
      status: 'Хүдэр боловсруулах дээд технологи',
      description: 'Олон тоннын багтаамжтай флотаци, бутлах цехүүд ба Монгол улсыг тэжээгч аж үйлдвэрийн мега байгууламж комплекс.'
    }
  },
  {
    id: 'asset_baganuur_hq',
    name: 'Багануур Уурхайн Ерөнхий Удирдлагын Штаб',
    type: 'company',
    coordinates: [{ lat: 47.780, lng: 108.380, altitude: 30 }],
    properties: {
      owner: 'Багануур ХК',
      status: 'Удирдлага, зохион байгуулах төв',
      description: 'Нүүрс олборлох, төмөр зам тээвэрлэлтийн шуурхай удирдлага ба диспетчерийн голлох зангилаа уурхайн кемп.'
    }
  },

  // =================== АЙМАГ, СУМЫН ХИЛ (ADMIN - GREY BOUNDARIES) ===================
  {
    id: 'admin_omnogovi',
    name: 'Өмнөговь Аймгийн Байгаль Орчны Хяналтын Хил зурвас',
    type: 'admin',
    coordinates: [
      { lat: 44.60, lng: 102.60, altitude: 5 },
      { lat: 44.60, lng: 108.40, altitude: 5 },
      { lat: 42.40, lng: 108.40, altitude: 5 },
      { lat: 42.40, lng: 102.60, altitude: 5 },
      { lat: 44.60, lng: 102.60, altitude: 5 }
    ],
    properties: {
      description: 'Аж үйлдвэрийн экологид үзүүлэх нөлөөллийг байгаль орчны нормын дагуу хянах засаг захиргааны хяналтын полигон хил.'
    }
  },

  // =================== ЗАМЫН СҮЛЖЭЭ (ROAD - SLATE/GREY LINES) ===================
  {
    id: 'road_coal_highway',
    name: 'Таван Толгойгоос Гашуунсухайт Авто Зам (Тээврийн Гол Коридор)',
    type: 'road',
    coordinates: [
      { lat: 43.626, lng: 105.478, altitude: 8 },
      { lat: 43.320, lng: 105.900, altitude: 8 },
      { lat: 42.920, lng: 106.300, altitude: 8 },
      { lat: 42.580, lng: 106.720, altitude: 8 }
    ],
    properties: {
      status: 'Идэвхтэй урсгалтай хүнд тээврийн засмал зам',
      description: 'Хүнд даацын нүүрс тээврийн авто тээврийн зангилаа коридор.'
    }
  },
  {
    id: 'road_trans_mongolian_railway',
    name: 'Улаанбаатар-Эрдэнэт Олборлолтын Стратеги Төмөр Зам',
    type: 'road',
    coordinates: [
      { lat: 47.92, lng: 106.91, altitude: 10 },
      { lat: 48.33, lng: 106.12, altitude: 10 },
      { lat: 48.88, lng: 105.15, altitude: 10 },
      { lat: 49.03, lng: 104.09, altitude: 10 }
    ],
    properties: {
      status: 'Ачаалал ихтэй олборлолтын хүнд төмөр зам',
      description: 'Улаанбаатар хотоос Эрдэнэт овоо хүдрийн орд хүртэлх болон олон улс дамжсан төмөр замын стратегийн амин чухал сүлжээ хэсэг.'
    }
  },

  // =================== БАЙГАЛЬ ОРЧНЫ ЭРСДЭЛ ОВЕРЛУЙ (RISK / OVERLAP - FLASHING RED) ===================
  {
    id: 'overlap_bayan_gobi_vs_gurvansaikhan',
    name: 'Зөрчилт Бүс А: Баян Говь Хайгуулын Лецинз vs Говь Гурвансайхан ТХГ',
    type: 'risk',
    coordinates: [
      { lat: 43.48, lng: 104.10, altitude: 120 },
      { lat: 43.48, lng: 104.30, altitude: 120 },
      { lat: 43.25, lng: 104.30, altitude: 120 },
      { lat: 43.25, lng: 104.10, altitude: 120 },
      { lat: 43.48, lng: 104.10, altitude: 120 }
    ],
    properties: {
      riskStatus: 'ӨНДӨР ЭРСДЭЛТЭЙ / ХУУЛИЙН ХОРИГ ЗӨРЧИГДСӨН',
      description: 'БАЙГАЛЬ ОРЧНЫ НОЦТОЙ ЗӨРЧИЛ. Баян Говийн хайгуулын зөвшөөрөл нь Улсын Хамгаалалттай Говь Гурвансайхан цогцолбор газрын А зэрэглэлийн хамгаалалтын нутаг дэвсгэрт 580 кв.км давхцан нөлөөлж байна.'
    }
  },
  {
    id: 'overlap_oyu_tolgoi_vs_galba_uul',
    name: 'Зөрчилт Бүс Б: Оюу Толгой Уурхай vs Галба-Уулын Газрын Доорх Усны Сав',
    type: 'risk',
    coordinates: [
      { lat: 43.12, lng: 106.75, altitude: 120 },
      { lat: 43.12, lng: 106.95, altitude: 120 },
      { lat: 42.92, lng: 106.95, altitude: 120 },
      { lat: 42.92, lng: 106.75, altitude: 120 },
      { lat: 43.12, lng: 106.75, altitude: 120 }
    ],
    properties: {
      riskStatus: 'УСНЫ ГИДРОЛОГИЙН СҮҮДЭРТ НӨЛӨӨЛӨЛ',
      description: 'МЭДРЭМТГИЙ ЭКОСИСТЕМИЙН ЭРСДЭЛ. Оюу Толгойн уурхайн ашиглалтын үндсэн зурвас Галба-Уул гүний усны эмзэг голдиролд бүрэн оршдог. Уурхайн усан хангамж гүний усыг ширгээх, зэрлэг ан амьтны ундаалах худгийг гэмтээх өндөр эрсдэлтэй.'
    }
  },
  {
    id: 'overlap_zaamar_vs_selenge',
    name: 'Зөрчилт Бүс В: Заамар Туул-Алтны Олборлолт vs Сэлэнгэ Сав Усны Эрсдэл',
    type: 'risk',
    coordinates: [
      { lat: 48.27, lng: 104.28, altitude: 120 },
      { lat: 48.27, lng: 104.38, altitude: 120 },
      { lat: 48.17, lng: 104.38, altitude: 120 },
      { lat: 48.17, lng: 104.28, altitude: 120 },
      { lat: 48.27, lng: 104.28, altitude: 120 }
    ],
    properties: {
      riskStatus: 'УСНЫ БОХИРДОЛ БА ЭЛСЭЛТИЙН МЕГА АЮУЛ',
      description: 'МЭДРЭМТГИЙ ГИДРО-ЗӨРЧИЛ. Заамар дахь шороон алт угаах уул уурхайн идэвхтэй урсгал Туул голоор дамжин Сэлэнгэ мөрний цэнгэг усны экосистемийг бохирдуулах, лаг шавраар дүүргэх ноцтой заналхийлэл үүсгээд буй тул хамгийн их хяналт шаардлагатай.'
    }
  },
  {
    id: 'overlap_erdenet_vs_selenge',
    name: 'Зөрчилт Бүс Г: Эрдэнэт Тулгын Сүүл Хаягдлын Нуур vs Орхон голын Сав',
    type: 'risk',
    coordinates: [
      { lat: 49.10, lng: 104.04, altitude: 125 },
      { lat: 49.10, lng: 104.14, altitude: 125 },
      { lat: 48.96, lng: 104.14, altitude: 125 },
      { lat: 48.96, lng: 104.04, altitude: 125 },
      { lat: 49.10, lng: 104.04, altitude: 125 }
    ],
    properties: {
      riskStatus: 'АЖ ҮЙЛДВЭРИЙН ХИМИЙН ХОЛИМОГ НӨЛӨӨЛӨЛ',
      description: 'АКУИФЕРИЙН НООГДОЛ ЭРСДЭЛ. Эрдэнэтийн баяжуулах үйлдвэрийн асар том сүүл хаягдлын хиймэл нуур Орхон-Сэлэнгийн усан сав газрын хил бүст шууд ойрхон орших тул гүний усанд хүнд металлын шүүрэл орох, хөрсний уусмал тархах өндөр эрсдэлтэй бөгөөд анимейшн лугшилтаар хянагдаж байна.'
    }
  }
];

export function getOverlapZones() {
  return GEOSPATIAL_FEATURES.filter(f => f.type === 'risk');
}

export function filterFeatures(query: string): GeoFeature[] {
  const norm = query.toLowerCase();
  return GEOSPATIAL_FEATURES.filter(
    f => f.name.toLowerCase().includes(norm) ||
         f.id.toLowerCase().includes(norm) ||
         f.properties.description.toLowerCase().includes(norm) ||
         (f.properties.owner && f.properties.owner.toLowerCase().includes(norm)) ||
         f.type.toLowerCase().includes(norm)
  );
}

export function checkFrictionOverlaps(): string[] {
  return [
    'Баян Говийн нүүрсний өрөмдлөгийн бүс Говь Гурвансайхан байгалийн цогцолборт газарт давхцан орсон.',
    'Оюу Толгойн баяжуулалтын ус суваг Галба-Уулын гүний эртний усан сав газрыг ундаалж буй булгуудтай давхцсан.'
  ];
}
