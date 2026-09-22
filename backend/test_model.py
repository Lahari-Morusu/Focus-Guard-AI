import joblib
import pandas as pd

model = joblib.load("random_forest_productivity_model.pkl")
print("Random Forest model loaded successfully.\n")

test_data = pd.DataFrame([
    {"app_switch": 1, "duration_minutes": 60, "hour_of_day": 10, "day_of_week": 2},
    {"app_switch": 5, "duration_minutes": 30, "hour_of_day": 20, "day_of_week": 5}
])

predictions = model.predict(test_data)

for i, prediction in enumerate(predictions):
    print(f"Test Activity {i + 1}")
    print("App switches     :", test_data.iloc[i]["app_switch"])
    print("Duration         :", test_data.iloc[i]["duration_minutes"], "minutes")
    print("Hour             :", test_data.iloc[i]["hour_of_day"])
    print("Day of week      :", test_data.iloc[i]["day_of_week"])
    print("Predicted result :", prediction)
    print()