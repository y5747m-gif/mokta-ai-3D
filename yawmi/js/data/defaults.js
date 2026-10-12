/* ============================================================
 * defaults.js — البيانات الافتراضية: الجدول الأسبوعي الكامل
 * (مواعيد الطالب الأصلية — لا تُغيَّر بصمت أبدًا)، المواد،
 * العادات، المنبهات، والإعدادات.
 * ============================================================ */

/** المواد الدراسية للقسم الأدبي — الصف الثاني الثانوي الأزهري */
export const DEFAULT_SUBJECTS = [
  { key: 'religious', nameAr: 'شرعي', nameEn: 'Religious Studies', color: 'var(--c-lesson)', icon: '🕌', priority: 'high', teacher: '', notes: 'الدروس الشرعية والحفظ والمراجعة.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'arabic', nameAr: 'اللغة العربية', nameEn: 'Arabic', color: 'var(--c-study)', icon: '📖', priority: 'high', teacher: '', notes: 'النحو والبلاغة والأدب والقراءة.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'english', nameAr: 'اللغة الإنجليزية', nameEn: 'English', color: 'var(--c-travel)', icon: '🌍', priority: 'high', teacher: '', notes: 'Grammar, vocabulary, reading, and writing.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'french', nameAr: 'اللغة الفرنسية', nameEn: 'French', color: 'var(--c-personal)', icon: '🇫🇷', priority: 'medium', teacher: '', notes: 'المفردات والقواعد والمحادثة.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'philosophy', nameAr: 'الفلسفة', nameEn: 'Philosophy', color: 'var(--c-homework)', icon: '💭', priority: 'high', teacher: '', notes: 'المباحث الفلسفية والمنطق.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'geography', nameAr: 'الجغرافيا', nameEn: 'Geography', color: 'var(--c-exercise)', icon: '🗺️', priority: 'medium', teacher: '', notes: 'الجغرافيا الطبيعية والبشرية والخرائط.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
  { key: 'history', nameAr: 'التاريخ', nameEn: 'History', color: 'var(--c-meal)', icon: '🏛️', priority: 'medium', teacher: '', notes: 'الأحداث والتواريخ والشخصيات التاريخية.', weakTopics: [], progress: 0, completedLessons: 0, archived: false },
];

/** إعدادات التطبيق الافتراضية */
export const DEFAULT_SETTINGS = {
  profile: {
    name: 'الطالب',
    grade: 'الصف الثاني الثانوي',
    system: 'الأزهري',
    section: 'القسم الأدبي',
    lang: 'ar',
  },
  theme: 'light',
  wakeTime: '07:00',
  windDownTime: '21:00',
  bedTime: '22:00',
  latestBedTime: '22:30',
  exerciseMinutes: 30,
  studyMinutes: 50,
  breakMinutes: 10,
  longBreakMinutes: 25,
  sessionsUntilLongBreak: 4,
  shortSessionMinutes: 25,
  snoozeMinutes: 10,
  snoozeEnabled: true,
  transitionMinutes: 0,          // وقت التنقل بين درسين متتاليين
  lessonTravelMinutes: 45,       // مدة السفر الافتراضية قبل الدرس
  reminderOffsets: [60, 30, 15, 0],
  travelReminder: true,
  quietHoursStart: '22:30',
  quietHoursEnd: '06:30',
  quietHoursEnabled: true,
  soundEnabled: true,
  soundName: 'gentle',
  vibrate: true,
  revisionIntervals: [0, 1, 3, 7],
  weekStartsSaturday: true,
  notificationsFrequency: 'normal', // low | normal | high
  wakeLockOnAlarm: true,
  keepAwakeBeforeWakeAlarm: false,
  version: 1,
};

/** العادات اليومية */
export const DEFAULT_HABITS = [
  { id: 'hab-exercise', nameAr: 'الرياضة الصباحية', nameEn: 'Morning exercise', icon: '🏃', goal: 1, unit: 'مرة' },
  { id: 'hab-water', nameAr: 'شرب الماء', nameEn: 'Drink water', icon: '💧', goal: 8, unit: 'أكواب' },
  { id: 'hab-sessions', nameAr: 'إكمال جلسات المذاكرة', nameEn: 'Study sessions', icon: '📚', goal: 3, unit: 'جلسات' },
  { id: 'hab-review', nameAr: 'مراجعة الدروس', nameEn: 'Review lessons', icon: '🔁', goal: 1, unit: 'مرة' },
  { id: 'hab-desk', nameAr: 'ترتيب المكتب', nameEn: 'Tidy desk', icon: '🗄️', goal: 1, unit: 'مرة' },
  { id: 'hab-tomorrow', nameAr: 'الاستعداد للغد', nameEn: 'Prepare for tomorrow', icon: '🎒', goal: 1, unit: 'مرة' },
  { id: 'hab-sleep', nameAr: 'النوم في موعده', nameEn: 'Sleep on time', icon: '😴', goal: 1, unit: 'مرة' },
];

/** فئات المنبهات */
export const ALARM_CATEGORIES = {
  wake: { ar: 'منبه الاستيقاظ', en: 'Wake-up', icon: '⏰' },
  exercise: { ar: 'تذكير الرياضة', en: 'Exercise', icon: '🏃' },
  study: { ar: 'تذكير المذاكرة', en: 'Study', icon: '📚' },
  lesson: { ar: 'تذكير الدرس', en: 'Lesson', icon: '🕌' },
  travel: { ar: 'تذكير السفر', en: 'Travel', icon: '🚗' },
  homework: { ar: 'موعد الواجب', en: 'Homework', icon: '📝' },
  revision: { ar: 'تذكير المراجعة', en: 'Revision', icon: '🔁' },
  meal: { ar: 'تذكير الوجبات', en: 'Meals', icon: '🍽️' },
  sleep: { ar: 'الاستعداد للنوم', en: 'Sleep', icon: '🌙' },
  custom: { ar: 'منبه مخصص', en: 'Custom', icon: '🔔' },
};

/** أنواع الفعاليات */
export const EVENT_TYPES = {
  lesson: { ar: 'درس', en: 'Lesson', icon: '🕌' },
  study: { ar: 'مذاكرة', en: 'Study', icon: '📚' },
  homework: { ar: 'واجب', en: 'Homework', icon: '📝' },
  break: { ar: 'استراحة', en: 'Break', icon: '☕' },
  exercise: { ar: 'رياضة', en: 'Exercise', icon: '🏃' },
  meal: { ar: 'وجبة', en: 'Meal', icon: '🍽️' },
  sleep: { ar: 'نوم', en: 'Sleep', icon: '🌙' },
  personal: { ar: 'شخصي', en: 'Personal', icon: '💜' },
  travel: { ar: 'سفر وتنقل', en: 'Travel', icon: '🚗' },
  free: { ar: 'وقت حر', en: 'Free', icon: '🕊️' },
  custom: { ar: 'مخصص', en: 'Custom', icon: '📌' },
};

const ev = (title, type, start, end, extra = {}) => ({
  title, type, start, end,
  subject: null, notes: '', confirmed: true, optional: false,
  adjustable: false, enabled: true,
  ...extra,
});

/**
 * الجدول الأسبوعي الافتراضي — السبت إلى الجمعة
 * (يوم: 0=الأحد ... 6=السبت)
 */
export const DEFAULT_WEEK = {
  /* ================= السبت ================= */
  6: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45', { notes: 'روتين الاستيقاظ و30 دقيقة تمرين صباحي.' }),
    ev('الإفطار والاستعداد', 'meal', '07:45', '08:15'),
    ev('مذاكرة الفلسفة أو مادة أولوية', 'study', '08:15', '10:00', { subject: 'philosophy' }),
    ev('استراحة والتحضير للدرس', 'break', '10:00', '11:15'),
    ev('درس شرعي', 'lesson', '11:30', '12:15', { subject: 'religious', travelMinutes: 30 }),
    ev('استراحة قصيرة', 'break', '12:15', '12:30'),
    ev('لغة إنجليزية', 'lesson', '12:30', '14:00', { subject: 'english', notes: 'ينتهي الدرس تمامًا مع بداية درس الفلسفة — جدول متصل بدون فاصلة.', travelMinutes: 15 }),
    ev('فلسفة', 'lesson', '14:00', '17:00', { subject: 'philosophy', travelMinutes: 15 }),
    ev('الوجبة والراحة', 'meal', '17:00', '18:00'),
    ev('مراجعة الفلسفة والإنجليزية', 'study', '18:00', '19:00'),
    ev('العشاء ووقت شخصي', 'personal', '19:00', '20:00'),
    ev('الواجب أو مراجعة خفيفة', 'homework', '20:00', '21:00'),
    ev('الاسترخاء والاستعداد لأحد والنوم', 'sleep', '21:00', '22:30'),
  ],
  /* ================= الأحد ================= */
  0: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('مذاكرة مادة أولوية', 'study', '08:15', '10:00'),
    ev('استراحة', 'break', '10:00', '10:30'),
    ev('مراجعة وحل أسئلة', 'study', '10:30', '11:30'),
    ev('الوجبة والراحة', 'meal', '11:30', '12:30'),
    ev('مفردات وقواعد الفرنسية', 'study', '12:30', '13:30', { subject: 'french' }),
    ev('راحة واستعداد', 'break', '13:30', '14:30'),
    ev('السفر والتحضير للدرس', 'travel', '14:30', '15:30', { adjustable: true }),
    ev('لغة فرنسية', 'lesson', '15:30', '18:30', { subject: 'french', travelMinutes: 60 }),
    ev('العودة والعشاء والراحة', 'meal', '18:30', '19:30'),
    ev('مراجعة درس الفرنسية', 'study', '19:30', '20:15', { subject: 'french' }),
    ev('وقت شخصي', 'personal', '20:15', '21:00'),
    ev('الاستعداد لليوم التالي والنوم', 'sleep', '21:00', '22:30'),
  ],
  /* ================= الاثنين ================= */
  1: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('الجغرافيا أو مادة صعبة', 'study', '08:15', '10:00', { subject: 'geography' }),
    ev('استراحة', 'break', '10:00', '10:30'),
    ev('حل أسئلة ومراجعة', 'study', '10:30', '12:00'),
    ev('الغداء والراحة', 'meal', '12:00', '13:00'),
    ev('مذاكرة مادة أخرى', 'study', '13:00', '14:00'),
    ev('وقت حر', 'free', '14:00', '15:00'),
    ev('الاستعداد والسفر', 'travel', '15:00', '16:15', { adjustable: true }),
    ev('جغرافيا', 'lesson', '16:30', '18:30', { subject: 'geography', travelMinutes: 75 }),
    ev('العودة والعشاء والراحة', 'meal', '18:30', '19:30'),
    ev('تلخيص درس الجغرافيا', 'study', '19:30', '20:15', { subject: 'geography' }),
    ev('وقت شخصي', 'personal', '20:15', '21:00'),
    ev('الاسترخاء والنوم', 'sleep', '21:00', '22:30'),
  ],
  /* ================= الثلاثاء ================= */
  2: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('مذاكرة مادة أساسية', 'study', '08:15', '10:00'),
    ev('استراحة', 'break', '10:00', '10:30'),
    ev('مراجعة وحل أسئلة', 'study', '10:30', '11:30'),
    ev('وجبة خفيفة واستعداد', 'meal', '11:30', '12:15'),
    ev('درس شرعي', 'lesson', '12:30', '14:30', { subject: 'religious', travelMinutes: 30 }),
    ev('الغداء والراحة', 'meal', '14:30', '15:30'),
    ev('مذاكرة مادة أخرى', 'study', '15:30', '17:00'),
    ev('راحة أو نشاط خفيف', 'break', '17:00', '18:00'),
    ev('مراجعة الدرس الشرعي والواجب', 'homework', '18:00', '19:00', { subject: 'religious' }),
    ev('العشاء ووقت شخصي', 'personal', '19:00', '20:00'),
    ev('مراجعة خفيفة', 'study', '20:00', '21:00'),
    ev('الاسترخاء والنوم', 'sleep', '21:00', '22:30'),
  ],
  /* ================= الأربعاء ================= */
  3: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('مذاكرة مادة صعبة', 'study', '08:15', '10:00'),
    ev('استراحة', 'break', '10:00', '10:30'),
    ev('واجب وتدريب', 'homework', '10:30', '12:00'),
    ev('الغداء والراحة', 'meal', '12:00', '13:00'),
    ev('استعراض ومراجعة التاريخ', 'study', '13:00', '14:00', { subject: 'history' }),
    ev('الاستعداد والسفر', 'travel', '14:00', '15:15', { adjustable: true }),
    ev('تاريخ', 'lesson', '15:30', '18:30', { subject: 'history', travelMinutes: 75 }),
    ev('العشاء والراحة', 'meal', '18:30', '19:30'),
    ev('مراجعة الأحداث والتواريخ', 'study', '19:30', '20:15', { subject: 'history' }),
    ev('وقت شخصي', 'personal', '20:15', '21:00'),
    ev('الاستعداد للنوم', 'sleep', '21:00', '22:30'),
  ],
  /* ================= الخميس ================= */
  4: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('اللحاق بالمواد غير المنجزة', 'study', '08:15', '10:00'),
    ev('استراحة', 'break', '10:00', '10:30'),
    ev('اختبار تدريبي أسبوعي', 'study', '10:30', '12:00'),
    ev('الغداء والاستعداد', 'meal', '12:00', '12:45'),
    ev('درس شرعي اختياري', 'lesson', '13:00', '14:00', {
      subject: 'religious',
      optional: true,
      confirmed: false,
      enabled: false,
      notes: 'هذا الدرس غير مؤكد حتى يأكده الطالب — لا يُعامل كموعد مؤكد أبدًا.',
      altTitle: 'مذاكرة أو راحة (وقت بديل)',
      altType: 'study',
      travelMinutes: 20,
    }),
    ev('راحة', 'break', '14:00', '15:00'),
    ev('مراجعة مادة ضعيفة', 'study', '15:00', '16:30'),
    ev('رياضة أو هوايات أو خروج', 'exercise', '16:30', '18:00'),
    ev('العشاء والراحة', 'meal', '18:00', '19:00'),
    ev('إكمال الواجبات المتبقية', 'homework', '19:00', '20:00'),
    ev('وقت شخصي والاستعداد للنوم', 'sleep', '20:00', '22:30'),
  ],
  /* ================= الجمعة ================= */
  5: [
    ev('الاستيقاظ والرياضة', 'exercise', '07:00', '07:45'),
    ev('الإفطار', 'meal', '07:45', '08:15'),
    ev('مذاكرة اللغة العربية', 'study', '08:15', '09:45', { subject: 'arabic' }),
    ev('استراحة', 'break', '09:45', '10:15'),
    ev('مراجعة درس قديم', 'study', '10:15', '11:30'),
    ev('راحة واستعداد', 'break', '11:30', '12:15'),
    ev('وجبة خفيفة واستعداد', 'meal', '12:15', '13:00'),
    ev('لغة عربية', 'lesson', '13:30', '15:00', { subject: 'arabic', travelMinutes: 45 }),
    ev('الراحة والغداء إن لزم', 'meal', '15:00', '16:00'),
    ev('مراجعة العربية وإكمال الواجبات', 'study', '16:00', '17:00', { subject: 'arabic' }),
    ev('وقت العائلة أو الترفيه', 'personal', '17:00', '18:30'),
    ev('مراجعة أسبوعية خفيفة', 'study', '18:30', '19:30'),
    ev('وقت شخصي', 'personal', '19:30', '21:00'),
    ev('الاستعداد للسبت والنوم', 'sleep', '21:00', '22:30'),
  ],
};

/** المنبهات الافتراضية */
export const DEFAULT_ALARMS = [
  {
    id: 'al-wake', category: 'wake', title: 'المنبه الصباحي — استيقاظ ورياضة',
    message: 'صباح الخير! ابدأ يومك بالرياضة والاستيقاظ. 🌅',
    time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'gentle', vibrate: true, snoozeEnabled: true, snoozeMinutes: 10,
  },
  {
    id: 'al-exercise', category: 'exercise', title: 'وقت التمرين الصباحي',
    message: '30 دقيقة تمرين الآن ثم استعد للفطور.',
    time: '07:10', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'chime', vibrate: true, snoozeEnabled: true, snoozeMinutes: 5,
  },
  {
    id: 'al-breakfast', category: 'meal', title: 'الإفطار',
    message: 'وجبة الإفطار ثم الاستعداد للمذاكرة.',
    time: '07:45', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'chime', vibrate: false, snoozeEnabled: true, snoozeMinutes: 5,
  },
  {
    id: 'al-water-1', category: 'meal', title: 'شرب الماء 💧',
    message: 'تذكير هيدرتك: اشرب كوب ماء.',
    time: '11:00', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'chime', vibrate: false, snoozeEnabled: false, snoozeMinutes: 5,
  },
  {
    id: 'al-water-2', category: 'meal', title: 'شرب الماء 💧',
    message: 'تذكير هيدرتك: اشرب كوب ماء.',
    time: '16:00', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'chime', vibrate: false, snoozeEnabled: false, snoozeMinutes: 5,
  },
  {
    id: 'al-winddown', category: 'sleep', title: 'بدء الاستعداد للنوم',
    message: 'راجع جدول الغد، جهّز الكتب، وابدأ الاسترخاء. 🌙',
    time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'gentle', vibrate: true, snoozeEnabled: true, snoozeMinutes: 15,
  },
  {
    id: 'al-bed', category: 'sleep', title: 'ميعاد النوم',
    message: 'وقت النوم — النوم الكافي سر إنتاجية الغد.',
    time: '22:00', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily',
    enabled: true, sound: 'gentle', vibrate: true, snoozeEnabled: true, snoozeMinutes: 15,
  },
];

/** أصوات المنبه */
export const ALARM_SOUNDS = {
  none: { ar: 'بدون صوت', en: 'Silent' },
  gentle: { ar: 'همسة هادئة', en: 'Gentle chime' },
  chime: { ar: 'جرس لطيف', en: 'Soft bell' },
  urgent: { ar: 'نبضة قوية', en: 'Strong pulse' },
  classic: { ar: 'جرس المنبه الكلاسيكي', en: 'Classic alarm' },
};
