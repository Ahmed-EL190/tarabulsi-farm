# نظام إدارة مزرعة الحليب
React + Vite + Tailwind + Firebase (Auth / Firestore / Storage). واجهة عربية RTL.

## التشغيل (Windows/Mac/Linux)
```
npm install
copy .env.example .env      # ثم املأ قيم Firebase
npm run dev                 # http://localhost:5173
npm test                    # اختبارات المنطق المالي والاستيراد
npm run build
```
## إعداد Firebase
1. أنشئ مشروعاً. فعّل Authentication (Email/Password)، Firestore، Storage.
2. إعدادات تطبيق الويب → انسخ القيم الستة إلى `.env`.
3. `npm i -g firebase-tools && firebase login && firebase use <project>`
4. `firebase deploy --only firestore:rules,firestore:indexes`
5. أنشئ المستخدم الأول من Authentication → Users ثم عيّنه مديراً **محلياً**:
   `set GOOGLE_APPLICATION_CREDENTIALS=C:\keys\sa.json` ثم `node scripts/set-role.mjs you@mail.com admin`
   (مفتاح الخدمة يبقى خارج المشروع. أعد تسجيل الدخول بعدها.) باقي المستخدمين: `entry` أو `viewer` بنفس الأمر.
6. Storage rules: اسمح بالقراءة/الكتابة لمسار `attachments/**` للمستخدمين الذين `request.auth.token.role in ['admin','entry']`.

## استيراد ملف Excel
سجّل دخول كمدير → «استيراد Excel» → نسخة احتياطية أولاً → اختر الملف → راجع المعاينة والمطابقة والتحذيرات → تأكيد. بعد الانتهاء تظهر نتيجة التحقق (✓/✗) بمقارنة الأرقام المقروءة من Firestore بأرقام الملف. إعادة الاستيراد آمنة (معرّفات حتمية + بصمة الملف) وإن انقطع يُستكمل من آخر دفعة.
تفاصيل المطابقة: `docs/RECONCILIATION.md`.

## النسخ الاحتياطي
- من الموقع: «استيراد Excel → نسخة احتياطية كاملة».
- تلقائياً: `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w`
- استعادة: `gcloud firestore databases restore ...` أو إعادة استيراد ملفات النسخ.

## النشر
`npm run build && firebase deploy --only hosting,firestore`

## ما تم اختباره / ما لم يُختبر
مُختبَر آلياً: المنطق المالي، تحويل الإدخال اليومي، قراءة الملف الفعلي ومطابقة المجاميع، ومخطط الاستيراد (17 اختباراً)، وبناء الإنتاج.
**غير مُختبَر** (يحتاج مشروع Firebase حقيقي): الدخول، القراءة/الكتابة في Firestore، قواعد الأمان (استخدم Emulator Suite + `@firebase/rules-unit-testing`)، رفع المرفقات، شاشة الاستيراد على بياناتك.
