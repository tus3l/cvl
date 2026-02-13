# 🔴 CYBER HACKER SPIN GAME 🔴
## لعبة القرصنة الإلكترونية مع المكافآت الديناميكية

<div dir="rtl">

### 🚀 تثبيت وتشغيل المشروع بخطوة واحدة!

```bash
node install.js
```

---</div>

## 📋 نظرة عامة على المشروع

لعبة Spin بأسلوب Cyberpunk/Hacker تحتوي على:
- ✅ نظام مكافآت ديناميكي يعتمد على ملفات السيرفر (Drop and Play)
- ✅ نظام مصادقة JWT كامل
- ✅ MongoDB + Mongoose
- ✅ React Frontend مع تأثيرات Cyberpunk
- ✅ Atomic Transactions لحماية البيانات

---

## 🚀 التثبيت السريع (خطوة واحدة فقط!)

### ⚡ نفذ هذا الأمر وخلصنا:

```bash
node install.js
```

**هذا السكريبت سيعمل كل شيء:**
- ✅ إنشاء جميع المجلدات
- ✅ إنشاء جميع ملفات Backend
- ✅ إنشاء جميع ملفات Frontend
- ✅ إنشاء ملف .env
- ✅ إنشاء مجلدات SPIN_REWARD

### 📁 بنية المشروع النهائية:
```
spinsGame/
├── server/
│   ├── models/
│   ├── controllers/
│   ├── middleware/
│   └── routes/
└── public/
    └── SPIN_REWARD/
        ├── common/
        ├── uncommon/
        ├── rare/
        ├── epic/
        └── legendary/
```

### 2️⃣ تثبيت المكتبات

```bash
npm install
```

### 3️⃣ إنشاء ملف .env

انسخ `.env.example` إلى `.env`:
```bash
copy .env.example .env
```

عدّل القيم حسب إعداداتك:
```env
MONGODB_URI=mongodb://localhost:27017/cyber_hacker_game
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
NODE_ENV=development
```

### 4️⃣ تشغيل MongoDB

تأكد من تشغيل MongoDB على جهازك:
```bash
mongod
```

### 5️⃣ تشغيل السيرفر

```bash
npm run dev
```

---

## 🎮 نظام المكافآت الديناميكي (Dynamic Loot System)

### 🔥 الميزة الأساسية: DROP AND PLAY

1. **افتح مجلد**: `public/SPIN_REWARD/`
2. **اختر المجلد حسب الندرة**:
   - `common/` - عادي (40% فرصة)
   - `uncommon/` - غير عادي (30% فرصة)
   - `rare/` - نادر (15% فرصة)
   - `epic/` - أسطوري (10% فرصة)
   - `legendary/` - خرافي (5% فرصة)

3. **اسحب أي صورة** (PNG, JPG, GIF, SVG) داخل المجلد
4. **أعد تشغيل السيرفر** أو استدعي `/api/spin/manifest`
5. **اللعبة تلتقط الصورة تلقائياً!** ✅

**مثال:**
```
ألقيت ملف virus_epic.png في مجلد public/SPIN_REWARD/epic/
↓
السيرفر يكتشفها تلقائياً
↓
اللاعبون يمكنهم الحصول عليها بنسبة 10%!
```

---

## 🔐 نظام المصادقة

### Register (التسجيل)
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "cyber_hacker",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": ">> REGISTRATION_COMPLETE: Identity created",
  "user": {
    "id": "...",
    "username": "cyber_hacker",
    "wallet": {
      "crypto_credits": 1000,
      "rare_gems": 0
    },
    "xp": 0,
    "level": 1
  },
  "token": "jwt_token_here"
}
```

### Login (تسجيل الدخول)
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "cyber_hacker",
  "password": "securepass123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer your_token_here
```

---

## 🎰 نظام الـ Spin

### Execute Hack (تنفيذ الاختراق)
```http
POST /api/spin/hack
Authorization: Bearer your_token_here
```

**Response (نجاح):**
```json
{
  "success": true,
  "message": ">> HACK_SUCCESSFUL: System breached",
  "reward": {
    "fileName": "virus_epic.png",
    "filePath": "/rewards/epic/virus_epic.png",
    "rarity": "epic"
  },
  "xpGained": 50,
  "user": {
    "wallet": {
      "crypto_credits": 950,
      "rare_gems": 0
    },
    "xp": 50,
    "level": 1,
    "inventorySize": 1
  }
}
```

**Response (فشل - رصيد غير كافي):**
```json
{
  "success": false,
  "message": ">> INSUFFICIENT_FUNDS: Need 50 crypto_credits",
  "currentBalance": 30
}
```

### Get Manifest (قائمة المكافآت)
```http
GET /api/spin/manifest
```

**Response:**
```json
{
  "success": true,
  "message": ">> MANIFEST_LOADED: Reward database online",
  "manifest": {
    "common": [
      {
        "fileName": "coin.png",
        "filePath": "/rewards/common/coin.png",
        "rarity": "common"
      }
    ],
    "epic": [...],
    ...
  },
  "stats": [
    { "rarity": "common", "count": 5, "chance": "40%" },
    { "rarity": "epic", "count": 3, "chance": "10%" },
    ...
  ]
}
```

### Get Inventory (المخزون)
```http
GET /api/spin/inventory
Authorization: Bearer your_token_here
```

---

## 🎨 Frontend (React)

### إنشاء مشروع React

```bash
npx create-react-app client
cd client
npm install framer-motion axios
```

### بنية Frontend المقترحة:
```
client/
├── src/
│   ├── components/
│   │   ├── TerminalLogin.jsx
│   │   ├── HackButton.jsx
│   │   ├── RewardDisplay.jsx
│   │   └── Inventory.jsx
│   ├── styles/
│   │   └── cyberpunk.css
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── App.jsx
│   └── index.js
```

---

## 🔒 الأمان (Security Features)

### 1. **Atomic Transactions**
```javascript
// السيرفر يستخدم findByIdAndUpdate مع $inc و $push
// هذا يضمن أن العملية تحدث كلها أو لا تحدث أبداً
const updatedUser = await User.findByIdAndUpdate(
  userId,
  {
    $inc: { 'wallet.crypto_credits': -50, 'xp': 10 },
    $push: { inventory: reward }
  },
  { new: true }
);
```

### 2. **Password Hashing**
```javascript
// يتم تشفير كلمات المرور تلقائياً باستخدام bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
});
```

### 3. **JWT Authentication**
- HttpOnly Cookies (مفضل)
- Token expiration (7 أيام)
- Middleware protection

---

## 📊 Database Schema

### User Model
```javascript
{
  username: String (unique),
  password: String (hashed),
  wallet: {
    crypto_credits: Number (default: 1000),
    rare_gems: Number (default: 0)
  },
  inventory: [{
    fileName: String,
    filePath: String,
    rarity: String,
    timestamp: Date
  }],
  xp: Number (default: 0),
  level: Number (default: 1),
  createdAt: Date
}
```

---

## 🎯 احتمالات الندرة (Rarity Probabilities)

| الندرة | الاحتمال | XP المكتسب | السعر |
|--------|----------|-----------|-------|
| Common | 40% | 5 XP | 50 Credits |
| Uncommon | 30% | 10 XP | 50 Credits |
| Rare | 15% | 25 XP | 50 Credits |
| Epic | 10% | 50 XP | 50 Credits |
| Legendary | 5% | 100 XP | 50 Credits |

---

## 🛠️ الملفات المطلوبة

بعد تنفيذ `node setup.js`، ستحتاج لإنشاء هذه الملفات:

### Backend Files:
1. ✅ `server/server.js` - Main server file
2. ✅ `server/models/User.js` - Mongoose User model
3. ✅ `server/controllers/authController.js` - Authentication logic
4. ✅ `server/controllers/spinController.js` - Spin/Hack logic
5. ✅ `server/middleware/authMiddleware.js` - JWT verification
6. ✅ `server/routes/authRoutes.js` - Auth endpoints
7. ✅ `server/routes/spinRoutes.js` - Spin endpoints

---

## 🚀 Quick Start Commands

```bash
# 1. إنشاء البنية
node setup.js

# 2. تثبيت المكتبات
npm install

# 3. إنشاء .env
copy .env.example .env

# 4. تشغيل MongoDB (في terminal آخر)
mongod

# 5. تشغيل السيرفر
npm run dev

# Server running on: http://localhost:5000
```

---

## 🎨 Cyberpunk Theme Guidelines

### Colors:
- Background: `#000000` (Pure Black)
- Primary Text: `#0f0` (Neon Green)
- Secondary Text: `#00ffff` (Cyan)
- Accent: `#ff00ff` (Magenta)
- Error: `#ff0000` (Red)

### Fonts:
- Monospace: `'Courier New', monospace`
- Cyberpunk: `'Orbitron'` (Google Fonts)

### Effects:
- Glitch animations
- CRT scanlines
- Terminal typing effect
- Matrix-style rain
- Neon glow effects

---

## 📝 Notes

- **تكلفة كل spin**: 50 crypto_credits
- **رصيد البداية**: 1000 crypto_credits
- **نظام الـ Level**: كل 100 XP = مستوى جديد
- **حفظ تلقائي**: كل عملية محفوظة atomically

---

## 🐛 Troubleshooting

### المشكلة: "Cannot connect to MongoDB"
```bash
# تأكد من تشغيل MongoDB
mongod
```

### المشكلة: "Port 5000 already in use"
```bash
# غيّر PORT في .env
PORT=5001
```

### المشكلة: "No rewards found"
```bash
# تأكد من وجود صور في مجلدات SPIN_REWARD
# أضف على الأقل صورة واحدة في كل مجلد
```

---

## 🎯 الخطوات التالية

1. ✅ تشغيل السيرفر
2. 📝 إنشاء React Frontend
3. 🎨 تطبيق Cyberpunk Styling
4. ⚡ إضافة Animations
5. 🖼️ إضافة صور المكافآت في مجلدات SPIN_REWARD

---

## 📞 Support

للمساعدة أو الأسئلة، راجع الكود أو اطلع على Documentation.

**>> SYSTEM_STATUS: Ready for deployment**

---

Made with 💚 by Cyber Hackers
