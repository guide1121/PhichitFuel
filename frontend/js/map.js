let map;
let markers = [];

// กำหนดพิกัดศูนย์กลางจังหวัดพิจิตร
const PHICHIT_CENTER = [16.446714, 100.348796];

export function initMap() {
    map = L.map('map').setView(PHICHIT_CENTER, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// ฟังก์ชันระบุสีหมุด
function getMarkerColor(status) {
    switch (status) {
        case 'Available': return 'var(--status-green)';
        case 'Limited': return 'var(--status-yellow)';
        case 'Out of stock': return 'var(--status-red)';
        default: return 'var(--status-gray)';
    }
}

// สร้างไอคอน Leaflet แบบวาดเองเพื่อใช้สีได้ตามต้องการ
function createCustomIcon(color) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

export function renderStations(stations, onMarkerClick) {
    // ลบหมุดเก่า
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    stations.forEach(station => {
        if (!station.location) return;

        const { latitude, longitude } = station.location;
        const color = getMarkerColor(station.status);
        const icon = createCustomIcon(color);

        const marker = L.marker([latitude, longitude], { icon }).addTo(map);
        
        marker.bindTooltip(`<b>${station.name}</b><br>สถานะ: ${getStatusText(station.status)}`, {
            direction: 'top',
            offset: [0, -10]
        });

        marker.on('click', () => {
            onMarkerClick(station);
        });

        markers.push(marker);
    });
}

function getStatusText(status) {
    switch (status) {
        case 'Available': return '<span style="color: green">มีน้ำมัน</span>';
        case 'Limited': return '<span style="color: #d4a017">หมดเร็ว/จำกัด</span>';
        case 'Out of stock': return '<span style="color: red">หมด!</span>';
        default: return '<span style="color: gray">ไม่มีข้อมูล</span>';
    }
}

// ฟังก์ชันคำนวณระยะทางบน Client ก่อนยิงไป Backend
export function getDistance(lat1, lon1, lat2, lon2) {
    const p = 0.017453292519943295;    // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)) * 1000; // กลับค่าเป็นเมตร
}
