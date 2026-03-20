require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Firebase Admin initialization
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // สำหรับ Render
    const buff = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
    serviceAccount = JSON.parse(buff.toString('utf-8'));
  } else {
    // สำหรับ Local
    serviceAccount = require('./admin-keys.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
}

const db = admin.firestore();
const { processReport, cleanupExpiredData } = require('./logic');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware ตรวจสอบ Firebase ID Token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// API Endpoint สำหรับรับข้อมูลการรายงาน
app.post('/api/report', verifyToken, async (req, res) => {
  try {
    const { stationId, status, fuelType, userLat, userLng } = req.body;
    const userId = req.user.uid;

    if (!stationId || !status || !userLat || !userLng) {
      return res.status(400).json({ error: 'Bad Request: Missing required fields' });
    }

    const result = await processReport(db, {
      userId,
      stationId,
      status,        // 'Available', 'Limited', 'Out of stock'
      fuelType,      // 'Diesel', 'Gasohol95', 'Gasohol91', 'E20'
      userLat,
      userLng
    });

    res.status(200).json({ message: 'Report processed successfully', result });
  } catch (error) {
    console.error('Report processing error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// เริ่มทำงาน Cleanup ทุกๆ 15 นาที
setInterval(() => {
  cleanupExpiredData(db);
}, 15 * 60 * 1000);

// เริ่มทำงานรอบแรกทันที
setTimeout(() => cleanupExpiredData(db), 5000);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
