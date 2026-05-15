import os
import requests # NEW: For talking to Ollama
import json

import nvidia.cublas
import nvidia.cudnn

# 1. Get the correct Windows paths
cublas_bin_path = os.path.join(nvidia.cublas.__path__[0], "bin")
cudnn_bin_path = os.path.join(nvidia.cudnn.__path__[0], "bin")

print(f"Injecting cuBLAS DLLs from: {cublas_bin_path}")
print(f"Injecting cuDNN DLLs from: {cudnn_bin_path}")

# 2. Tell Python where they are
os.add_dll_directory(cublas_bin_path)
os.add_dll_directory(cudnn_bin_path)

# 3. CRITICAL FIX: Tell the C++ engine where they are
os.environ['PATH'] = cublas_bin_path + os.pathsep + cudnn_bin_path + os.pathsep + os.environ.get('PATH', '')

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel

app = Flask(__name__)
CORS(app)

print("Loading 'small.en' model onto GPU...")
model = WhisperModel("small.en", device="cpu", compute_type="int8")
print("✅ Whisper Model loaded. Flask server is ready.")

@app.route('/api/evaluate', methods=['POST'])
def evaluate_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided in the request"}), 400
        
    audio_file = request.files['audio']
    temp_path = "temp_audio.wav"
    audio_file.save(temp_path)
    
    try:
        # --- PART 1: AUDIO TO TEXT (WHISPER) ---
        print("Transcribing audio...")
        segments, info = model.transcribe(temp_path, beam_size=5)
        transcript = " ".join([segment.text for segment in segments]).strip()
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        print(f"Transcription complete: {transcript}")
        
        # --- PART 2: TEXT TO LLM (OLLAMA) ---
        print("Sending to Ollama for evaluation...")
        
        # NOTE: Change "llama3" to "mistral" or whatever model you have installed
        target_model = "llama3.1:8b" 
        
        system_prompt = f"""
        You are an expert technical interviewer. Analyze the following candidate response.
        Provide your feedback strictly in JSON format with exactly three keys: 
        'score' (a number out of 10), 
        'feedback' (your analysis of their answer), 
        'missing_context' (what they should have said to improve based on the STAR method).
        
        Candidate Response: "{transcript}"
        """
        
        ollama_payload = {
            "model": target_model,
            "prompt": system_prompt,
            "stream": False,
            "format": "json" 
        }
        
        # Send the request to your local Ollama server
        ollama_response = requests.post("http://localhost:11434/api/generate", json=ollama_payload)
        
        # DEBUG CHECK: Did Ollama return an error?
        if ollama_response.status_code != 200:
            print(f"❌ OLLAMA ERROR: {ollama_response.text}")
            llm_json = {"error": f"Ollama returned status {ollama_response.status_code}", "details": ollama_response.text}
        else:
            # Extract the raw string from Ollama
            raw_response_data = ollama_response.json()
            llm_result_string = raw_response_data.get('response', '{}')
            
            print(f"🤖 RAW OLLAMA OUTPUT:\n{llm_result_string}\n")
            
            try:
                # Parse it into a real Python dictionary
                llm_json = json.loads(llm_result_string)
            except Exception as parse_error:
                print(f"❌ JSON PARSE ERROR: {parse_error}")
                llm_json = {"error": "Failed to parse JSON", "raw_text": llm_result_string}
        
        print("✅ Evaluation complete!")
        
        return jsonify({
            "status": "success",
            "transcript": transcript,
            "evaluation": llm_json
        })
        
        # Send the request to your local Ollama server
        ollama_response = requests.post("http://localhost:11434/api/generate", json=ollama_payload)
        
        # Extract the JSON string from Ollama's response
        llm_result_string = ollama_response.json().get('response', '{}')
        
        # Parse it into a real Python dictionary
        llm_json = json.loads(llm_result_string)
        
        print("✅ Evaluation complete!")
        
        return jsonify({
            "status": "success",
            "transcript": transcript,
            "evaluation": llm_json
        })
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)