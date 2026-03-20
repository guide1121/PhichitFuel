import { db, collection, onSnapshot } from './firebase.js';
import { getCurrentUser, getAuthToken } from './auth.js';
import { initMap, renderStations, getDistance } from './map.js';

// ** TODO: เปลี่ยนเป็น URL ของ Render เมื่อรันจริง **
const BACKEND_API_URL = 'https://phichitfuel.onrender.com/api/report';

let allStations = [];
let currentSelectedStation = null;

// UI Elements
const searchInput = document.getElementById('search-input');
const filterDiesel = document.getElementById('filter-diesel');
const reportModal = document.getElementById('report-modal');
const closeModal = document.querySelector('.close-modal');
const modalStationName = document.getElementById('modal-station-name');
const reportButtons = document.querySelectorAll('.btn-report');
const reportFeedback = document.getElementById('report-feedback');
const loadingOverlay = document.getElementById('loading-overlay');

// เริ่มการทำงาน
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    listenToStations();
    setupEventListeners();
});

// ดึงข้อมูล Real-time (onSnapshot)
function listenToStations() {
    const stationsRef = collection(db, 'stations');
    
    // onSnapshot จะทำงานทันทีเมื่อเปิดเว็บ และเมื่อมีข้อมูลใน database เปลี่ยนแปลง
    onSnapshot(stationsRef, (snapshot) => {
        const stations = [];
        snapshot.forEach(doc => {
            stations.push({ id: doc.id, ...doc.data() });
        });
        
        allStations = stations;
        applyFiltersAndRender();
    }, (error) => {
        console.error("Error listening to stations:", error);
    });
}

// ระบบ Filter & Search
function applyFiltersAndRender() {
    const searchTerm = searchInput.value.toLowerCase();
    const isDieselOnly = filterDiesel.checked;

    const filtered = allStations.filter(station => {
        const matchName = station.name.toLowerCase().includes(searchTerm);
        
        let matchDiesel = true;
        if (isDieselOnly) {
            // เช็คว่าดีเซลสถานะเป็น Available
            matchDiesel = station.fuels && station.fuels['Diesel'] && station.fuels['Diesel'].status === 'Available';
        }
        
        return matchName && matchDiesel;
    });

    renderStations(filtered, openReportModal);
}

function setupEventListeners() {
    searchInput.addEventListener('input', applyFiltersAndRender);
    filterDiesel.addEventListener('change', applyFiltersAndRender);

    closeModal.addEventListener('click', () => {
        reportModal.classList.add('hidden');
        reportFeedback.textContent = '';
    });

    reportButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const status = e.target.getAttribute('data-status');
            const fuel = e.target.getAttribute('data-fuel');
            submitReport(status, fuel);
        });
    });
}

function openReportModal(station) {
    if (!getCurrentUser()) {
        alert("กรุณาเข้าสู่ระบบด้วย Google ก่อนรายงานสถานะครับ");
        return;
    }
    
    currentSelectedStation = station;
    modalStationName.textContent = `รายงาน: ${station.name}`;
    reportFeedback.textContent = '';
    reportModal.classList.remove('hidden');
}

// ขอพิกัด GPS ผู้ใช้ เพื่อส่งไป Backend ยืนยัน Geofencing
async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง (GPS)"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }),
            error => reject(error),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

async function submitReport(status, fuelType) {
    if (!currentSelectedStation) return;
    
    reportFeedback.textContent = '';
    reportFeedback.className = 'feedback-msg'; // reset

    try {
        loadingOverlay.classList.remove('hidden');
        
        // 1. ดัน GPS ตรง Client ก่อนส่งให้ลดภาระ Server เบื้องต้น
        const userLoc = await getUserLocation();
        const stationLoc = currentSelectedStation.location;
        
        if (stationLoc) {
            const distance = getDistance(userLoc.latitude, userLoc.longitude, stationLoc.latitude, stationLoc.longitude);
            if (distance > 200) {
                throw new Error(`คุณไม่ได้อยู่ใกล้ปั๊มนี้ (ห่าง ${Math.round(distance)} เมตร) โปรดเข้าไปในเขตปั๊มก่อนรายงาน`);
            }
        }

        // 2. ขอ Token และส่ง API
        const token = await getAuthToken();
        const response = await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stationId: currentSelectedStation.id,
                status: status,
                fuelType: fuelType,
                userLat: userLoc.latitude,
                userLng: userLoc.longitude
            })
        });

        const result = await response.json();

        if (!response.ok) {
             throw new Error(result.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
        }

        // 3. สำเร็จ
        reportFeedback.textContent = 'บันทึกข้อมูลเรียบร้อย ขอบคุณที่ช่วยเหลือครับ!';
        reportFeedback.classList.add('success');
        
        // ปิด Modal อัตโนมัติหลัง 2 วิ
        setTimeout(() => {
            reportModal.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('Report error:', error);
        reportFeedback.textContent = error.message;
        reportFeedback.classList.remove('success');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}
