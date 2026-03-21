import { db } from './firebase.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, onSnapshot, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const auth = getAuth();
let allStations = [];
let userCoords = null;
let currentSort = 'distance'; // 'distance' | 'status'

// DOM Elements
const userNameEl = document.getElementById('data-user-name');
const userStatsEl = document.getElementById('data-user-stats');
const userAvatarEl = document.getElementById('data-user-avatar');
const btnLogout = document.getElementById('data-btn-logout');
const statDieselAvail = document.getElementById('stat-diesel-avail');
const statOutOfStock = document.getElementById('stat-out-of-stock');
const stationListEl = document.getElementById('data-station-list');
const btnSortToggle = document.getElementById('btn-sort-toggle');
const sortLabel = document.getElementById('sort-label');

const SUPPORTED_FUELS = [
    { id: 'Diesel', name: 'ดีเซล', icon: '🟢' },
    { id: 'Gasohol95', name: '95', icon: '🔴' },
    { id: 'Gasohol91', name: '91', icon: '🔴' },
    { id: 'E20', name: 'E20', icon: '⚪' }
];

document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    getUserLocation();
    listenToStations();
    
    btnSortToggle.addEventListener('click', () => {
        currentSort = currentSort === 'distance' ? 'status' : 'distance';
        sortLabel.textContent = currentSort === 'distance' ? 'เรียงตามระยะทาง' : 'เรียงตามสถานะ';
        processAndRenderList();
    });
    
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.reload();
        });
    });
});

function setupAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userNameEl.textContent = user.displayName || 'ผู้ใช้ไม่ประสงค์ออกนาม';
            if (user.photoURL) {
                userAvatarEl.innerHTML = `<img src="${user.photoURL}" alt="Profile">`;
            }
            btnLogout.classList.remove('hidden');
            
            // Fetch Gamification Stats
            try {
                const q = query(collection(db, 'reports'), where('userId', '==', user.uid));
                const snap = await getDocs(q);
                const count = snap.size;
                userStatsEl.textContent = `คุณช่วยชาวพิจิตรรายงานแล้ว: ${count} ครั้ง`;
            } catch (err) {
                console.warn("Failed to fetch user report count", err);
            }
        } else {
            userNameEl.textContent = 'ผู้ใช้งานทั่วไป';
            userStatsEl.textContent = 'เข้าสู่ระบบหนัาแผนที่เพื่อเก็บระยะการรายงาน';
            btnLogout.classList.add('hidden');
        }
    });
}

function listenToStations() {
    const stationsRef = collection(db, 'stations');
    onSnapshot(stationsRef, (snapshot) => {
        allStations = [];
        let dieselAvailCount = 0;
        let anyOutOfStockCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            allStations.push({ id: doc.id, ...data });
            
            // Calculate overall stats
            const f = data.fuels || {};
            if (f.Diesel && f.Diesel.status === 'Available') dieselAvailCount++;
            
            const isOutOfStock = Object.values(f).some(fuel => fuel.status === 'Out of stock');
            if (isOutOfStock) anyOutOfStockCount++;
        });
        
        statDieselAvail.textContent = `${dieselAvailCount} ปั๊ม`;
        statOutOfStock.textContent = `${anyOutOfStockCount} ปั๊ม`;
        
        processAndRenderList();
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

async function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                processAndRenderList();
            },
            (err) => console.warn("GPS failed", err)
        );
    }
}

function processAndRenderList() {
    if (allStations.length === 0) return;
    
    // Compute distance
    allStations.forEach(st => {
        st.distance = getDistanceFromLatLonInKm(
            userCoords?.latitude, userCoords?.longitude, 
            st.location?.latitude, st.location?.longitude
        );
    });
    
    // Sort
    let sorted = [...allStations];
    if (currentSort === 'distance') {
        sorted.sort((a, b) => a.distance - b.distance);
    } else {
        // Sort by status: Available fuels first
        sorted.sort((a, b) => {
            const aAvail = Object.values(a.fuels || {}).filter(f => f.status === 'Available').length;
            const bAvail = Object.values(b.fuels || {}).filter(f => f.status === 'Available').length;
            return bAvail - aAvail;
        });
    }
    
    renderStationsList(sorted.slice(0, 30)); // Show top 30
}

function getStatusPill(fuelDef, fuelData) {
    const statusVal = fuelData?.status || 'Unknown';
    let cssClass = '';
    let icon = '';
    
    if (statusVal === 'Available') { cssClass = 'avail'; icon = '🟢'; }
    else if (statusVal === 'Limited') { cssClass = 'limit'; icon = '🟡'; }
    else if (statusVal === 'Out of stock') { cssClass = 'out'; icon = '🔴'; }
    else { icon = '⚪'; } // No special class = gray
    
    return `<div class="data-status-pill ${cssClass}">${icon} ${fuelDef.name}</div>`;
}

function renderStationsList(stations) {
    stationListEl.innerHTML = '';
    
    stations.forEach(st => {
        const distText = st.distance !== Infinity ? `${st.distance.toFixed(1)} กม.` : '- กม.';
        const fuels = st.fuels || {};
        
        const pillsHtml = SUPPORTED_FUELS.map(fuelDef => {
            return getStatusPill(fuelDef, fuels[fuelDef.id]);
        }).join('');
        
        const card = document.createElement('div');
        card.className = 'data-list-card';
        card.innerHTML = `
            <div class="data-list-card-header">
                <h4 class="data-list-station-name">${st.name}</h4>
                <div class="data-list-station-dist">${distText}</div>
            </div>
            <div class="data-pill-container">
                ${pillsHtml}
            </div>
        `;
        
        stationListEl.appendChild(card);
    });
}
