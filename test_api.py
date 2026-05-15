import requests

# The URL of your local Flask server endpoint
url = "http://127.0.0.1:5000/api/evaluate"

# Update this if your file is named something else, like 'test_audio.m4a' or '.mp3'
file_path = "test_audio.m4a"

try:
    with open(file_path, "rb") as audio_file:
        # Package the file exactly how an HTML form or React app would send it
        files = {"audio": audio_file}
        
        print(f"Sending '{file_path}' to the Flask server...")
        
        # Make the POST request
        response = requests.post(url, files=files)
        
        print(f"\nStatus Code: {response.status_code}")
        print("Response from server:")
        print(response.json())
        
except FileNotFoundError:
    print(f"\n❌ Error: Could not find '{file_path}'. Make sure it is in the same folder as this script.")
except Exception as e:
    print(f"\n❌ Error: {e}")