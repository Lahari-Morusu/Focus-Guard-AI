import subprocess, sys

steps = [
    "focus_score.py",
    "switch_analysis.py",
    "sliding_window_cache.py",
    "forecast_model.py",
    "app_classification.py",
    "mini_rag_recommendations.py",
]

for step in steps:
    print(f"\n{'='*70}\nRunning {step}\n{'='*70}")
    result = subprocess.run([sys.executable, step])
    if result.returncode != 0:
        print(f"Step {step} failed, stopping.")
        sys.exit(1)

print("\nDone. Outputs: focus_scores_all_users.csv, switch_pairs_all_users.csv, "
      "max_switch_per_period_all_users.csv, weekly_from_daily_all_users.csv, "
      "focus_predictions_all_users.csv, app_classification_all_users.csv, "
      "recommendations_all_users.csv")