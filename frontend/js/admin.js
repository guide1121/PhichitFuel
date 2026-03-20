import { db, collection, onSnapshot, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let allStations = [];
const stationList = document.getElementById('station-list');
const searchInput = document.getElementById('search-input');
const adminWarning = document.getElementById('admin-warning');
const adminContent = document.getElementById('admin-content');

// รหัสแอดมิน
const ADMIN_UID = 'gSN5wbt7gETCFcVQODsSJAdZRKh2';

// ฐานข้อมูลน้ำมันที่เราแคร์
const SUPPORTED_FUELS = [
    { id: 'Diesel', name: 'ดีเซล (B7)' },
    { id: 'Gasohol95', name: 'แก๊สโซฮอล์ 95' },
    { id: 'E20', name: 'E20' },
    { id: 'Gasohol91', name: 'แก๊สโซฮอล์ 91' }
];

document.addEventListener('DOMContentLoaded', () => {
    // เช็คสิทธิ์แอดมินก่อน
    onAuthStateChanged(auth, (user) => {
        if (user && user.uid === ADMIN_UID) {
            adminWarning.classList.add('hidden');
            adminContent.classList.remove('hidden');
            listenToStations();
        } else {
            adminWarning.classList.remove('hidden');
            adminContent.classList.add('hidden');
        }
    });

    searchInput.addEventListener('input', () => {
        renderCards(allStations);
    });
});

function listenToStations() {
    const stationsRef = collection(db, 'stations');
    onSnapshot(stationsRef, (snapshot) => {
        allStations = [];
        snapshot.forEach(docSnap => {
            allStations.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // เรียงลำดับตามตัวอักษรนิดหน่อยให้หาง่าย
        allStations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        renderCards(allStations);
    });
}

function renderCards(stations) {
    const term = searchInput.value.toLowerCase();
    stationList.innerHTML = '';

    const filtered = stations.filter(s => (s.name || '').toLowerCase().includes(term));

    filtered.forEach(station => {
        const card = document.createElement('div');
        card.className = 'station-card neumorphic';
        
        // สร้างหัวการ์ด
        let html = `<h3>${station.name}</h3>`;
        html += `<div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">ID: ${station.id}</div>`;

        // สร้าง Dropdown แยกแต่ละประเภทน้ำมัน
        SUPPORTED_FUELS.forEach(fuel => {
            const currentStatus = station.fuels?.[fuel.id]?.status || 'No data';
            
            html += `
            <div class="fuel-edit-row neumorphic-inset">
                <span class="fuel-edit-label">${fuel.name}</span>
                <select id="sel-${station.id}-${fuel.id}" class="fuel-edit-select">
                    <option value="Available" ${currentStatus==='Available'?'selected':''}>🟢 มีน้ำมัน</option>
                    <option value="Limited" ${currentStatus==='Limited'?'selected':''}>🟡 จำกัด/รอนาน</option>
                    <option value="Out of stock" ${currentStatus==='Out of stock'?'selected':''}>🔴 หมด</option>
                    <option value="No data" ${currentStatus==='No data'?'selected':''}>⚪ ไม่มีข้อมูล</option>
                </select>
            </div>
            `;
        });

        // สร้างปุ่ม Save แยกรายปั๊ม
        html += `<button class="btn-save-all" onclick="updateStationAllFuels('${station.id}')">💾 บันทึกการเปลี่ยนแปลง</button>`;
        
        card.innerHTML = html;
        stationList.appendChild(card);
    });
}

// ผูกเข้า Window เพื่อให้ HTML เรียก onclick ได้
window.updateStationAllFuels = async function(stationId) {
    const user = auth.currentUser;
    if (!user || user.uid !== ADMIN_UID) {
        alert('คุณไม่ใช่แอดมิน!');
        return;
    }

    // เตรียมก้อนข้อมูล Update
    const updatePayload = {
        lastUpdated: serverTimestamp()
    };
    
    // สถานะภาพรวม (ถ้าอันไหนมีน้ำมัน ถือว่าปั๊มยังเปิดอยู่)
    let overallStatus = 'Out of stock';
    let hasData = false;

    SUPPORTED_FUELS.forEach(fuel => {
        const selectEl = document.getElementById(`sel-${stationId}-${fuel.id}`);
        if(selectEl) {
            const status = selectEl.value;
            // ใช้ Dot Notation เพื่ออัปเดต Map ย่อยหน้า Firestore อย่างปลอดภัย
            updatePayload[`fuels.${fuel.id}.status`] = status;
            updatePayload[`fuels.${fuel.id}.lastUpdated`] = serverTimestamp();
            
            if(status !== 'No data') hasData = true;
            if(status === 'Available' || status === 'Limited') overallStatus = 'Available';
        }
    });

    if(!hasData) overallStatus = 'No data';
    updatePayload['status'] = overallStatus; // อัปเดตสถานะหลักของหมุดแผนที่

    try {
        const stationRef = doc(db, 'stations', stationId);
        await updateDoc(stationRef, updatePayload);
        alert('อัปเดตข้อมูลสำเร็จ! หน้าเว็บอัปเดตแล้ว 🚀');
    } catch (error) {
        console.error('Update error:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
};
