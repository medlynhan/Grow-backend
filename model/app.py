# app.py

from flask import Flask, request, jsonify                # (1)
from flask_cors import CORS                              # (2)
import joblib                                            # (3)
import pandas as pd                                      # (4)
import numpy as np                                       # (5)
import requests

# (6) Inisialisasi Flask + aktifkan CORS supaya bisa di‐fetch dari Next.js/React
app = Flask(__name__)
CORS(app)

# (7) Load model yang kamu simpan: perhatikan namanya "rice_model.jolib"
MODEL_PATH = 'rice_model.joblib'
model = joblib.load(MODEL_PATH)
print(f"✅ Model ter‐load dari {MODEL_PATH}")

# (8) Ambil daftar feature yang dipakai di training (hasil one‐hot encoding)
#    Ini memungkinkan kita meng‐reindex DataFrame input agar kolomnya sama
FEATURE_NAMES = model.feature_names_in_
print("▶️ Feature names:", FEATURE_NAMES)

@app.route('/')
def home():
    return "Welcome to the Flask API!"


@app.route('/predict', methods=['POST'])
@app.route('/predict', methods=['POST'])
def predict():
    # Terima data JSON yang dikirim dari Node.js
    data = request.get_json()

    # Pastikan data berupa list (array)
    if not isinstance(data, list):
        return jsonify({'error': 'Data must be an array of objects'}), 400

    # Log data yang diterima
    print(f"Received data: {data}")

    # List untuk menyimpan hasil prediksi
    results = []

    # Proses setiap item dalam array
    for item in data:
        # Pastikan semua field yang diperlukan ada di tiap item
        required = ['SOIL TYPE', 'REGION', 'TEMPERATURE', 'WEATHER CONDITION']
        if not all(k in item for k in required):
            return jsonify({'error': f'Missing one of fields {required}'}), 400

        # Buat DataFrame dari data item yang diterima
        df = pd.DataFrame([{
            'SOIL TYPE': item['SOIL TYPE'],
            'REGION': item['REGION'],
            'TEMPERATURE': item['TEMPERATURE'],
            'WEATHER CONDITION': item['WEATHER CONDITION'],
        }])

        # One-hot encode data sesuai dengan training
        df_encoded = pd.get_dummies(df, columns=['SOIL TYPE', 'REGION', 'WEATHER CONDITION'])
        df_encoded = df_encoded.reindex(columns=FEATURE_NAMES, fill_value=0)
        x = df_encoded.to_numpy()

        try:
            # Prediksi menggunakan model
            y_pred = model.predict(x)
            # Hitung confidence (deviasi standar dari prediksi masing-masing tree)
            all_tree_preds = np.stack([t.predict(x) for t in model.estimators_], axis=0)
            confidence = float(all_tree_preds.std())
        except Exception as e:
            return jsonify({'error': str(e)}), 500

        # Log prediksi dan confidence untuk debugging
        print(f"Prediction for {item}: {y_pred.tolist()}")
        print(f"Confidence for {item}: {confidence}")

        # Simpan hasil prediksi dan confidence ke dalam list results
        results.append({
            'prediction': y_pred.tolist(),
            'confidence': confidence,
            'date'  : item['DATE TIME']

        })

    # Kirim data hasil prediksi ke Node.js menggunakan requests
    try:
        # Kirim data hasil prediksi ke Node.js
        node_url = 'http://localhost:8000/receivePrediction'
        headers = {'Content-Type': 'application/json'}
        response = requests.post(node_url, json=results, headers=headers)

        # Pastikan data diterima oleh Node.js
        print("Data berhasil dikirim ke Node.js:", response.text)

    except Exception as e:
        print(f"Error sending data to Node.js: {str(e)}")

    # Kembalikan semua prediksi dan confidence ke client (Node.js)
    return jsonify(results)


# Menjalankan server Flask pada port 5000 (atau port lain yang kamu tentukan)
if __name__ == '__main__':
    app.run(debug=True, port=5000)  # Gunakan port 5000, atau ganti jika diperlukan
