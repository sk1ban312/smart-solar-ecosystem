# =================================================================
# PYTHON FLASK API - V4.1 - FINAL RUNTIME FIX
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin  # IMPORT THE MAIN LIBRARY
from firebase_admin import credentials, db
import requests
import json
import openai
import os
import logging

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO)
logging.info("--- PRODUCTION SCRIPT STARTING ---")

# --- FLASK SETUP ---
app = Flask(__name__)

# --- CORS SETUP ---
# Allow all origins for maximum compatibility
CORS(app, resources={r"/*": {"origins": "*"}})
logging.info("CORS configured to allow ALL ORIGINS (*).")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')
WEATHER_GRIDPOINTS_URL = "https://api.weather.gov/points/38.85,-77.03"

# --- FIREBASE INITIALIZATION ---
try:
    # THIS IS THE FIX: The check must be on the 'firebase_admin' library itself.
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={'databaseURL': FIREBASE_URL})
    logging.info("--- FIREBASE INITIALIZED SUCCESSFULLY ---")
except Exception as e:
    logging.error(f"!!!!!! FIREBASE INITIALIZATION FAILED: {e} !!!!!!", exc_info=True)


# --- ROUTES ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        obs_res = requests.get("https://api.weather.gov/stations/KDCA/observations/latest", headers=headers, timeout=10)
        obs_res.raise_for_status()
        return jsonify(obs_res.json().get('properties', {})), 200
    except Exception as e:
        logging.error(f"WEATHER_ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 503

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if not openai.api_key:
            raise ValueError("OpenAI API key is not configured.")

        # This is a dummy response to prove the endpoint works.
        # We can add the full AI logic back after this is successful.
        dummy_response = {
            "report": "AI analysis is connected and working.",
            "prediction": {
                "final_soc": 100.0,
                "total_wh": 55.5,
                "net_wh_gain": 22.2
            }
        }
        return jsonify(dummy_response), 200

    except Exception as e:
        logging.error(f"ANALYZE_ERROR: {e}", exc_info=True)
        return jsonify({"error": f"An error occurred during analysis: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)