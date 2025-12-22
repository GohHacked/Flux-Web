import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBEEQSDNuXYrv8dtyg6p7He8_SXZI4CvFo",
  authDomain: "studio-2779543933-f5e22.firebaseapp.com",
  databaseURL: "https://studio-2779543933-f5e22-default-rtdb.firebaseio.com",
  projectId: "studio-2779543933-f5e22",
  storageBucket: "studio-2779543933-f5e22.firebasestorage.app",
  messagingSenderId: "84880584200",
  appId: "1:84880584200:web:d0122b3cf1c354ca45abbd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);