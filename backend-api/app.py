# =================================================================
# PYTHON FLASK API - V5.0 - FINAL PRODUCTION (WEATHER FIX)
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import requests
import json
import openai
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
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')
WEATHER_GRIDPOINTS_URL = "https://api.weather.gov/points/38.85,-77.03"
BASELINE_LOAD_W = 2.5
BATTERY_CAPACITY_WH = 96.0
HISTORY_DAYS = 7

# --- FIREBASE INITIALIZATION ---
try:
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
        weather_properties = obs_res.json().get('properties', {})
        # THIS IS THE FIX: Wrap the data in the "current_observation" key that the frontend expects.
        return jsonify({"current_observation": weather_properties}), 200
    except Exception as e:
        logging.error(f"WEATHER_ERROR: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 503

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        weather_headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
        grid_res = requests.get(WEATHER_GRIDPOINTS_URL, headers=weather_headers, timeout=10)
        grid_res.raise_for_status()
        forecast_hourly_url = grid_res.json()['properties']['forecastHourly']
        forecast_res = requests.get(forecast_hourly_url, headers=weather_headers, timeout=10)
        forecast_res.raise_for_status()
        forecast = forecast_res.json()['properties']['periods'][:12]

        ref = db.reference('solar_telemetry')
        seven_days_ago = int((datetime.now() - timedelta(days=HISTORY_DAYS)).timestamp())
        history = ref.order_by_child('timestamp').start_at(seven_days_ago).get()
        if not history:
             return jsonify({"error": "No recent telemetry data found"}), 404

        latest_entry = max(history.values(), key=lambda x: x['timestamp'])
        current_soc = latest_entry['battery_soc_perc']
        short_history = sorted(history.values(), key=lambda x: x['timestamp'])[-24:]

        prompt = f"""
        You are a solar energy analyst for a system with a {BATTERY_CAPACITY_WH}Wh battery and a {BASELINE_LOAD_W}W constant load.
        Analyze the following data:
        - Current Battery SOC: {current_soc}%
        - Weather Forecast (Next 12h): {json.dumps(forecast)}
        - Recent Performance: {json.dumps(short_history)}
        Perform these tasks and respond ONLY with a valid JSON object:
        1.  **Write a forward-looking analysis** (2-3 sentences).
        2.  **Predict the final SOC (%) at midnight tonight.**
        3.  **Predict the total solar energy harvested today in Watt-hours (Wh).**
        4.  **Predict the net energy gain for the battery in Watt-hours (Wh) by midnight.**
        Output JSON format: {{"report": "...", "prediction": {{"final_soc": <float>, "total_wh": <float>, "net_wh_gain": <float>}}}}
        """

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
        logging.error(f"ANALYZE_ERROR: {e}", exc_info=True)
        return jsonify({"error": f"An error occurred during analysis: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)