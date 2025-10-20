# =================================================================
# PYTHON FLASK API - V3.8 - WILDCARD CORS DEBUG
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
logging.info("--- WILDCARD DEBUG SCRIPT STARTING ---")

# --- FLASK SETUP ---
app = Flask(__name__)
logging.info("Flask app created.")

# --- CORS SETUP ---
# THIS IS THE FINAL TEST: Allow ANY website to connect.
CORS(app, resources={r"/*": {"origins": "*"}})
logging.info("CORS configured to allow ALL ORIGINS (*).")

# --- CONFIGURATION ---
FIREBASE_URL = 'https://smart-solar-ecosystem-default-rtdb.firebaseio.com/'
openai.api_key = os.environ.get('OPENAI_API_KEY')
logging.info("Config loaded.")

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
    logging.info("--- Received request for /weather ---")
    return jsonify({"status": "weather ok"}), 200

@app.route('/analyze', methods=['POST'])
def analyze():
    logging.info("--- Received request for /analyze ---")
    return jsonify({"status": "analyze ok"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)