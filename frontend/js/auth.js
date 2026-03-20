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
    if (user) {
        currentUser = user;
        if(btnLogin) btnLogin.classList.add('hidden');
        if(userInfo) userInfo.classList.remove('hidden');
        if(userName) userName.textContent = `สวัสดี, ${user.displayName}`;
        
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
    }
});
