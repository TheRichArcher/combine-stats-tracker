import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDTgF4cCRxU0--Fi6nmHCiPqLFrA9aj-AU",
  authDomain: "woo-combine.firebaseapp.com",
  projectId: "woo-combine",
  storageBucket: "woo-combine.appspot.com",
  messagingSenderId: "94393411053",
  appId: "1:94393411053:web:9441e7b38c1985e5c8564",
  measurementId: "G-2M0VP9TQ35"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { app, analytics, auth }; 