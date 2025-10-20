# =================================================================
# PYTHON FLASK API - V7.0 - FINAL SMART AI
# =================================================================
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import requests
import json
import openai
from datetime import datetime, timedelta
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
PANEL_WATTAGE = 20.0  # Define the panel size

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
        logging.info("--- SMART ANALYZE START ---")

        # 1. Fetch Weather Forecast
        weather_headers = {'User-Agent': '(Smart Solar Project, mykyta.sokoliuk@gmail.com)'}
        grid_res = requests.get(WEATHER_GRIDPOINTS_URL, headers=weather_headers, timeout=15)
        grid_res.raise_for_status()
        forecast_hourly_url = grid_res.json()['properties']['forecastHourly']
        forecast_res = requests.get(forecast_hourly_url, headers=weather_headers, timeout=15)
        forecast_res.raise_for_status()
        forecast = forecast_res.json()['properties']['periods'][:12]

        # 2. Construct the "Smart" OpenAI Prompt
        prompt = f"""
        You are a solar energy analyst. Your task is to calculate a realistic energy generation prediction for a small, single {PANEL_WATTAGE}W solar panel in Washington D.C. for the rest of today.

        Here is the critical information:
        - Panel Size: {PANEL_WATTAGE} Watts. In one hour of perfect, direct, peak sunlight, it generates {PANEL_WATTAGE}Wh.
        - Reality Check: Cloudy conditions, rain, and low sun angle drastically reduce output. A realistic daily total for a panel this size is often between 40Wh and 120Wh. Your prediction must be in this range.
        - Today's Weather Forecast: {json.dumps(forecast, indent=2)}

        Perform these steps:
        1.  Analyze the forecast for cloud cover, rain, and sun. Estimate the number of "equivalent peak sun hours" for the rest of the day (a number likely between 1 and 6).
        2.  Calculate the "Expected Energy" (total generation in Wh) by multiplying the panel wattage by your estimated sun hours. This is the most important number.
        3.  Calculate a "Net Energy Gain" by subtracting an estimated 20Wh for system power consumption from your Expected Energy.
        4.  Write a brief, 2-sentence justification for your prediction, mentioning the key weather factors (e.g., "partly cloudy," "afternoon showers").

        Respond ONLY with a valid JSON object in this exact format:
        {{"report": "<Your 2-sentence justification>", "prediction": {{"total_wh": <float>, "net_wh_gain": <float>}}}}
        """

        # 3. Call OpenAI API
        if not openai.api_key:
            return jsonify({"error": "OpenAI API key is not configured."}), 500

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a solar energy analyst outputting only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        content = response['choices'][0]['message']['content']
        data = json.loads(content)

        # Add a dummy final_soc for frontend compatibility
        if 'prediction' in data and isinstance(data['prediction'], dict):
            data['prediction']['final_soc'] = 0.0

        logging.info("--- SMART ANALYZE SUCCESS ---")
        return jsonify(data), 200

    except Exception as e:
        logging.error(f"!!! UNHANDLED EXCEPTION in /analyze: {e} !!!", exc_info=True)
        return jsonify({"error": f"An error occurred during analysis: {e}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
    ```

