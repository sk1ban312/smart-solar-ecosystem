# =================================================================
# PYTHON FLASK API - V3.6 - FINAL CORS FIX
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
from firebase_admin import credentials, initialize_app, db
import requests
import openai
from datetime import datetime, timedelta
import os
import logging

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO)
logging.info("--- SCRIPT STARTING ---")

# --- FLASK SETUP ---
app = Flask(__name__)
logging.info("Flask app created.")

# --- CORS SETUP ---
# THIS IS THE FIX: We allow both the main production URL and the Vercel preview URL.
allowed_origins = [
    "https://smart-solar-ecosystem.vercel.app",
    "https://smart-solar-ecosystem-git-main-mykytas-projects-70aca175.vercel.app"
]
CORS(app, resources={r"/*": {"origins": allowed_origins}})
logging.info(f"CORS configured for specific origins: {allowed_origins}")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')

if not openai.api_key:
    logging.warning("!!! OpenAI API key IS NOT SET in environment variables !!!")
else:
    logging.info("OpenAI API key loaded successfully.")

WEATHER_STATION_ID = "KDCA"
WEATHER_OBSERVATION_URL = f"https://api.weather.gov/stations/{WEATHER_STATION_ID}/observations/latest"

# --- FIREBASE INITIALIZATION ---
try:
    logging.info("Attempting Firebase initialization...")
    if not initialize_app._apps:
        logging.info("Production Firebase init using default credentials.")
        initialize_app(options={'databaseURL': FIREBASE_URL})
    logging.info("--- FIREBASE INITIALIZED SUCCESSFULLY ---")
except Exception as e:
    logging.error(f"!!!!!! FIREBASE INITIALIZATION FAILED: {e} !!!!!!", exc_info=True)


# --- ROUTES (Using original, non-debug code) ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        obs_res = requests.get(WEATHER_OBSERVATION_URL, headers=headers, timeout=10)
        obs_res.raise_for_status()
        latest_observation = obs_res.json().get('properties', {})
        return jsonify({"current_observation": latest_observation}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to retrieve data from weather.gov: {e}"}), 503


@app.route('/analyze', methods=['POST'])
def analyze():
    # Note: This is a simplified version of your original logic for clarity
    history_ref = db.reference('solar_telemetry')
    latest_entry = history_ref.order_by_child('timestamp').limit_to_last(1).get()
    if not latest_entry:
        return jsonify({"error": "No data in Firebase"}), 500

    # Get the single item from the dictionary
    latest_data = list(latest_entry.values())[0]
    current_soc = latest_data['battery_soc_perc']

    prompt = f"Analyze the current battery SOC of {current_soc}% and provide a brief solar energy forecast."

    try:
        if not openai.api_key:
            return jsonify({"error": "OpenAI API key is not configured on the server."}), 500

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2, max_tokens=150
        )
        content = response['choices'][0]['message']['content']
        # Create a compatible response structure
        data = {
            "report": content,
            "prediction": {"final_soc": 0, "total_wh": 0, "net_wh_gain": 0}
        }
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"AI Error: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)