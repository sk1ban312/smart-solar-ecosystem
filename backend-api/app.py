# =================================================================
# PYTHON FLASK API - V6.1 - FINAL TYPO FIX
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import requests
import json
import openai
from datetime import datetime, timedelta  # Ensure timedelta is imported
import os
import logging

# --- SETUP LOGGING ---
logging.basicConfig(level=logging.INFO)

# --- FLASK SETUP ---
app = Flask(__name__)

# --- CORS SETUP ---
CORS(app, resources={r"/*": {"origins": "*"}})
logging.info("CORS configured to allow ALL ORIGINS (*).")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')
WEATHER_GRIDPOINTS_URL = "https://api.weather.gov/points/38.85,-77.03"
HISTORY_DAYS = 7  # Define HISTORY_DAYS

# --- FIREBASE INITIALIZATION ---
try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={'databaseURL': FIREBASE_URL})
    logging.info("--- FIREBASE INITIALIZED SUCCESSFULLY ---")
except Exception as e:
    logging.error(f"FATAL: FIREBASE INITIALIZATION FAILED: {e}", exc_info=True)


# --- ROUTES ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        obs_res = requests.get("https://api.weather.gov/stations/KDCA/observations/latest", headers=headers, timeout=15)
        obs_res.raise_for_status()
        weather_properties = obs_res.json().get('properties', {})
        return jsonify({"current_observation": weather_properties}), 200
    except Exception as e:
        logging.error(f"WEATHER_ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 503


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        logging.info("--- ANALYZE START ---")

        # 1. Fetch Weather Forecast
        weather_headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
        grid_res = requests.get(WEATHER_GRIDPOINTS_URL, headers=weather_headers, timeout=15)
        grid_res.raise_for_status()
        forecast_hourly_url = grid_res.json()['properties']['forecastHourly']
        forecast_res = requests.get(forecast_hourly_url, headers=weather_headers, timeout=15)
        forecast_res.raise_for_status()
        forecast = forecast_res.json()['properties']['periods'][:12]

        # 2. Fetch Firebase Data
        ref = db.reference('solar_telemetry')
        # THIS IS THE FIX: Use 'timedelta' (lowercase)
        seven_days_ago = int((datetime.now() - timedelta(days=HISTORY_DAYS)).timestamp())
        history = ref.order_by_child('timestamp').start_at(seven_days_ago).get()
        if not history:
            return jsonify({"error": "No recent telemetry data found"}), 404

        latest_entry = max(history.values(), key=lambda x: x['timestamp'])
        current_soc = latest_entry['battery_soc_perc']

        # 3. Construct the "Smart" OpenAI Prompt
        prompt = f"""
        As a solar analyst for a 20W panel system in Washington D.C., analyze the current battery SOC of {current_soc}% and the following weather forecast: {json.dumps(forecast, indent=2)}.

        Tasks:
        1.  Provide a short, 2-sentence analysis of today's solar generation potential.
        2.  Predict the total solar energy generated for the day in Watt-hours (Wh).
        3.  Predict the net energy gain for the battery in Watt-hours (Wh).

        Respond ONLY with a valid JSON object in this exact format:
        {{"report": "<Your analysis>", "prediction": {{"total_wh": <float>, "net_wh_gain": <float>}}}}
        """

        # 4. Call OpenAI API
        if not openai.api_key:
            return jsonify({"error": "OpenAI API key is not configured."}), 500

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a solar energy analytic engine. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        content = response['choices'][0]['message']['content']
        data = json.loads(content)

        if 'prediction' in data and isinstance(data['prediction'], dict):
            data['prediction']['final_soc'] = 0.0

        logging.info("--- ANALYZE SUCCESS ---")
        return jsonify(data), 200

    except Exception as e:
        logging.error(f"!!! UNHANDLED EXCEPTION in /analyze: {e} !!!", exc_info=True)
        return jsonify({"error": f"An error occurred during analysis: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)