import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase.js';

const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');

let currentUser = null;

// ให้บริการข้อมูล User แก่ไฟล์อื่นๆ
export const getCurrentUser = () => currentUser;
export const getAuthToken = async () => {
    if (currentUser) {
        return await currentUser.getIdToken();
    }
    return null;
};

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
        btnLogin.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userName.textContent = `สวัสดี, ${user.displayName}`;
    } else {
        currentUser = null;
        btnLogin.classList.remove('hidden');
        userInfo.classList.add('hidden');
    }
});
