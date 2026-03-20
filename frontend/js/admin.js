import { db, collection, onSnapshot, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let allStations = [];
const stationList = document.getElementById('station-list');
const searchInput = document.getElementById('search-input');
const adminWarning = document.getElementById('admin-warning');
const controls = document.querySelector('.controls');
const tableContainer = document.getElementById('table-container');

// รหัสแอดมินของคุณ
const ADMIN_UID = 'gSN5wbt7gETCFcVQODsSJAdZRKh2';

document.addEventListener('DOMContentLoaded', () => {
    // ซ่อนตารางและช่องค้นหาไว้จนกว่าจะยืนยันตัวตนว่าเป็นแอดมิน
    if(controls) controls.classList.add('hidden');
    if(tableContainer) tableContainer.classList.add('hidden');

    searchInput.addEventListener('input', () => {
        renderTable(allStations);
    });

    // เช็คสิทธิ์การเข้าใช้งาน (ปกปิดข้อมูลถ้าไม่ใช่แอดมิน)
    onAuthStateChanged(auth, (user) => {
        if (user && user.uid === ADMIN_UID) {
            adminWarning.classList.add('hidden');
            if(controls) controls.classList.remove('hidden');
            if(tableContainer) tableContainer.classList.remove('hidden');
            listenToStations(); // เริ่มดึงข้อมูลเฉพาะตอนที่เป็น Admin เท่านั้น
        } else {
            adminWarning.classList.remove('hidden');
            adminWarning.innerHTML = "⚠️ <b>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (Admin Only)</b><br>กรุณาล็อกอินด้วยบัญชีแอดมินเท่านั้น";
            if(controls) controls.classList.add('hidden');
            if(tableContainer) tableContainer.classList.add('hidden');
        }
    });
});

function listenToStations() {
    const stationsRef = collection(db, 'stations');
    onSnapshot(stationsRef, (snapshot) => {
        allStations = [];
        snapshot.forEach(docSnap => {
            allStations.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderTable(allStations);
    });
}

// ฟังก์ชันอัปเดตสถานะ
window.forceUpdateStation = async function(stationId) {
    const user = auth.currentUser;
    if (!user || user.uid !== ADMIN_UID) {
        alert('เซสชันหมดอายุ หรือคุณไม่ใช่แอดมิน!');
        return;
    }

    const selectEl = document.getElementById(`status-${stationId}`);
    const newStatus = selectEl.value;

    try {
        const stationRef = doc(db, 'stations', stationId);
        await updateDoc(stationRef, {
            status: newStatus,
            lastUpdated: serverTimestamp()
        });
        alert('อัปเดตสถานะ ปั๊มน้ำมัน สำเร็จ! ✅');
    } catch (error) {
        console.error('Update error:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
};

function getStatusBadge(status) {
    let color = '#999';
    let text = 'ไม่มีข้อมูล';
    if(status === 'Available') { color = '#22C55E'; text = 'มีน้ำมัน'; }
    if(status === 'Limited') { color = '#EAB308'; text = 'จำกัด/ใกล้หมด'; }
    if(status === 'Out of stock') { color = '#EF4444'; text = 'หมด!'; }
    
    return `<span style="color: white; background-color: ${color}; padding: 4px 8px; border-radius: 12px; font-size: 14px; font-weight: bold;">${text}</span>`;
}

function renderTable(stations) {
    const term = searchInput.value.toLowerCase();
    stationList.innerHTML = '';

    const filtered = stations.filter(s => s.name.toLowerCase().includes(term));

    filtered.forEach(station => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${station.name}</td>
            <td>${getStatusBadge(station.status)}</td>
            <td>
                <select id="status-${station.id}">
                    <option value="Available" ${station.status === 'Available' ? 'selected':''}>มีน้ำมัน</option>
                    <option value="Limited" ${station.status === 'Limited' ? 'selected':''}>จำกัด/ใกล้หมด</option>
                    <option value="Out of stock" ${station.status === 'Out of stock' ? 'selected':''}>หมด!</option>
                    <option value="No data" ${station.status === 'No data' ? 'selected':''}>ไม่มีข้อมูล</option>
                </select>
            </td>
            <td>
                <button class="btn-update" onclick="forceUpdateStation('${station.id}')">บันทึก</button>
            </td>
        `;
        stationList.appendChild(tr);
    });
}
