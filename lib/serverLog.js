/**
 * Server management log: what was done on the VPS, the state it left, and
 * what is next. Lives in the repo like lib/devDocs.js, so each server change
 * gets a reviewed entry. Add new reports to the top of SERVER_REPORTS.
 *
 * This ships in the public JS bundle: no IPs, user names or passwords here.
 * Those stay in the encrypted vault on the Infrastructure page.
 *
 * Text is Arabic (rendered right-to-left); commands stay in English.
 */

/** Current exposure of the VPS. Update it whenever a report changes it. */
export const SERVER_PORTS = [
  { port: '22', service: 'SSH (بالمفتاح بس)', reach: 'الإنترنت', tone: 'staging' },
  { port: '80 / 443', service: 'Nginx', reach: 'الإنترنت', tone: 'staging' },
  { port: '5432', service: 'Postgres', reach: 'شبكات Docker بس', tone: 'local' },
  { port: '—', service: 'Containers ‏(Market Neurons)', reach: 'السيرفر نفسه بس (127.0.0.1)', tone: 'local' },
]

export const SERVER_REPORTS = [
  {
    id: '2026-11-11-hardening',
    title: 'ملخص تأمين السيرفر',
    date: '2026-11-11',
    author: 'Hesham Hmady Ahmed Hashem',
    explainer: {
      title: 'يعني إيه Fail2ban؟',
      intro: 'Fail2ban برنامج بيحمي السيرفر من محاولات الاختراق المتكررة.',
      points: [
        ['المشكلة', 'أي سيرفر بورت 22 بتاعه مفتوح على الإنترنت بيجيله آلاف المحاولات يوميًا من بوتات بتجرب أسماء مستخدمين وباسوردات.'],
        ['الحل', 'Fail2ban بيقرأ سجلات SSH، ولو IP غلط 5 مرات في خلال 10 دقايق بيحظره ساعة كاملة من خلال الفايرول.'],
        ['عملنا فيه إيه بالظبط؟', 'كان متسطب وشغال، بس كان بيراقب خدمة اسمها sshd.service، وفي Ubuntu 24.04 اسمها ssh.service. فكان أعمى ومش شايف أي محاولة (Total failed: 0). عملنا ملف jail.local يوجهه للخدمة الصح.'],
      ],
    },
    done: [
      {
        title: 'مستخدم جديد بصلاحيات sudo',
        points: [
          'أنشأنا مستخدم جديد بحروف صغيرة، لأن Ubuntu بيرفض الحروف الكبيرة (اسمه محفوظ في الـ Vault كـ SSH user).',
          'اديناه صلاحيات sudo.',
        ],
      },
      {
        title: 'الدخول بمفتاح SSH بس',
        points: [
          'استخدمنا مفتاح الـ SSH اللي على الماك.',
          'المشكلة اللي قابلتنا: كان فيه ملفين في /etc/ssh/sshd_config.d/ بيقفلوا الباسورد، فـ ssh-copy-id مكانش شغال. فتحنا الباسورد مؤقتًا، نسخنا المفتاح، وقفلناه تاني.',
          'النتيجة: دخول root ممنوع، الدخول بالباسورد ممنوع، والدخول بالمفتاح بس.',
        ],
      },
      {
        title: 'الفايرول (UFW)',
        points: [
          'شيلنا البورت 2222 لأن مفيش حاجة شغالة عليه.',
          'شيلنا قاعدة 22/tcp لأنها مكررة مع OpenSSH.',
          'اتأكدنا إن الـ Default بيرفض أي اتصال داخل مش مسموح بيه.',
        ],
      },
      {
        title: 'Docker',
        points: [
          'اتأكدنا إن كل الـ containers ‏(prod و staging) مربوطة على 127.0.0.1، يعني مش مكشوفة على الإنترنت ومفيش وصول ليها غير عن طريق Nginx.',
        ],
      },
      {
        title: 'تطبيق قديم منسي',
        points: [
          'لقينا تطبيق Next.js قديم شغال بـ PM2 كـ root على بورت 3000. ده كان الـ frontend القديم من قبل النقل على Docker.',
          'اتأكدنا إن Nginx مش بيبعتله أي ترافيك، وبعدين وقفناه ومسحناه، وقفلنا pm2-root عشان ميشتغلش تاني بعد الريستارت.',
          'ملفات التطبيق لسه موجودة على السيرفر لو احتجت ترجعله.',
        ],
      },
      {
        title: 'Fail2ban',
        points: ['صلحنا الإعداد عشان يراقب ssh.service.'],
      },
    ],
    next: [
      { text: 'نتأكد إن Fail2ban بقى بيحظر IPs فعلًا', cmd: 'sudo fail2ban-client status sshd' },
      { text: 'نشيل الباكدجات اللي مش محتاجينها ونحدّث السيرفر', cmd: 'sudo apt autoremove -y && sudo apt upgrade -y' },
      { text: 'نفعّل التحديثات الأمنية التلقائية (unattended-upgrades)', cmd: 'sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades' },
    ],
  },
]
