import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';

const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');
const btnAdmin = document.getElementById('btn-admin');

const ADMIN_UID = 'gSN5wbt7gETCFcVQODsSJAdZRKh2';

let currentUser = null;

// ให้บริการข้อมูล User แก่ไฟล์อื่นๆ
export const getCurrentUser = () => currentUser;
export const getAuthToken = async () => {
    if (currentUser) {
        return await currentUser.getIdToken();
    }
    return null;
};

// ...

// จัดการ Login
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Login Error:', error);
            alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + error.message);
        }
    });
}

// จัดการ Logout
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout Error:', error);
        }
    });
}

// อัปเดต UI เมื่อสถานะเปลี่ยน
onAuthStateChanged(auth, (user) => {
    const btnProfile = document.getElementById('btn-profile');
    if (user) {
        currentUser = user;
        if(btnLogin) btnLogin.classList.add('hidden');
        if(userInfo) userInfo.classList.remove('hidden');
        if(userName) userName.textContent = `สวัสดี, ${user.displayName}`;
        
        // เล็กๆ สำหรับบน Navbar หลังจากเข้าสู่ระบบแล้ว
        if(btnProfile) {
            btnProfile.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" style="margin-right: 6px;">
                    <circle cx="12" cy="8" r="4" stroke="#1F2937" stroke-width="2"/>
                    <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span style="font-size:14px; font-weight:bold;">${user.displayName.split(' ')[0]}</span>
            `;
        }
        
        // โชว์ปุ่ม Admin เฉพาะแอดมินตัวจริง
        if(btnAdmin) {
            if(user.uid === ADMIN_UID) {
                btnAdmin.classList.remove('hidden');
            } else {
                btnAdmin.classList.add('hidden');
            }
        }
    } else {
        currentUser = null;
        if(btnLogin) btnLogin.classList.remove('hidden');
        if(userInfo) userInfo.classList.add('hidden');
        if(btnAdmin) btnAdmin.classList.add('hidden');
        
        if(btnProfile) {
            btnProfile.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style="font-size:14px; font-weight:bold; color:#1F2937;">เข้าสู่ระบบ</span>
            `;
        }
    }
});
