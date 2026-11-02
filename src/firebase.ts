import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1Q0SfVGERVPm11zFwtj4kZpbSmGgLPXQ",
  authDomain: "day-treats-brazilian-bakery.firebaseapp.com",
  projectId: "day-treats-brazilian-bakery",
  storageBucket: "day-treats-brazilian-bakery.firebasestorage.app",
  messagingSenderId: "51026355146",
  appId: "1:51026355146:web:e5064e3e4d3642a956a533",
  measurementId: "G-D1ZXK59077"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
