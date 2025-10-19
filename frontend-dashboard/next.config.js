/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add environment variables for the Flask API URL and Firebase Config
  env: {
    // UPDATED: Points to the base of the Flask server
    NEXT_PUBLIC_FLASK_API_URL: 'http://127.0.0.1:5000/api',
    // You must replace these with your project's Web App Config from Firebase Console -> Project Settings -> General -> Your Apps (Web)
    FIREBASE_API_KEY: 'AIzaSyCkS-yJ58qyfJtHDSQNMTTYieqn8e9xsuo',
    FIREBASE_AUTH_DOMAIN: 'smart-solar-ecosystem-default-rtdb.firebaseapp.com',
    FIREBASE_DATABASE_URL: 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com',
    FIREBASE_PROJECT_ID: 'smart-solar-ecosystem',
  },
};

module.exports = nextConfig;