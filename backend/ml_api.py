from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)
model = joblib.load("random_forest_productivity_model.pkl")

FEATURES = ["app_switch", "duration_minutes", "hour_of_day", "day_of_week"]

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    missing = [f for f in FEATURES if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    df = pd.DataFrame([{f: data[f] for f in FEATURES}])
    prediction = model.predict(df)[0]

    result = {"productivity": prediction}

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(df)[0]
        classes = model.classes_
        result["confidence"] = dict(zip(classes, [round(float(p), 4) for p in proba]))

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001)