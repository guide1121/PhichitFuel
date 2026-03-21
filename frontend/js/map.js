export const map = L.map('map', { 
    zoomControl: false, 
    attributionControl: false // ซ่อนลายน้ำ default เพื่อความสะอาดตา
    }).setView([16.442, 100.348], 13); // กลางเมืองพิจิตร

// เพิ่มปุ่ม Zoom ขวาล่าง
L.control.zoom({ position: 'bottomright' }).addTo(map);

// ใช้งาน Google Maps (Standard Map) เพื่อให้หมุดสว่างขึ้น
L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
}).addTo(map);

// สร้างไอคอน Leaflet ทรงกลมลอย ล้อมกรอบรอบถังน้ำมันเพื่อความโฉบเฉี่ยว
export function createCustomIcon(color) {
    const fuelSvg = `<svg viewBox="0 0 24 24" fill="white" style="width:18px; height:18px;"><path d="M19 19V5C19 3.89543 18.1046 3 17 3H7C5.89543 3 5 3.89543 5 5V19H19ZM7 5H17V19H7V5ZM9 7H15V11H9V7ZM6 20H18V22H6V20Z"/></svg>`;

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: ${color}; 
            width: 40px; 
            height: 40px; 
            border-radius: 50%; 
            border: 3px solid rgba(255,255,255,0.9); 
            box-shadow: 4px 6px 12px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(0,0,0,0.2);
            display: flex; justify-content: center; align-items: center;
            transition: transform 0.2s;">
            ${fuelSvg}
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// Marker สถานที่ผู้ใช้ (Glow Dot)
let userMarker = null;
export function updateUserLocationMarker(lat, lng) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    const glowDot = L.divIcon({
        className: 'user-glow-icon',
        html: `<div style="
            width: 20px; height: 20px; 
            background-color: #3b82f6; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 0 15px 5px rgba(59, 130, 246, 0.6);
            animation: pulse 2s infinite;">
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    userMarker = L.marker([lat, lng], {icon: glowDot}).addTo(map);
}

// ระบบจัดการ Marker ของปั๊มน้ำมัน
let stationMarkers = [];

export function renderStations(stations, onMarkerClick) {
    // ลบอันเก่าออกให้หมดก่อน
    stationMarkers.forEach(m => map.removeLayer(m));
    stationMarkers = [];

    stations.forEach(station => {
        // ป้องกัน Error หากมีข้อมูลในฐานข้อมูลที่ไม่มี field location
        if (!station.location || typeof station.location.latitude === 'undefined') return;

        let color = '#9ca3af'; // Gray default
        if(station.status === 'Available') color = '#10b981'; // Green
        else if(station.status === 'Limited') color = '#f59e0b'; // Yellow
        else if(station.status === 'Out of stock') color = '#ef4444'; // Red

        const icon = createCustomIcon(color);
        const marker = L.marker([station.location.latitude, station.location.longitude], {icon: icon}).addTo(map);
        
        marker.on('click', () => {
            if(onMarkerClick) onMarkerClick(station);
        });

        stationMarkers.push(marker);
    });
}

// เพิ่ม Animation Pulse สำหรับ User Dot ลงในหน้าเอกสาร
const style = document.createElement('style');
style.innerHTML = `
@keyframes pulse {
    0% { box-shadow: 0 0 15px 0px rgba(59, 130, 246, 0.6); }
    50% { box-shadow: 0 0 25px 10px rgba(59, 130, 246, 0.3); }
    100% { box-shadow: 0 0 15px 0px rgba(59, 130, 246, 0.6); }
}`;
document.head.appendChild(style);
