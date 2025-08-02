# app.py

from flask import Flask, request, jsonify                # (1)
from flask_cors import CORS                              # (2)
import joblib                                            # (3)
import pandas as pd                                      # (4)
import numpy as np                                       # (5)

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
def predict():
    # (9) 1) Baca JSON body: 
    #      { 
    #        "SOIL TYPE": "...", 
    #        "REGION": "...", 
    #        "TEMPERATURE": 30.5, 
    #        "WEATHER CONDITION": "..."
    #      }
    data = request.get_json()
    required = ['SOIL TYPE','REGION','TEMPERATURE','WEATHER CONDITION']
    if not data or any(k not in data for k in required):
        return jsonify({'error': f'Missing one of fields {required}'}), 400

    # (10) Buat DataFrame 1 baris dari input mentah
    df = pd.DataFrame([{
        'SOIL TYPE': data['SOIL TYPE'],
        'REGION': data['REGION'],
        'TEMPERATURE': data['TEMPERATURE'],
        'WEATHER CONDITION': data['WEATHER CONDITION'],
    }])

    # (11) One-hot encode persis seperti saat training
    df_encoded = pd.get_dummies(df, columns=['SOIL TYPE','REGION','WEATHER CONDITION'])

    # (12) Pastikan kolomnya sama persis dengan yang dipakai model:
    #       jika ada kolom yang hilang, isi 0; jika ada kolom ekstra, buang
    df_encoded = df_encoded.reindex(columns=FEATURE_NAMES, fill_value=0)

    # (13) Konversi ke numpy array 2D: shape (1, n_features)
    x = df_encoded.to_numpy()

    # (14) Jalankan prediksi
    try:
        y_pred = model.predict(x)           # output array shape (1,)
        # (15) Hitung “confidence” sebagai standar deviasi prediksi tiap tree
        all_tree_preds = np.stack([t.predict(x) for t in model.estimators_], axis=0)
        confidence = float(all_tree_preds.std())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # (16) Kembalikan JSON berisi prediksi dan confidence
    return jsonify({
        'prediction': y_pred.tolist(),      # [ 55.3 ]
        'confidence': confidence            # misal 4.21
    })

# (17) Run server di port 5000
if __name__ == '__main__':
    app.run(debug=True, port=5000)
 