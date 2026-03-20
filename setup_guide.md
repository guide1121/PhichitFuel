# 🚀 คู่มือการติดตั้งระบบ Let's Help Phichit งบ 0 บาท 

โปรเจกต์ Let's Help Phichit นี้ออกแบบมาให้สามารถเริ่มให้บริการได้ด้วยค่าใช้จ่าย 0 บาท คุณสามารถทำตามขั้นตอนด้านล่างนี้เพื่อเปิดใช้งานได้ทันที

## ขั้นตอนที่ 1: การตั้งค่า Firebase (Database & Auth)

1. ไปที่ [Firebase Console](https://console.firebase.google.com/) และสร้างโปรเจกต์ใหม่ชื่อ "Lets Help Phichit"
2. ไปที่เมนู **Firestore Database** -> คลิก **Create Database**
   - เลือก Location เป็น `asia-southeast1` (สิงคโปร์) สำหรับความเร็วสูงสุด
3. ไปที่เมนู **Rules** (กฎความปลอดภัย) แล้วคัดลอกโค้ดจากไฟล์ [firestore.rules](file:///d:/WorkDST/PhichitFuel/firestore.rules) (ในโฟลเดอร์รหัสของคุณ) ไปวางทับ แล้วกด Publish
4. ไปที่เมนู **Authentication** -> คลิก **Get Started**
   - ไปที่ Tab **Sign-in method**
   - เลือก **Google** แล้วกดเปิดใช้งาน (Enable) -> ใส่ Support email -> กด Save

## ขั้นตอนที่ 2: ตั้งค่า Firebase สำหรับ Frontend (Client SDK)

1. ในหน้าภาพรวมโปรเจกต์ (Project Overview) กดรูปสัญลักษณ์ **</>** (Web) เพื่อสร้าง Web App แจ้งชื่อแอปอะไรก็ได้ในหน้าต่างที่เด้งขึ้นมา
2. คุณจะได้รับโค้ดที่มีออบเจกต์ `firebaseConfig` (ที่มี apiKey, authDomain, ฯลฯ)
3. นำค่าเหล่านั้นไปแทนที่ในไฟล์ [frontend/js/firebase.js](file:///d:/WorkDST/PhichitFuel/frontend/js/firebase.js) ของโปรเจกต์ของคุณตรงคำว่า `YOUR_API_KEY` และอื่นๆ
4. จากนั้นโค้ดส่วนของ Frontend (**โฟลเดอร์ frontend**) จะทำงานได้สมบูรณ์ นำโฟลเดอร์นี้ไปอัปโหลดขึ้นโฮสต์ฟรี เช่น [GitHub Pages](https://pages.github.com/), [Firebase Hosting](https://firebase.google.com/docs/hosting), หรือ Netlify ได้เลย

## ขั้นตอนที่ 3: ตั้งค่า Node.js Backend สำหรับ Admin SDK

คุณต้องตั้งค่า Service Account ไว้สำหรับการตรวจสอบ Geofencing และจัดการ Rate Limit

1. ใน Firebase Console ไปที่แท็บซ้ายบนเมนูรูปเฟือง ⚙️ (**Project settings**) -> **Service accounts**
2. คลิกปุ่ม **Generate new private key** (จะพ่นไฟล์ [.json](file:///d:/WorkDST/PhichitFuel/backend/package.json) โหลดมาเก็บไว้)
3. เปลี่ยนชื่อไฟล์เป็น `admin-keys.json` แล้วนำไปใส่ไว้ที่โฟลเดอร์ `backend/`
4. รันคำสั่งต่อไปนี้ใน Terminal สำหรับฝั่ง Backend เพื่อทดสอบระบบบนเครื่องของคุณ:
   ```bash
   cd backend
   npm install
   npm start
   ```

## ขั้นตอนที่ 4: การนำ Backend ไป Host บน Render ฟรี (งบ 0 บาท)

1. อัปโหลดโครงสร้างไฟล์ทั้งหมดขึ้น Git Repository ของคุณ เช่น GitHub
2. สมัครใช้งาน [Render](https://render.com/) และเลือกสร้าง **Web Service**
3. ลิงก์ GitHub Repo เข้ากับ Render
4. กรอกข้อมูลต่อไปนี้ในหน้าสร้าง Web Service บน Render:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. เนื่องจากเราเอาไฟล์ [.json](file:///d:/WorkDST/PhichitFuel/backend/package.json) ขึ้น Git ไม่ได้ (มันอันตราย) ให้คุณแปลงไฟล์ `admin-keys.json` เป็น Base64 โดยนำไฟล์ดังกล่าวไปแปลงบนเว็บใดก็ได้ (ค้นหาคำว่า JSON to Base64)
6. บน Render ในส่วนของ Environment Variables ให้เพิ่มตัวแปรชื่อ `FIREBASE_SERVICE_ACCOUNT_BASE64` และใส่ข้อความ Base64 ที่ได้ในข้อ 5 ทิ้งไว้
7. กด **Create Web Service** และเมื่อสำเร็จคุณจะได้ URL ตัวอย่างเช่น `https://phichitfuel.onrender.com`
8. **ขั้นสุดท้าย**: อย่าลืมกลับมาที่รหัสแอปเรา ไปแก้ไฟล์ [frontend/js/app.js](file:///d:/WorkDST/PhichitFuel/frontend/js/app.js) 
   เปลี่ยนตัวแปร `const BACKEND_API_URL = 'http://localhost:8080/api/report';` ให้เป็นลิงก์จริง เช่น `https://phichitfuel.onrender.com/api/report`

## ขั้นตอนที่ 5: การเพิ่มข้อมูลปั๊มน้ำมันตั้งต้น (Seed Data)

ใน Firestore Database ขอให้คุณดำเนินการสร้าง Collection ตารางที่ชื่อว่า `stations` และเพิ่ม Document ของปั๊มไว้เป็นค่าตัวอย่าง (เพื่อทดสอบ):

ตัวอย่างโครงสร้าง JSON ของ `stations`:
```json
// Doc ID (เช่น PT-Phichit-01)
{
  "name": "PT สาขาพิจิตร (ใกล้หอนาฬิกา)",
  "location": {
    // ต้องเซ็ตชนิดของ Field เป็น type geopoint ใน Firestore
    "latitude": 16.446714,
    "longitude": 100.348796
  },
  "status": "Available",
  "fuels": {
    "Diesel": { "status": "Available", "lastUpdated": <timestamp> },
    "Gasohol95": { "status": "Available", "lastUpdated": <timestamp> }
  },
  "lastUpdated": <timestamp>
}
```

🥳 **เสร็จสิ้น! ทุกอย่างพร้อมช่วยเหลือชาวพิจิตรให้อยู่รอดจากวิกฤตน้ำมันแล้วครับ**
