import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-functions.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyBDaCq64baSoA8UIBpHC0XhztZIYR939bI",
  authDomain: "webapp-bcb37.firebaseapp.com",
  projectId: "webapp-bcb37",
  storageBucket: "webapp-bcb37.firebasestorage.app",
  messagingSenderId: "666038503161",
  appId: "1:666038503161:web:627221bf0e839c26db8428",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-southeast1");
const storage = getStorage(app); 
export { app, auth, db, functions, storage };