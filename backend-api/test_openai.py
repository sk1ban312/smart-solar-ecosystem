import openai
import os
import sys

# ⚠️ CRITICAL: Replace with your actual key starting with 'sk-'
# This will be printed to the console, so be careful!
openai.api_key = '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'

try:
    print("--- Starting OpenAI Test ---")
    print(f"Key being used: {openai.api_key[:10]}...")  # Print a snippet

    # Minimal call to check authentication
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Hello"}
        ],
        temperature=0
    )

    print("\n--- TEST SUCCESS ---")
    print("API Key is VALID.")
    print("Response Status:", response.choices[0].finish_reason)

except openai.error.AuthenticationError as e:
    print("\n--- TEST FAILURE ---")
    print(f"OpenAI Authentication Error: Your API key is rejected.")
    print(f"Error Details: {e}")
    sys.exit(1)

except Exception as e:
    print("\n--- TEST FAILURE ---")
    print(f"General Error (Network/Other): {type(e).__name__}")
    print(f"Error Details: {e}")
    sys.exit(1)