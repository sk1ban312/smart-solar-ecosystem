// File: frontend-dashboard/src/firebase.js
import { initializeApp } from "firebase/app";
// IMPORT the necessary functions from the correct module
import { getDatabase, ref, onValue, query, limitToLast } from "firebase/database";

// Your web app's Firebase configuration (from next.config.js env variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export all necessary functions
export { database, ref, onValue, query, limitToLast };