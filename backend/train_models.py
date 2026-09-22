import pandas as pd
import psycopg2
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# ============================================================
# 1. CONNECT TO POSTGRESQL
# ============================================================

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    user="focusguard",
    password="focusgaurd123",
    database="focus_guard_ai"
)

# ============================================================
# 2. LOAD COMPLETE LABELED DATA
# ============================================================

query = """
SELECT
    id,
    pid,
    user_type,
    daily_limit,
    limit_status,
    app_web,
    url,
    category,
    opened_date,
    closed_date,
    duration,
    status,
    productivity,
    app_switch,
    monitored,
    monitoring_scope,
    switches
FROM synthetic_activity
WHERE productivity IS NOT NULL
AND duration IS NOT NULL
AND opened_date IS NOT NULL
AND closed_date IS NOT NULL
ORDER BY id
"""

df = pd.read_sql(query, conn)

conn.close()

print("\n==============================================")
print("DATASET INFORMATION")
print("==============================================")

print("Total labeled records:", len(df))

print("\nFirst 5 records:")
print(df.head())

# ============================================================
# 3. CONVERT DURATION TO MINUTES
# ============================================================

df["duration_minutes"] = (
    pd.to_timedelta(
        df["duration"].astype(str)
    ).dt.total_seconds() / 60
)

# ============================================================
# 4. CONVERT DATE COLUMN
# ============================================================

df["opened_date"] = pd.to_datetime(
    df["opened_date"]
)

# ============================================================
# 5. EXTRACT TIME-BASED FEATURES
# ============================================================

df["hour_of_day"] = (
    df["opened_date"].dt.hour
)

df["day_of_week"] = (
    df["opened_date"].dt.dayofweek
)

# ============================================================
# 6. CREATE ADDITIONAL BEHAVIORAL FEATURES
# ============================================================

# Long session
df["long_session"] = (
    df["duration_minutes"] >= 60
).astype(int)

# High application switching
df["high_app_switch"] = (
    df["app_switch"] >= 2
).astype(int)

# ============================================================
# IMPORTANT
#
# DO NOT USE:
#
# switches
# category
# app_web
#
# because your dataset shows that switches directly represents
# the productivity label:
#
# prodA -> NonProductive
# prodB -> Productive
# prodC -> NonProductive
# prodD -> Productive
#
# Using switches would cause target leakage.
# ============================================================

features = [
    "app_switch",
    "duration_minutes",
    "hour_of_day",
    "day_of_week",
    "long_session",
    "high_app_switch"
]

X = df[features].copy()

y = df["productivity"].astype(str)

# ============================================================
# 7. DISPLAY FEATURES
# ============================================================

print("\n==============================================")
print("FEATURES USED FOR TRAINING")
print("==============================================")

for feature in features:
    print("-", feature)

print("\nTarget variable:")
print("- productivity")

print("\nTarget distribution:")
print(y.value_counts())

# ============================================================
# 8. CHECK MISSING VALUES
# ============================================================

print("\n==============================================")
print("MISSING VALUE CHECK")
print("==============================================")

print(X.isnull().sum())

valid_rows = X.notnull().all(axis=1)

X = X[valid_rows]
y = y[valid_rows]

# ============================================================
# 9. TRAIN / TEST SPLIT
#
# 70% TRAIN
# 30% TEST
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.30,
    random_state=42,
    stratify=y
)

print("\n==============================================")
print("TRAIN / TEST SPLIT")
print("==============================================")

print("Total records :", len(X))
print("Training      :", len(X_train))
print("Testing       :", len(X_test))

# ============================================================
# 10. RANDOM FOREST MODEL
# ============================================================

print("\n==============================================")
print("RANDOM FOREST TRAINING")
print("==============================================")

random_forest = RandomForestClassifier(
    n_estimators=300,
    max_depth=8,
    min_samples_split=10,
    min_samples_leaf=4,
    max_features="sqrt",
    bootstrap=True,
    class_weight=None,
    random_state=42,
    n_jobs=-1
)

random_forest.fit(
    X_train,
    y_train
)

print("Random Forest training completed.")

# ============================================================
# 11. PREDICTIONS
# ============================================================

rf_predictions = random_forest.predict(
    X_test
)

# ============================================================
# 12. EVALUATION
# ============================================================

accuracy = accuracy_score(
    y_test,
    rf_predictions
)

precision = precision_score(
    y_test,
    rf_predictions,
    average="weighted",
    zero_division=0
)

recall = recall_score(
    y_test,
    rf_predictions,
    average="weighted",
    zero_division=0
)

f1 = f1_score(
    y_test,
    rf_predictions,
    average="weighted",
    zero_division=0
)

# ============================================================
# 13. DISPLAY RESULTS
# ============================================================

print("\n==============================================")
print("RANDOM FOREST EVALUATION")
print("==============================================")

print(f"Accuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1-Score  : {f1:.4f}")

# ============================================================
# 14. CLASSIFICATION REPORT
# ============================================================

print("\n==============================================")
print("CLASSIFICATION REPORT")
print("==============================================")

print(
    classification_report(
        y_test,
        rf_predictions,
        zero_division=0
    )
)

# ============================================================
# 15. CONFUSION MATRIX
# ============================================================

print("\n==============================================")
print("CONFUSION MATRIX")
print("==============================================")

cm = confusion_matrix(
    y_test,
    rf_predictions
)

print(cm)

# ============================================================
# 16. FEATURE IMPORTANCE
# ============================================================

print("\n==============================================")
print("RANDOM FOREST FEATURE IMPORTANCE")
print("==============================================")

feature_importance = pd.DataFrame({
    "Feature": features,
    "Importance": random_forest.feature_importances_
})

feature_importance = feature_importance.sort_values(
    by="Importance",
    ascending=False
)

print(
    feature_importance.to_string(
        index=False,
        formatters={
            "Importance": "{:.4f}".format
        }
    )
)

# ============================================================
# 17. SAVE MODEL
# ============================================================

model_file = "random_forest_productivity_model.pkl"

joblib.dump(
    random_forest,
    model_file
)

print("\n==============================================")
print("MODEL SAVED")
print("==============================================")

print("Random Forest model saved as:")
print(model_file)

# ============================================================
# 18. FINAL MODEL SUMMARY
# ============================================================

print("\n==============================================")
print("FINAL MODEL SUMMARY")
print("==============================================")

print("Model       : Random Forest")
print("Train/Test  : 70% / 30%")
print("Train data  :", len(X_train))
print("Test data   :", len(X_test))

print(f"Accuracy    : {accuracy:.4f}")
print(f"Precision   : {precision:.4f}")
print(f"Recall      : {recall:.4f}")
print(f"F1-Score    : {f1:.4f}")

print("\nFeatures used:")

for feature in features:
    print(" -", feature)

print("\nLeakage-prone features excluded:")
print(" - switches")
print(" - category")
print(" - app_web")

print("\n==============================================")
print("TRAINING AND EVALUATION COMPLETED")
print("==============================================")