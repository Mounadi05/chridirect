// Theme Configuration for ChriDirect - Moroccan COD E-Commerce Platform
export const themeConfig = {
  brand: {
    name: 'ChriDirect',
    tagline: 'Boutique en Ligne Confiance au Maroc',
    logo: '/logo.png',
  },
  colors: {
    primary: '#1A3B6E',   // Deep Navy Blue (logo "Chri" color)
    accent: '#C8920A',    // Rich Gold/Amber (logo "Direct" color)
    trust: '#005C2F',     // Moroccan Green (logo star color)
    background: '#F4F6FA', // Light blue-white (clean page background)
    foreground: '#1A3B6E',
    white: '#FFFFFF',
    lightGray: '#F4F6FA',
  },
  navigation: {
    items: [
      { label: 'الصفحة الرئيسية', href: '/', labelFr: 'Accueil' },
      // { label: 'التصنيفات', href: '/categories', labelFr: 'Catégories' },
      // { label: 'اتصل بنا', href: '/contact', labelFr: 'Contactez-nous' },
    ],
  },
  cart: {
    currency: 'MAD',
    symbol: 'د.م.',
  },
  // Products are now stored in the database (store_products table).
  // Manage them via /admin. This array is kept empty — do not add fake data here.
  hero: {
    heading: 'تسوق الآن',
    subheading: 'استمتع بتخفيضات حصرية',
    headingFr: 'Achetez Maintenant',
    subheadingFr: 'Profitez de réductions exclusives',
  },
  form: {
    nameLabel: 'الاسم / Nom',
    phoneLabelAr: 'الهاتف',
    phoneLabelFr: 'Telephone',
    cityLabelAr: 'المدينة',
    cityLabelFr: 'la ville',
    submitButton: 'اضغط هنا للطلب',
    submitButtonFr: 'Cliquez ici pour commander',
    placeholders: {
      name: 'أدخل اسمك',
      phone: '+212 6XX XXX XXX',
      city: 'اختر مدينتك',
    },
  },
  socialProof: {
    viewersText: 'يشاهد المكون',
    viewersTextFr: 'regarder le composant',
    browsersText: 'متصفح في الوقت الحالي',
    currentViewers: 56,
  },
  heroCarouselImages: [
    {
      url: '/cover.png',
      heading: 'تسوق الآن',
      subheading: 'استمتع بتخفيضات حصرية',
    },
  ],
}
