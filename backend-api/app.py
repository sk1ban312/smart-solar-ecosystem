# =================================================================
# PYTHON FLASK API - V3.5 - HEAVY DEBUGGING
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
from firebase_admin import credentials, initialize_app, db
import requests
import json
import openai
from datetime import datetime, timedelta
import os
import logging

# --- SETUP LOGGING ---
# This will make our logs show up clearly in Google Cloud.
logging.basicConfig(level=logging.INFO)

logging.info("--- SCRIPT STARTING ---")

# --- FLASK SETUP ---
app = Flask(__name__)
logging.info("Flask app created.")

# --- CORS SETUP ---
CORS(app, resources={r"/*": {"origins": "https://smart-solar-ecosystem.vercel.app"}})
logging.info("CORS configured for vercel.app origin.")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')

if not openai.api_key:
    logging.warning("!!! OpenAI API key IS NOT SET in environment variables !!!")
else:
    logging.info("OpenAI API key loaded successfully.")

WEATHER_STATION_ID = "KDCA"
WEATHER_OBSERVATION_URL = f"https://api.weather.gov/stations/{WEATHER_STATION_ID}/observations/latest"
WEATHER_GRIDPOINTS_URL = f"https://api.weather.gov/points/38.85,-77.03"

# --- FIREBASE INITIALIZATION ---
try:
    logging.info("Attempting Firebase initialization...")
    if not initialize_app._apps:
        # This is how it runs in Cloud Run. It relies on the IAM permission.
        logging.info("Production Firebase init using default credentials.")
        initialize_app(options={'databaseURL': FIREBASE_URL})
    logging.info("--- FIREBASE INITIALIZED SUCCESSFULLY ---")
except Exception as e:
    # If this fails, the app will crash, and we'll see it in the logs.
    logging.error(f"!!!!!! FIREBASE INITIALIZATION FAILED: {e} !!!!!!", exc_info=True)

# --- ROUTES ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    logging.info("--- Received request for /weather ---")
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        logging.info(f"Fetching weather from: {WEATHER_OBSERVATION_URL}")
        obs_res = requests.get(WEATHER_OBSERVATION_URL, headers=headers, timeout=15)
        obs_res.raise_for_status()
        latest_observation = obs_res.json().get('properties', {})
        logging.info("Successfully fetched weather observation.")

        response_data = {"current_observation": latest_observation, "forecast": []} # Simplified for debugging
        logging.info("--- /weather request successful. Sending JSON response. ---")
        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"!!!!!! /weather UNKNOWN ERROR: {e} !!!!!!", exc_info=True)
        return jsonify({"error": f"An unknown error occurred in /weather: {e}"}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    logging.info("--- Received request for /analyze ---")
    try:
        dummy_data = {
            "report": "Analysis is temporarily disabled for debugging.",
            "prediction": {"final_soc": 0.0, "total_wh": 0.0, "net_wh_gain": 0.0}
        }
        logging.info("--- /analyze request successful. Sending dummy JSON response. ---")
        return jsonify(dummy_data), 200
    except Exception as e:
        logging.error(f"!!!!!! /analyze UNKNOWN ERROR: {e} !!!!!!", exc_info=True)
        return jsonify({"error": f"An unknown error occurred in /analyze: {e}"}), 500

# This part is only for local testing. Gunicorn runs the app in production.
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)