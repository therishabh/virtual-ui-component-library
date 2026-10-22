// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "virtual-ui-e5575.firebaseapp.com",
  projectId: "virtual-ui-e5575",
  storageBucket: "virtual-ui-e5575.firebasestorage.app",
  messagingSenderId: "100956968390",
  appId: "1:100956968390:web:901f3fe469a435421ccec7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();

