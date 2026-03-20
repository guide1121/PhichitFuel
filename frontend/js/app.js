import { db, collection, onSnapshot } from './firebase.js';
import { getCurrentUser, getAuthToken } from './auth.js';
import { map, renderStations, updateUserLocationMarker } from './map.js';

// URL ของ Backend (เปลี่ยนเป็นโดเมนจริงเมื่ออัปขึ้น Server)
const BACKEND_API_URL = 'https://phichitfuel.onrender.com/api/report';

// UI Elements 
const searchInput = document.getElementById('search-input');
const bottomSheet = document.getElementById('station-bottom-sheet');
const sheetEmptyState = document.getElementById('sheet-empty-state');
const sheetDataState = document.getElementById('sheet-data-state');
const sheetStationName = document.getElementById('sheet-station-name');
const sheetFuelGrid = document.getElementById('sheet-fuel-grid');
const reportOptionsContainer = document.getElementById('report-options-container');

const btnOpenReport = document.getElementById('btn-open-report');
const reportModal = document.getElementById('report-modal');
const closeReport = document.getElementById('close-report');
const profileModal = document.getElementById('profile-modal');
const closeProfile = document.getElementById('close-profile');
const btnProfile = document.getElementById('btn-profile');
const reportFeedback = document.getElementById('report-feedback');
const loadingOverlay = document.getElementById('loading-overlay');

let allStations = [];
let selectedStationId = null;
let userCoords = null;

// ตั้งค่ารายการน้ำมันทั้งหมดที่ระบบรองรับ (สามารถเพิ่มได้เรื่อยๆ)
const SUPPORTED_FUELS = [
    { id: 'Diesel', name: 'ดีเซล (Diesel/B7)' },
    { id: 'Gasohol95', name: 'แก๊สโซฮอล์ 95' },
    { id: 'E20', name: 'E20' },
    { id: 'Gasohol91', name: 'แก๊สโซฮอล์ 91' }
];

document.addEventListener('DOMContentLoaded', () => {
    getUserLocation();
    listenToStations();
    renderReportModalOptions(); // สร้าง UI ปุ่มรีพอร์ตตาม SUPPORTED_FUELS
    
    // ตั้งค่าค้นหา
    searchInput.addEventListener('input', applyFiltersAndRender);

    // ปิด/เปิด Modal ข้อมูล
    btnProfile.addEventListener('click', () => profileModal.classList.remove('hidden'));
    closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));
    closeReport.addEventListener('click', () => reportModal.classList.add('hidden'));

    // ซ่อนแผ่น Bottom Sheet เวลาแตะบนแผนที่
    map.on('click', () => {
        closeBottomSheet();
    });
    
    document.querySelector('.sheet-handle').addEventListener('click', () => {
        bottomSheet.classList.toggle('closed');
    });

    // ปุ่มเปิดหน้ารายงาน
    btnOpenReport.addEventListener('click', () => {
        if(!selectedStationId) return;
        if(!getCurrentUser()) {
            profileModal.classList.remove('hidden'); // บังคับให้ล็อกอิน
            return;
        }
        reportModal.classList.remove('hidden');
        reportFeedback.textContent = '';
    });
});

// สร้างปุ่มรายงานสถานะอัตโนมัติ (Dynamic Modal Options)
function renderReportModalOptions() {
    reportOptionsContainer.innerHTML = ''; // Clear เก่าออก

    SUPPORTED_FUELS.forEach((fuel, index) => {
        const fuelBlock = document.createElement('div');
        fuelBlock.className = 'report-options';
        fuelBlock.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; font-size:18px; text-align:left;">${fuel.name}</div>
            <button class="btn-report btn-green" data-status="Available" data-fuel="${fuel.id}">🟢 มีน้ำมัน</button>
            <button class="btn-report btn-yellow" data-status="Limited" data-fuel="${fuel.id}">🟡 จำกัด/รอนาน</button>
            <button class="btn-report btn-red" data-status="Out of stock" data-fuel="${fuel.id}">🔴 หมด</button>
        `;
        
        // ขีดเส้นแบ่งใต้แต่ละชุด (ยกเว้นอันสุดท้าย)
        if (index < SUPPORTED_FUELS.length - 1) {
            const hr = document.createElement('hr');
            hr.style = "margin:20px 0; border:1px solid rgba(0,0,0,0.1);";
            fuelBlock.appendChild(hr);
        }

        reportOptionsContainer.appendChild(fuelBlock);
    });

    // ผูกปุ่มหลังจากสร้างเสร็จ
    document.querySelectorAll('.btn-report').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            const fuelType = btn.getAttribute('data-fuel');
            submitReport(status, fuelType);
        });
    });
}

// ฟังชั่นดึงข้อมูลจาก Database สดๆ
function listenToStations() {
    const stationsRef = collection(db, 'stations');
    onSnapshot(stationsRef, (snapshot) => {
        allStations = [];
        snapshot.forEach(doc => {
            allStations.push({ id: doc.id, ...doc.data() });
        });
        applyFiltersAndRender();
    });
}

function applyFiltersAndRender() {
    const searchTerm = searchInput.value.toLowerCase();
    const filtered = allStations.filter(st => st.name.toLowerCase().includes(searchTerm));
    renderStations(filtered, onMarkerClick);
}

// เมื่อคลิกหมุดแผนที่
function onMarkerClick(station) {
    selectedStationId = station.id;
    sheetStationName.textContent = station.name;
    
    // สร้างการ์ดแสดงสถานะน้ำมันแบบ Dynamic บน Bottom Sheet
    sheetFuelGrid.innerHTML = '';
    SUPPORTED_FUELS.forEach(fuel => {
        // ดึงสถานะปัจจุบันของน้ำมันชนิดนั้น หรือตั้งค่าเป็น No data
        const currentStatus = station.fuels?.[fuel.id]?.status || 'No data';
        
        // วาดการ์ดออกมา
        const cardNode = document.createElement('div');
        cardNode.className = 'fuel-card neumorphic-inset';
        cardNode.innerHTML = `
            <div class="fuel-title">${fuel.name}</div>
            <div id="status-${fuel.id}" class="fuel-badge"></div>
        `;
        sheetFuelGrid.appendChild(cardNode);

        // ใส่สีให้ตรงกับสถานะ
        updateBadge(`status-${fuel.id}`, currentStatus);
    });

    // เปิด Bottom Sheet
    sheetEmptyState.classList.add('hidden');
    sheetDataState.classList.remove('hidden');
    bottomSheet.classList.remove('closed');
    map.panTo([station.location.latitude, station.location.longitude], { animate: true });
}

function closeBottomSheet() {
    bottomSheet.classList.add('closed');
    setTimeout(() => {
        sheetDataState.classList.add('hidden');
        sheetEmptyState.classList.remove('hidden');
    }, 300);
}

function updateBadge(elId, status) {
    const el = document.getElementById(elId);
    el.className = 'fuel-badge'; // Reset classes
    
    if(status === 'Available') { el.textContent = '🟢 มีน้ำมัน'; el.classList.add('badge-green'); }
    else if(status === 'Limited') { el.textContent = '🟡 จำกัด/รอนาน'; el.classList.add('badge-yellow'); }
    else if(status === 'Out of stock') { el.textContent = '🔴 หมด'; el.classList.add('badge-red'); }
    else { el.textContent = '⚪ ไม่มีข้อมูล'; el.classList.add('badge-gray'); }
}

async function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                updateUserLocationMarker(userCoords.latitude, userCoords.longitude);
            },
            (error) => { console.warn("ไม่สามารถดึงตำแหน่ง GPS ได้:", error.message); }
        );
    }
}

async function submitReport(status, fuelType) {
    if (!userCoords) {
        reportFeedback.textContent = "โปรดอนุญาตการเข้าถึงตำแหน่ง GPS ของคุณ (กดอนุญาตในเบราว์เซอร์)";
        reportFeedback.style.backgroundColor = '#fee2e2';
        reportFeedback.style.color = '#991b1b';
        return;
    }

    loadingOverlay.classList.remove('hidden');

    try {
        const token = await getAuthToken();
        if (!token) throw new Error("ไม่พบ Token ยืนยันตัวตน เริ่มระบบใหม่");

        const payload = {
            stationId: selectedStationId,
            fuelType: fuelType,
            status: status,
            userLocation: userCoords
        };

        const response = await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            reportFeedback.textContent = `ส่งรายงานสำเร็จ! ขอบคุณที่ช่วยเหลือครับ (${result.message})`;
            reportFeedback.style.backgroundColor = '#dcfce7'; 
            reportFeedback.style.color = '#166534';
            setTimeout(() => { reportModal.classList.add('hidden'); }, 2000);
        } else {
            throw new Error(result.error || "เกิดข้อผิดพลาดในการรายงาน");
        }
    } catch (error) {
        reportFeedback.textContent = error.message;
        reportFeedback.style.backgroundColor = '#fee2e2';
        reportFeedback.style.color = '#991b1b';
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}
