// File: frontend-dashboard/src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, query, limitToLast } from "firebase/database";

// Your web app's Firebase configuration from Vercel environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export all necessary functions
export { database, ref, onValue, query, limitToLast };