# =================================================================
# PYTHON FLASK API - V3.3 - LOCAL DEVELOPMENT FIX
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

# --- FIX 1: CORRECTLY LOAD OPENAI KEY FOR LOCAL DEVELOPMENT ---
# This line now correctly uses your hardcoded key as a fallback if the environment variable isn't set.
openai.api_key = os.environ.get(
    'OPENAI_API_KEY',
    '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'
)

# Weather.gov Configuration
WEATHER_STATION_ID = "KDCA"
WEATHER_OBSERVATION_URL = f"https://api.weather.gov/stations/{WEATHER_STATION_ID}/observations/latest"
WEATHER_GRIDPOINTS_URL = f"https://api.weather.gov/points/38.85,-77.03"

# --- FIREBASE INITIALIZATION ---
# This logic is for local development and requires the service key file.
if os.path.exists(SERVICE_ACCOUNT_PATH):
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        initialize_app(cred, {'databaseURL': FIREBASE_URL})
        print("Firebase Initialized Successfully.")
    except ValueError:
        print("Firebase app already initialized.")
else:
    print(f"FATAL: Firebase service key not found at {SERVICE_ACCOUNT_PATH}")


# --- HELPER FUNCTIONS ---
def generate_mock_solar_data(end_time, days=HISTORY_DAYS):
    # This function remains unchanged.
    data = {}
    points_per_hr = 1
    total_points = days * 24 * points_per_hr
    battery_soc = 50.0
    for i in range(total_points):
        t = end_time - timedelta(hours=(total_points - i) / points_per_hr)
        ts = int(t.timestamp())
        hour = t.hour
        if 6 <= hour <= 20:
            sun_factor = 1 - pow((hour - 13) / 7, 2)
            sun_factor = max(0, sun_factor)
        else:
            sun_factor = 0
        noise = random.uniform(0.8, 1.2)
        lux = int(100000 * sun_factor * noise) if sun_factor > 0 else 0
        panel_temp = 20 + (30 * sun_factor * noise)
        voltage = 18.0 + (2.0 * random.uniform(-1, 1)) if sun_factor > 0 else 0
        power = (20.0 * sun_factor * noise)
        current = (power / voltage * 1000) if voltage > 0 else 0
        net_power = power - BASELINE_LOAD_W
        wh_change = net_power * (1.0 / points_per_hr)
        soc_change = (wh_change / BATTERY_CAPACITY_WH) * 100
        battery_soc = max(0, min(100, battery_soc + soc_change))
        key = f"mock_{ts}"
        data[key] = {"timestamp": ts, "sunlight_lux": lux, "panel_temp_c": round(panel_temp, 1),
                     "dc_voltage_v": round(voltage, 2), "dc_current_ma": int(current), "dc_power_w": round(power, 2),
                     "battery_soc_perc": round(battery_soc, 1)}
    return data


def get_telemetry_data():
    ref = db.reference('solar_telemetry')
    seven_days_ago = int((datetime.now() - timedelta(days=HISTORY_DAYS)).timestamp())
    try:
        history = ref.order_by_child('timestamp').start_at(seven_days_ago).get()
        if not history:
            return "No data found in the database.", 404
        return history, 200
    except InvalidArgumentError as e:
        print(f"CRITICAL FIREBASE ERROR: {e}")
        return "Firebase Indexing Error. See console.", 500


# --- ROUTES (Reverted to original local setup) ---
@app.route('/api/weather', methods=['GET'])  # --- FIX 2: RESTORED '/api' prefix
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
        print(f"Weather API request failed: {e}")
        return jsonify({"error": "Failed to retrieve data from weather.gov"}), 503


@app.route('/api/analyze', methods=['POST'])  # --- FIX 2: RESTORED '/api' prefix
def analyze():
    history, status = get_telemetry_data()
    if status != 200: return jsonify({"error": history}), status

    # --- FIX 3: Corrected internal request URL to match the restored route for local development
    weather_response = requests.get('http://127.0.0.1:5000/api/weather')

    if weather_response.status_code != 200:
        return jsonify({"error": "Could not get weather for AI analysis"}), 500

    forecast = weather_response.json().get('forecast')
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
    1.  **Write a forward-looking analysis** (2-3 sentences) based on the weather forecast. Mention expected solar production (e.g., 'good', 'poor due to clouds') and its impact on the battery.
    2.  **Predict the final SOC (%) at midnight tonight.**
    3.  **Predict the total solar energy harvested today in Watt-hours (Wh).**
    4.  **Predict the net energy gain for the battery in Watt-hours (Wh) by midnight.** This is (Total Energy Harvested - Total Energy Consumed by the load). A negative value indicates a net loss.

    Output JSON format:
    {{
        "report": "Your analysis string here...",
        "prediction": {{
            "final_soc": <float>,
            "total_wh": <float>,
            "net_wh_gain": <float>
        }}
    }}
    """
    try:
        if not openai.api_key:
            return jsonify({"error": "OpenAI API key is not configured."}), 500

        print("Calling OpenAI...")
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a solar energy analytic engine. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=300
        )
        content = response['choices'][0]['message']['content']
        data = json.loads(content)
        return jsonify(data), 200

    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # This runs the app on port 5000 for local development.
    app.run(port=5000, debug=True)