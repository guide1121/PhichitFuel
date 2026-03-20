require('dotenv').config();
const admin = require('firebase-admin');

// 1. เชื่อมต่อ Firebase (อิงจากไฟล์ admin-keys.json)
try {
  const serviceAccount = require('./admin-keys.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized for seeding.');
} catch (error) {
  console.error('ไม่พบไฟล์ admin-keys.json กรุณาทำตาม ขั้นตอนที่ 3 ในคู่มือให้ครบก่อนรันไฟล์นี้ครับ');
  process.exit(1);
}

const db = admin.firestore();

// คำสั่งบอกให้ Overpass หา "amenity=fuel" ใน "จังหวัดพิจิตร"
const OVERPASS_QUERY = `
  [out:json][timeout:25];
  area["name:th"="จังหวัดพิจิตร"]->.searchArea;
  node["amenity"="fuel"](area.searchArea);
  out body;
`;

async function seedGasStations() {
  console.log('กำลังดึงข้อมูลปั๊มน้ำมันจังหวัดพิจิตรจาก OpenStreetMap (Overpass API)...');
  
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const elements = data.elements || [];
    
    if (elements.length === 0) {
      console.log('ไม่พบข้อมูลปั๊มในรัศมีที่กำหนด หรือมีปัญหาในการใช้ชื่อเขตพื้นที่');
      process.exit(0);
    }

    console.log(`พบข้อมูลปั๊มน้ำมันจำนวน: ${elements.length} แห่ง. กำลังนำเข้าสู่ Firebase...`);
    
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    let count = 0;

    elements.forEach((node) => {
      // ใช้ ID จาก OSM เป็นรหัส
      const docRef = db.collection('stations').doc(`OSM-${node.id}`);
      
      // ดึงข้อมูลชื่อปั๊มและแบรนด์ (ถ้ามี) ถ้าไม่มีตั้งให้เป็น 'ปั๊มน้ำมัน (ไม่ระบุแบรนด์)'
      const name = node.tags.name || node.tags.brand || 'ปั๊มน้ำมัน (ไม่มีชื่อ)';
      
      batch.set(docRef, {
        name: name,
        location: new admin.firestore.GeoPoint(node.lat, node.lon),
        status: 'No data', // เริ่มต้นให้เป็น No data
        fuels: {
          'Diesel': { status: 'No data', lastUpdated: now },
          'Gasohol95': { status: 'No data', lastUpdated: now }
        },
        lastUpdated: now,
        osm_id: node.id
      });
      
      count++;
    });

    // สั่งบันทึกลง Database รวดเดียว (Batch)
    await batch.commit();
    console.log(`นำเข้าข้อมูลและสร้างจุดปักหมุดสำเร็จแล้วทั้งหมด ${count} แห่ง! 🎉`);
    process.exit(0);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงหรือนำเข้าข้อมูล:', error.message);
    process.exit(1);
  }
}

seedGasStations();
