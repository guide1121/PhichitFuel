import { db, collection, onSnapshot } from './firebase.js';
import { getCurrentUser, getAuthToken } from './auth.js';

const BACKEND_API_URL = 'https://phichitfuel.onrender.com/api/report';

const SUPPORTED_FUELS = [
    { id: 'Diesel', name: 'ดีเซล (Diesel/B7)' },
    { id: 'Gasohol95', name: 'แก๊สโซฮอล์ 95' },
    { id: 'E20', name: 'E20' },
    { id: 'Gasohol91', name: 'แก๊สโซฮอล์ 91' }
];

let map;
let allStations = [];
let userCoords = null;
let selectedStationId = null;

const stationListContainer = document.getElementById('station-list');
const reportBottomSheet = document.getElementById('report-bottom-sheet');
const reportOverlay = document.getElementById('report-overlay');
const closeReportSheet = document.getElementById('close-report-sheet');
const reportOptionsContainer = document.getElementById('report-options-container');
const reportFeedback = document.getElementById('report-feedback');
const reportStationName = document.getElementById('report-station-name');
const reportStationAddress = document.getElementById('report-station-address');
const btnConfirmReport = document.getElementById('btn-confirm-report');
const loadingOverlay = document.getElementById('loading-overlay');

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    getUserLocation();
    renderReportModalOptions();
    
    btnConfirmReport.addEventListener('click', submitBulkReport);

    closeReportSheet.addEventListener('click', closeReportUI);
    reportOverlay.addEventListener('click', closeReportUI);

    function closeReportUI() {
        reportBottomSheet.classList.remove('open');
        reportOverlay.classList.remove('open');
    }
});

let currentReportSelections = {}; // Store { fuelId: 'Available' | 'Limited' | 'Out of stock' | 'Unknown' }

// กำหนดค่าตั้งต้น
function resetReportSelections() {
    SUPPORTED_FUELS.forEach(f => currentReportSelections[f.id] = 'Unknown');
    renderReportModalOptions();
}

function initMap() {
    map = L.map('report-mini-map', {
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false
    }).setView([16.442, 100.349], 12);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    }).addTo(map);
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                // Update map view
                map.setView([userCoords.latitude, userCoords.longitude], 14);
                
                // Add user marker
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `<div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                L.marker([userCoords.latitude, userCoords.longitude], { icon: userIcon }).addTo(map);

                // Fetch stations after getting location
                listenToStations();
            },
            (error) => {
                console.warn("ไม่สามารถดึงตำแหน่ง GPS ได้:", error.message);
                stationListContainer.innerHTML = `<div style="text-align:center; padding: 20px; color:#EF4444;">ไม่สามารถดึงที่อยู่ปัจจุบันของคุณได้ โปรดเปิดใช้งาน GPS</div>`;
                // Fallback: still listen to stations but show them unsorted via GPS
                listenToStations();
            }
        );
    } else {
        listenToStations();
    }
}

function listenToStations() {
    const stationsRef = collection(db, 'stations');
    onSnapshot(stationsRef, (snapshot) => {
        allStations = [];
        snapshot.forEach(doc => {
            allStations.push({ id: doc.id, ...doc.data() });
        });
        
        processAndRenderStations();
    });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function processAndRenderStations() {
    if (userCoords) {
        allStations.forEach(st => {
            st.distance = getDistanceFromLatLonInKm(
                userCoords.latitude, 
                userCoords.longitude, 
                st.location?.latitude, 
                st.location?.longitude
            );
        });
        
        // Sort by distance
        allStations.sort((a, b) => a.distance - b.distance);
    } else {
        // If no GPS, leave distance as undefined
        allStations.forEach(st => st.distance = null);
    }
    
    // Add markers to mini map
    allStations.forEach(st => {
        if (st.location && st.location.latitude && st.location.longitude) {
            L.circleMarker([st.location.latitude, st.location.longitude], {
                radius: 6,
                fillColor: '#EF4444',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);
        }
    });

    renderList();
}

function renderList() {
    stationListContainer.innerHTML = '';
    
    if (allStations.length === 0) {
        stationListContainer.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted);">ไม่พบข้อมูลปั๊มน้ำมัน</div>`;
        return;
    }
    
    // Render top 15 nearest stations
    const toRender = allStations.slice(0, 15);
    
    toRender.forEach(st => {
        const item = document.createElement('div');
        item.className = 'station-list-item';
        
        // เช็คระยะทางเกิน 200m (0.2km) หรือไม่
        const outOfRange = st.distance !== null && st.distance > 0.2;
        if (outOfRange) {
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
        }

        let distText = '';
        if (st.distance !== null && st.distance !== Infinity) {
            distText = `${st.distance.toFixed(1)} กม.`;
        }
        
        // Display brand or type if available, fallback to 'OTHER'
        let subText = st.brand || 'OTHER';
        if (st.location_text) {
            subText += ` · ${st.location_text}`;
        }
        
        item.innerHTML = `
            <div class="st-info">
                <div class="st-dot ${st.distance && st.distance <= 0.2 ? 'red' : 'gray'}"></div>
                <div class="st-details">
                    <h4 style="color: ${outOfRange ? '#9CA3AF' : 'var(--text-main)'}">${st.name}</h4>
                    <p style="color: ${outOfRange ? '#9CA3AF' : 'var(--text-muted)'}">${subText}</p>
                </div>
            </div>
            <div class="st-distance" style="flex-direction: column; align-items: flex-end;">
                <div style="color: ${outOfRange ? '#EF4444' : 'var(--accent-orange)'}; display:flex; align-items:center; gap:4px;">
                    ${distText}
                    ${!outOfRange ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>` : ''}
                </div>
                ${outOfRange ? `<span style="font-size: 10px; color: #EF4444; margin-top: 4px;">อยู่นอกระยะรายงาน (เกิน 200 ม.)</span>` : ''}
                ${!outOfRange && st.distance === null ? `<span style="font-size: 10px; color: #F59E0B; margin-top: 4px;">กรุณาเปิด GPS</span>` : ''}
            </div>
        `;
        
        item.addEventListener('click', () => {
            openReportModal(st);
        });
        
        stationListContainer.appendChild(item);
    });
}

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

function openReportModal(station) {
    if(!getCurrentUser()) {
        alert("🔒 กรุณาเข้าสู่ระบบก่อนทำการรายงาน\n\nการเข้าสู่ระบบช่วยให้ข้อมูลมีความน่าเชื่อถือและป้องกันการรายงานเท็จครับ (เข้าสู่ระบบได้ที่หน้าแรก)");
        return;
    }
    
    selectedStationId = station.id;
    reportStationName.textContent = station.name;
    reportStationAddress.textContent = station.brand || station.location_text || 'พิจิตร';
    reportFeedback.textContent = '';
    reportFeedback.style.backgroundColor = 'transparent';
    reportBottomSheet.classList.add('open');
    reportOverlay.classList.add('open');
    resetReportSelections();
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
        if (!token) throw new Error("ไม่พบ Token กรุณาเข้าสู่ระบบใหม่");

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

        reportFeedback.textContent = `ขอบคุณที่ช่วยรายงานสถานะ! (${payloadQueue.length} รายการ)`;
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
