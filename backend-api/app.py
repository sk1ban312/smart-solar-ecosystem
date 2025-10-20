# Final build trigger fix
# =================================================================
# PYTHON FLASK API - V3.4 - FINAL DEPLOYMENT FIX
# File:C:/Users/Mykyta/PycharmProjects/SmartSolarEcosystem/backend-api/app.py
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
from firebase_admin import credentials, initialize_app, db
from firebase_admin.exceptions import InvalidArgumentError
import requests
import json
import openai
from datetime import datetime, timedelta
import os
import random

# --- FLASK SETUP ---
app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
SERVICE_ACCOUNT_PATH = 'secrets/firebase-service-key.json'
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
BASELINE_LOAD_W = 2.5
HISTORY_DAYS = 7
BATTERY_CAPACITY_WH = 96.0

openai.api_key = os.environ.get('OPENAI_API_KEY')

WEATHER_STATION_ID = "KDCA"
WEATHER_OBSERVATION_URL = f"https://api.weather.gov/stations/{WEATHER_STATION_ID}/observations/latest"
WEATHER_GRIDPOINTS_URL = f"https://api.weather.gov/points/38.85,-77.03"

# --- FIREBASE INITIALIZATION ---
if not initialize_app._apps:
    if os.path.exists(SERVICE_ACCOUNT_PATH):
        print("Local Firebase init")
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        initialize_app(cred, {'databaseURL': FIREBASE_URL})
    else:
        print("Production Firebase init")
        initialize_app(options={'databaseURL': FIREBASE_URL})


# --- HELPER FUNCTIONS ---
def get_telemetry_data():
    ref = db.reference('solar_telemetry')
    seven_days_ago = int((datetime.now() - timedelta(days=HISTORY_DAYS)).timestamp())
    try:
        history = ref.order_by_child('timestamp').start_at(seven_days_ago).get()
        if not history:
            return "No data found in the database.", 404
        return history, 200
    except InvalidArgumentError as e:
        return f"Firebase Indexing Error: {e}", 500


# --- ROUTES ---
@app.route('/weather', methods=['GET'])
def get_weather_data():
    headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
    try:
        obs_res = requests.get(WEATHER_OBSERVATION_URL, headers=headers, timeout=10)
        obs_res.raise_for_status()
        latest_observation = obs_res.json().get('properties', {})

        grid_res = requests.get(WEATHER_GRIDPOINTS_URL, headers=headers, timeout=10)
        grid_res.raise_for_status()
        forecast_hourly_url = grid_res.json()['properties']['forecastHourly']

        forecast_res = requests.get(forecast_hourly_url, headers=headers, timeout=10)
        forecast_res.raise_for_status()
        forecast_periods = forecast_res.json()['properties']['periods'][:12]

        return jsonify({"current_observation": latest_observation, "forecast": forecast_periods}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to retrieve data from weather.gov: {e}"}), 503


@app.route('/analyze', methods=['POST'])
def analyze():
    # --- FIX: GET WEATHER DATA DIRECTLY INSTEAD OF AN INTERNAL API CALL ---
    try:
        weather_headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
        grid_res = requests.get(WEATHER_GRIDPOINTS_URL, headers=weather_headers, timeout=10)
        grid_res.raise_for_status()
        forecast_hourly_url = grid_res.json()['properties']['forecastHourly']
        forecast_res = requests.get(forecast_hourly_url, headers=weather_headers, timeout=10)
        forecast_res.raise_for_status()
        forecast = forecast_res.json()['properties']['periods'][:12]
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Could not get weather for AI analysis: {e}"}), 500
    # --- END OF FIX ---

    history, status = get_telemetry_data()
    if status != 200:
        return jsonify({"error": history}), status

    latest_entry = max(history.values(), key=lambda x: x['timestamp'])
    current_soc = latest_entry['battery_soc_perc']
    history_list = sorted(history.values(), key=lambda x: x['timestamp'])
    short_history = history_list[::4]

    prompt = f"""
    You are a solar energy analyst for a system with a {BATTERY_CAPACITY_WH}Wh Sealed Lead Acid Battery and a {BASELINE_LOAD_W}W constant load.
    Analyze the following data:
    - Current Battery SOC: {current_soc}%
    - Weather Forecast (Next 12h): {json.dumps(forecast)}
    - Recent Performance (Sampled Telemetry): {json.dumps(short_history[-24:])}
    Perform these tasks and respond ONLY with a valid JSON object:
    1.  **Write a forward-looking analysis** (2-3 sentences).
    2.  **Predict the final SOC (%) at midnight tonight.**
    3.  **Predict the total solar energy harvested today in Watt-hours (Wh).**
    4.  **Predict the net energy gain for the battery in Watt-hours (Wh) by midnight.**
    Output JSON format: {{"report": "...", "prediction": {{"final_soc": <float>, "total_wh": <float>, "net_wh_gain": <float>}}}}
    """
    try:
        if not openai.api_key:
            return jsonify({"error": "OpenAI API key is not configured on the server."}), 500

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a solar energy analytic engine. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2, max_tokens=300
        )
        content = response['choices'][0]['message']['content']
        data = json.loads(content)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"AI Error: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)