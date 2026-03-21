import { db, collection, onSnapshot } from './firebase.js';
import { getCurrentUser, getAuthToken } from './auth.js';
import { map, renderStations, updateUserLocationMarker } from './map.js';

// URL ของ Backend (เปลี่ยนเป็นโดเมนจริงเมื่ออัปขึ้น Server)
const BACKEND_API_URL = 'https://phichitfuel.onrender.com/api/report';

// UI Elements 
const searchInput = document.getElementById('search-input');
const bottomSheet = document.getElementById('station-bottom-sheet');
const sheetDataState = document.getElementById('sheet-data-state');
const sheetStationName = document.getElementById('sheet-station-name');
const sheetFuelGrid = document.getElementById('sheet-fuel-grid');
const reportOptionsContainer = document.getElementById('report-options-container');

const btnOpenReport = document.getElementById('btn-open-report');
const reportBottomSheet = document.getElementById('report-bottom-sheet');
const reportOverlay = document.getElementById('report-overlay');
const closeReportSheet = document.getElementById('close-report-sheet');
const reportStationName = document.getElementById('report-station-name');
const reportStationAddress = document.getElementById('report-station-address');
const btnConfirmReport = document.getElementById('btn-confirm-report');
const profileModal = document.getElementById('profile-modal');
const closeProfile = document.getElementById('close-profile');
const btnProfile = document.getElementById('btn-profile');
const reportFeedback = document.getElementById('report-feedback');
const loadingOverlay = document.getElementById('loading-overlay');

let allStations = [];
let selectedStationId = null;
let userCoords = null;
let currentReportSelections = {}; // Store { fuelId: 'Available' | 'Limited' | 'Out of stock' | 'Unknown' }

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

    // About Modal (Formal)
    const btnInfo = document.getElementById('btn-info');
    const aboutOverlay = document.getElementById('about-overlay');
    const closeAbout = document.getElementById('close-about');
    const btnCloseAboutFooter = document.getElementById('btn-close-about-footer');

    if (btnInfo && aboutOverlay) {
        btnInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("Opening About Modal...");
            aboutOverlay.classList.remove('hidden');
        });
    }
    if (closeAbout) {
        closeAbout.addEventListener('click', () => aboutOverlay.classList.add('hidden'));
    }
    if (btnCloseAboutFooter) {
        btnCloseAboutFooter.addEventListener('click', () => aboutOverlay.classList.add('hidden'));
    }
    if (aboutOverlay) {
        aboutOverlay.addEventListener('click', (e) => {
            if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden');
        });
    }

    closeReportSheet.addEventListener('click', closeReportUI);
    reportOverlay.addEventListener('click', closeReportUI);

    function closeReportUI() {
        reportBottomSheet.classList.remove('open');
        reportOverlay.classList.remove('open');
    }

    profileModal.addEventListener('click', (e) => {
        if(e.target === profileModal) {
            profileModal.classList.add('hidden');
        }
    });

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
        
        const st = allStations.find(s => s.id === selectedStationId);
        if (st) {
            reportStationName.textContent = st.name;
            reportStationAddress.textContent = st.location_text || st.brand || 'พิจิตร';
        }
        
        reportBottomSheet.classList.add('open');
        reportOverlay.classList.add('open');
        reportFeedback.textContent = '';
        resetReportSelections();
    });

    btnConfirmReport.addEventListener('click', submitBulkReport);

    // ปุ่มกลับไปยังตำแหน่งปัจจุบัน
    const btnMyLocation = document.getElementById('btn-my-location');
    if (btnMyLocation) {
        btnMyLocation.addEventListener('click', () => {
            if (userCoords) {
                map.setView([userCoords.latitude, userCoords.longitude], 14, { animate: true });
            } else {
                alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาเปิด GPS');
                getUserLocation();
            }
        });
    }
});

// กำหนดค่าตั้งต้น
function resetReportSelections() {
    SUPPORTED_FUELS.forEach(f => currentReportSelections[f.id] = 'Unknown');
    renderReportModalOptions();
}

// สร้างปุ่มรายงานแบบ Grid Grouping
function renderReportModalOptions() {
    reportOptionsContainer.innerHTML = '';

    SUPPORTED_FUELS.forEach((fuel) => {
        if (!currentReportSelections[fuel.id]) currentReportSelections[fuel.id] = 'Unknown';
        const currentSelected = currentReportSelections[fuel.id];

        const fuelBlock = document.createElement('div');
        fuelBlock.className = 'fuel-report-group';
        fuelBlock.innerHTML = `
            <div class="fuel-report-header">${fuel.name}</div>
            <div class="report-btn-row">
                <button class="btn-status-select ${currentSelected === 'Available' ? 'selected' : ''}" data-status="Available" data-fuel="${fuel.id}">🟢 มีน้ำมัน</button>
                <button class="btn-status-select ${currentSelected === 'Limited' ? 'selected' : ''}" data-status="Limited" data-fuel="${fuel.id}">🟡 รอนาน</button>
                <button class="btn-status-select ${currentSelected === 'Out of stock' ? 'selected' : ''}" data-status="Out of stock" data-fuel="${fuel.id}">🔴 หมด</button>
                <button class="btn-status-select ${currentSelected === 'Unknown' ? 'selected' : ''}" data-status="Unknown" data-fuel="${fuel.id}">⚪ ไม่ทราบ</button>
            </div>
        `;
        
        reportOptionsContainer.appendChild(fuelBlock);
    });

    // ผูก Event ฝัง Selected Class
    document.querySelectorAll('.btn-status-select').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            const fuelType = btn.getAttribute('data-fuel');
            currentReportSelections[fuelType] = status;
            renderReportModalOptions(); // Re-render to update UI classes easily
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

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
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
    
    let distKw = '-';
    let distanceValue = Infinity;
    if (userCoords && station.location) {
        distanceValue = getDistanceFromLatLonInKm(userCoords.latitude, userCoords.longitude, station.location.latitude, station.location.longitude);
        distKw = distanceValue.toFixed(2);
    }
    const distEl = document.getElementById('sheet-distance-val');
    if (distEl) distEl.textContent = `${distKw} กม.`;

    // ปุ่มนำทาง 📍
    const btnNav = document.getElementById('btn-navigate');
    if (btnNav && station.location) {
        btnNav.href = `https://www.google.com/maps/dir/?api=1&destination=${station.location.latitude},${station.location.longitude}`;
        btnNav.style.display = 'flex';
    } else if (btnNav) {
        btnNav.style.display = 'none';
    }

    // เวลาอัปเดตล่าสุด 🕒
    let latestTime = 0;
    if(station.fuels) {
        for(let key in station.fuels) {
            if(station.fuels[key].lastUpdated) {
                let ms = typeof station.fuels[key].lastUpdated.toMillis === 'function' 
                         ? station.fuels[key].lastUpdated.toMillis() 
                         : new Date(station.fuels[key].lastUpdated).getTime();
                if(ms > latestTime) latestTime = ms;
            }
        }
    }
    const upVal = document.getElementById('sheet-updated-val');
    if(upVal) {
        if(latestTime > 0) {
            const diffMsecs = Date.now() - latestTime;
            const diffMins = Math.floor(diffMsecs / 60000);
            const diffHrs = Math.floor(diffMins / 60);
            if(diffMins < 60) upVal.textContent = diffMins <= 1 ? `เพิ่งอัปเดต` : `อัปเดต ${diffMins} นาทีที่แล้ว`;
            else if(diffHrs < 24) upVal.textContent = `อัปเดต ${diffHrs} ชม.ที่แล้ว`;
            else upVal.textContent = `อัปเดตเมื่อ ${(new Date(latestTime)).toLocaleDateString('th-TH')}`;
        } else {
            upVal.textContent = `ไม่มีข้อมูล`;
        }
    }

    // เช็คระยะทางสำหรับปุ่มรายงานสถานะ (200 เมตร = 0.2 กม.)
    const btnOpenReport = document.getElementById('btn-open-report');
    if (btnOpenReport) {
        if (!userCoords) {
            btnOpenReport.disabled = true;
            btnOpenReport.style.backgroundColor = '#d1d5db';
            btnOpenReport.style.boxShadow = 'none';
            btnOpenReport.textContent = 'กรุณาเปิด GPS พื่อรายงานสถานะ';
            btnOpenReport.style.cursor = 'not-allowed';
            btnOpenReport.style.color = '#4b5563';
        } else if (distanceValue > 0.2) {
            btnOpenReport.disabled = true;
            btnOpenReport.style.backgroundColor = '#d1d5db';
            btnOpenReport.style.boxShadow = 'none';
            btnOpenReport.textContent = 'ต้องอยู่ใกล้ปั๊ม (ในระยะ 200 ม.) เพื่อรายงาน';
            btnOpenReport.style.cursor = 'not-allowed';
            btnOpenReport.style.color = '#4b5563';
        } else {
            btnOpenReport.disabled = false;
            btnOpenReport.style.backgroundColor = 'var(--accent-orange)';
            btnOpenReport.style.boxShadow = '0 4px 12px rgba(255,140,0,0.3)';
            btnOpenReport.textContent = '📝 รายงานสถานะ';
            btnOpenReport.style.cursor = 'pointer';
            btnOpenReport.style.color = 'white';
        }
    }

    // สร้างการ์ดแสดงสถานะน้ำมันแบบ Dynamic บน Bottom Sheet
    sheetFuelGrid.innerHTML = '';
    SUPPORTED_FUELS.forEach(fuel => {
        const currentStatus = station.fuels?.[fuel.id]?.status || 'No data';
        
        // กำหนดสีของการ์ดตามสถานะน้ำมัน
        let bgColor = '#ffffff';
        let borderColor = '#e5e7eb';
        
        if(currentStatus === 'Available') { bgColor = '#ecfdf5'; borderColor = '#a7f3d0'; }
        else if(currentStatus === 'Limited') { bgColor = '#fffbeb'; borderColor = '#fde68a'; }
        else if(currentStatus === 'Out of stock') { bgColor = '#fef2f2'; borderColor = '#fecaca'; }
        else { bgColor = '#f9fafb'; borderColor = '#e5e7eb'; }

        // วาดการ์ดออกมา
        const cardNode = document.createElement('div');
        cardNode.className = 'fuel-card';
        cardNode.style = `background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);`;
        
        cardNode.innerHTML = `
            <div class="fuel-title" style="font-weight:bold; font-size:14px; text-align:center; color: var(--text-main);">${fuel.name}</div>
            <div id="status-${fuel.id}" class="fuel-badge" style="width:100%; text-align:center; border-radius:12px; font-size:13px; font-weight:bold; padding: 6px 0; background-color: white;"></div>
        `;
        sheetFuelGrid.appendChild(cardNode);

        // ใส่สีให้ตรงกับสถานะ
        updateBadge(`status-${fuel.id}`, currentStatus);
    });

    // เปิด Bottom Sheet
    bottomSheet.classList.remove('closed');
    map.panTo([station.location.latitude, station.location.longitude], { animate: true });
}

function closeBottomSheet() {
    bottomSheet.classList.add('closed');
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
                map.setView([userCoords.latitude, userCoords.longitude], 14); // ซูมไปที่ตำแหน่งปัจจุบัน
            },
            (error) => { console.warn("ไม่สามารถดึงตำแหน่ง GPS ได้:", error.message); }
        );
    }
}

async function submitBulkReport() {
    if (!userCoords) {
        reportFeedback.textContent = "โปรดอนุญาตการเข้าถึงตำแหน่ง GPS ของคุณ";
        reportFeedback.style.backgroundColor = '#fee2e2';
        reportFeedback.style.color = '#991b1b';
        return;
    }

    const payloadQueue = [];
    SUPPORTED_FUELS.forEach(f => {
        const val = currentReportSelections[f.id];
        if (val && val !== 'Unknown') {
            payloadQueue.push({ fuelType: f.id, status: val });
        }
    });

    if (payloadQueue.length === 0) {
        reportFeedback.textContent = "คุณเลือก 'ไม่ทราบ' ทั้งหมด กรุณาเลือกสถานะอย่างน้อย 1 ชนิดน้ำมัน";
        reportFeedback.style.backgroundColor = '#fef3c7';
        reportFeedback.style.color = '#92400e';
        return;
    }

    loadingOverlay.classList.remove('hidden');
    reportFeedback.textContent = 'กำลังส่งรายงาน...';
    reportFeedback.style.backgroundColor = 'transparent';
    reportFeedback.style.color = 'var(--text-main)';

    try {
        const token = await getAuthToken();
        if (!token) throw new Error("ไม่พบ Token ยืนยันตัวตน เริ่มระบบใหม่");

        // ส่งทีละ request 
        for (const pd of payloadQueue) {
            const payload = {
                stationId: selectedStationId,
                fuelType: pd.fuelType,
                status: pd.status,
                userLat: userCoords.latitude,
                userLng: userCoords.longitude
            };

            const response = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || "เกิดข้อผิดพลาดในการรายงานบางรายการ");
            }
        }

        reportFeedback.textContent = `ส่งรายงานสำเร็จ! ขอบคุณที่ช่วยเหลือครับ (${payloadQueue.length} รายการ)`;
        reportFeedback.style.backgroundColor = '#dcfce7'; 
        reportFeedback.style.color = '#166534';
        
        setTimeout(() => { 
            reportBottomSheet.classList.remove('open');
            reportOverlay.classList.remove('open');
        }, 2000);

    } catch (error) {
        reportFeedback.textContent = error.message;
        reportFeedback.style.backgroundColor = '#fee2e2';
        reportFeedback.style.color = '#991b1b';
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}
