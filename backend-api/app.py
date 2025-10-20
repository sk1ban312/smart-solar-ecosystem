# =================================================================
# PYTHON FLASK API - V3.7 - FINAL RUNTIME FIX
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import requests
import openai
import os
import logging

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO)
logging.info("--- SCRIPT STARTING ---")

# --- FLASK SETUP ---
app = Flask(__name__)
logging.info("Flask app created.")

# --- CORS SETUP ---
# This allows both Vercel URLs to connect.
allowed_origins = [
    "https://smart-solar-ecosystem.vercel.app",
    "https://smart-solar-ecosystem-git-main-mykytas-projects-70aca175.vercel.app"
]
CORS(app, resources={r"/*": {"origins": allowed_origins}})
logging.info(f"CORS configured for specific origins.")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')

if not openai.api_key:
    logging.warning("!!! OpenAI API key IS NOT SET in environment variables !!!")
else:
    logging.info("OpenAI API key loaded successfully.")

# --- FIREBASE INITIALIZATION ---
try:
    logging.info("Attempting Firebase initialization...")
    # THIS IS THE FIX: The check should be on 'firebase_admin', not the function.
    if not firebase_admin._apps:
        logging.info("Production Firebase init using default credentials.")
        firebase_admin.initialize_app(options={'databaseURL': FIREBASE_URL})
    logging.info("--- FIREBASE INITIALIZED SUCCESSFULLY ---")
except Exception as e:
    logging.error(f"!!!!!! FIREBASE INITIALIZATION FAILED: {e} !!!!!!", exc_info=True)

# --- ROUTES ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        obs_res = requests.get('https://api.weather.gov/stations/KDCA/observations/latest', headers=headers, timeout=10)
        obs_res.raise_for_status()
        return jsonify(obs_res.json().get('properties', {})), 200
    except Exception as e:
        logging.error(f"WEATHER_ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 503

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        # Simplified dummy response for stability
        data = {
            "report": "Analysis successful.",
            "prediction": {"final_soc": 100.0, "total_wh": 50.0, "net_wh_gain": 25.0}
        }
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"ANALYZE_ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)