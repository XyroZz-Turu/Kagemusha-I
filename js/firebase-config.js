// Firebase config & inisialisasi shared - dipakai semua halaman
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  getDocs,
  limit,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3ZNKnOY015DLroxtLQPpAdHvHh0pjcoM",
  authDomain: "kagemusha-d1f45.firebaseapp.com",
  projectId: "kagemusha-d1f45",
  storageBucket: "kagemusha-d1f45.firebasestorage.app",
  messagingSenderId: "110783717034",
  appId: "1:110783717034:web:c7fc259629934426893ad3",
  measurementId: "G-NFH8K6G0F8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");

// reCAPTCHA site key (dipakai di login.html)
export const RECAPTCHA_SITE_KEY = "6LdaPZ8tAAAAAMMNSph4YpEeu2AvF1Y5aNW7D0c0";

export {
  app,
  auth,
  db,
  functions,
  httpsCallable,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  getDocs,
  limit,
  orderBy
};

