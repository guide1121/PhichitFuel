const { getDistance } = require('geolib');
const admin = require('firebase-admin');

// ตัวแปรคงที่ (Constants)
const GEOFENCE_RADIUS_METERS = 200;
const RATE_LIMIT_MINUTES = 5;
const MAJORITY_VOTE_WINDOW_MINUTES = 30; // ใช้รายงานในช่วง 30 นาทีมาคำนวณโหวต
const DATA_EXPIRATION_HOURS = 2;

/**
 * ฟังก์ชันหลักในการประมวลผลการรายงาน
 */
async function processReport(db, data) {
  const { userId, stationId, status, fuelType, userLat, userLng } = data;
  const now = admin.firestore.Timestamp.now();

  try {
    // 1. ตรวจสอบ Rate Limit (1 ครั้ง/ชนิดน้ำมัน/ปั๊ม/5 นาที)
    const recentReportQuery = await db.collection('reports')
      .where('userId', '==', userId)
      .where('stationId', '==', stationId)
      .where('timestamp', '>', new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000))
      .get();

    let hasRecentSameFuel = false;
    recentReportQuery.forEach(doc => {
      if (doc.data().fuelType === fuelType) {
        hasRecentSameFuel = true;
      }
    });

    if (hasRecentSameFuel) {
      throw new Error('คุณส่งรายงานบ่อยเกินไป กรุณารอ 5 นาทีสำหรับการรายงานปั๊มนี้อีกครั้ง');
    }

    // 2. ดึงข้อมูลปั๊มเพื่อตรวจสอบ Geofencing (ลบความคิดเห็นส่วนนี้ออกชั่วคราวถ้าปั๊มยังไม่ถูกสร้างใน DB)
    const stationRef = db.collection('stations').doc(stationId);
    const stationDoc = await stationRef.get();
    
    if (!stationDoc.exists) {
      // สำหรับ MVP: หากยังไม่มีให้ถือว่าพิกัดปัจจุบันคือพิกัดปั๊ม 
      // หรือควรจะ reject ถ้าเป็นการทำงานจริง
      throw new Error('ไม่พบข้อมูลปั๊มน้ำมันในระบบ');
    }

    const stationData = stationDoc.data();
    if (stationData.location) {
        const distance = getDistance(
            { latitude: userLat, longitude: userLng },
            { latitude: stationData.location.latitude, longitude: stationData.location.longitude }
        );

        if (distance > GEOFENCE_RADIUS_METERS) {
            throw new Error(`คุณอยู่ห่างจากปั๊มเกินระยะที่กำหนด (${distance} เมตร). ต้องอยู่ในระยะ ${GEOFENCE_RADIUS_METERS} เมตร`);
        }
    }

    // 3. บันทึก Report เป็นประวัติ
    await db.collection('reports').add({
      userId,
      stationId,
      status,       // 'Available', 'Limited', 'Out of stock'
      fuelType,     // 'Diesel', ฯลฯ
      timestamp: now,
      location: new admin.firestore.GeoPoint(userLat, userLng)
    });

    // 4. คำนวณเสียงส่วนใหญ่ (Majority Vote) จากรายงานทั้งหมดใน 30 นาทีล่าสุด
    const voteQuery = await db.collection('reports')
      .where('stationId', '==', stationId)
      .where('timestamp', '>', new Date(Date.now() - MAJORITY_VOTE_WINDOW_MINUTES * 60 * 1000))
      .get();

    const votes = {
      'Available': 0,
      'Limited': 0,
      'Out of stock': 0
    };

    voteQuery.forEach(doc => {
      const voteStatus = doc.data().status;
      if (votes[voteStatus] !== undefined) {
        votes[voteStatus]++;
      }
    });

    // หา Value ที่มีโหวตสูงสุด
    let majorityStatus = status; // ค่าเริ่มต้นเป็นของคนที่เพิ่งรายงาน
    let maxVotes = 0;
    Object.keys(votes).forEach(key => {
      if (votes[key] > maxVotes) {
        maxVotes = votes[key];
        majorityStatus = key;
      }
    });

    // 5. อัปเดตสถานะปั๊มน้ำมันในตาราง stations
    const fuelStatusUpdate = {};
    if (fuelType) {
        fuelStatusUpdate[`fuels.${fuelType}.status`] = majorityStatus;
        fuelStatusUpdate[`fuels.${fuelType}.lastUpdated`] = now;
    }

    await stationRef.update({
      status: majorityStatus, // สถานะภาพรวม
      lastUpdated: now,
      ...fuelStatusUpdate
    });

    return { success: true, newStatus: majorityStatus, votes };
  } catch (error) {
    throw error;
  }
}

/**
 * ฟังก์ชันตรวจสอบและลบ/รีเซ็ตข้อมูลที่หมดอายุ (เกิน 2 ชั่วโมงไม่มีอัปเดต)
 */
async function cleanupExpiredData(db) {
  try {
    const expiredTime = new Date(Date.now() - DATA_EXPIRATION_HOURS * 60 * 60 * 1000);
    const expiredStationsQuery = await db.collection('stations')
      .where('lastUpdated', '<', expiredTime)
      .where('status', '!=', 'No data') // เลือกเฉพาะที่ยังมีสถานะอื่นอยู่ ให้กลายเป็น No data
      .get();

    if (expiredStationsQuery.empty) {
      return;
    }

    const batch = db.batch();
    expiredStationsQuery.forEach(doc => {
      batch.update(doc.ref, { 
          status: 'No data',
          lastUpdated: admin.firestore.Timestamp.now()
      });
    });

    await batch.commit();
    console.log(`Cleaned up ${expiredStationsQuery.size} expired stations.`);
  } catch (error) {
    console.error('Error in cleanupExpiredData:', error);
  }
}

module.exports = {
  processReport,
  cleanupExpiredData
};
