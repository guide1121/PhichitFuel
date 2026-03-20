import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJl9Pygh0hfN_opLi8d5BtFaWSqd8nnkc",
  authDomain: "phichit-fuel-connect.firebaseapp.com",
  projectId: "phichit-fuel-connect",
  storageBucket: "phichit-fuel-connect.firebasestorage.app",
  messagingSenderId: "451054728414",
  appId: "1:451054728414:web:657b9f31dc2269c57dfe4f",
  measurementId: "G-3DCWE6RPVW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, onSnapshot };
