"""
Mini RAG: a small hand-written knowledge base of focus/productivity advice,
retrieved with TF-IDF + cosine similarity against a query built from each
user's predicted trend + app classifications. Fully offline.
Reads: focus_predictions_all_users.csv, app_classification_all_users.csv
Requires: pip install scikit-learn
"""
import pandas as pd
from collections import deque
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KB = [
    {"id": "low_focus_tomorrow",
     "text": "Your focus is predicted to dip tomorrow. Start the day with your single most "
             "important task before opening any messaging or social apps.",
     "tags": "low focus tomorrow declining drop predicted"},
    {"id": "low_focus_week",
     "text": "Your focus trend for the coming week looks lower than usual. Block 2-3 fixed "
             "90-minute deep-work windows this week and protect them from notifications.",
     "tags": "low focus next week declining trend sustained"},
    {"id": "high_focus_momentum",
     "text": "You're on track for a stronger focus day/week than usual. Use this window for "
             "your hardest task rather than routine admin work.",
     "tags": "high focus improving momentum higher productive"},
    {"id": "frequent_switching",
     "text": "You're switching in and out of several apps in short bursts. Batch similar tasks "
             "instead of context-switching every few minutes - each switch costs refocus time.",
     "tags": "switching mostly frequent fragmented bursts context switch distraction"},
    {"id": "avoid_app",
     "text": "One or more apps are pulling significant nonproductive time. Add a 2-minute pause "
             "before opening it, or move it off your home screen.",
     "tags": "try avoiding nonproductive distraction entertainment social media time sink"},
    {"id": "focus_app_reinforce",
     "text": "This app consistently correlates with your most productive, least-fragmented "
             "sessions. Keep it as your first app of the day to anchor a focused start.",
     "tags": "focus app productive sustained good habit reinforce"},
    {"id": "take_a_break",
     "text": "Long unbroken stretches without a break tend to precede a focus drop. A 5-10 "
             "minute break after 60-90 minutes of work restores focus better than pushing through.",
     "tags": "break rest fatigue long session tired pause recovery"},
    {"id": "limit_exceeded",
     "text": "You've exceeded a self-set usage limit recently. Consider a soft reminder at 80% "
             "of the limit instead of only at 100%.",
     "tags": "limit exceeded over usage cap warning threshold"},
    {"id": "good_focus_window",
     "text": "Mornings tend to have your longest, most productive unbroken sessions. Schedule "
             "deep-concentration work in this window.",
     "tags": "good time window morning schedule best time focus peak"},
    {"id": "stable_neutral",
     "text": "Your focus pattern looks stable and roughly in line with your usual baseline - "
             "no major intervention needed.",
     "tags": "stable neutral baseline normal steady same as usual"},
]
_kb_texts = [d["text"] + " " + d["tags"] for d in KB]
_vectorizer = TfidfVectorizer(stop_words="english")
_kb_matrix = _vectorizer.fit_transform(_kb_texts)


def retrieve(query, top_k=3):
    sims = cosine_similarity(_vectorizer.transform([query]), _kb_matrix).flatten()
    ranked = sims.argsort()[::-1][:top_k]
    return [(KB[i]["id"], KB[i]["text"]) for i in ranked if sims[i] > 0]


class RecommendationContext:
    """Sliding window of recent (query, hits) per user, so context from a
    few turns ago can still influence the current recommendation."""
    def __init__(self, window_size=5):
        self.window = deque(maxlen=window_size)

    def ask(self, query_tags: str, top_k=3):
        context_tags = " ".join(q for q, _ in self.window)
        full_query = f"{context_tags} {query_tags}".strip()
        hits = retrieve(full_query, top_k=top_k)
        self.window.append((query_tags, hits))
        return hits


def build_query(pred_row, user_apps):
    parts = []
    if "lower" in pred_row["trend_tomorrow"]:
        parts.append("low focus tomorrow declining drop predicted")
    if "lower" in pred_row["trend_next_week"]:
        parts.append("low focus next week declining trend sustained")
    if "higher" in pred_row["trend_tomorrow"] or "higher" in pred_row["trend_next_week"]:
        parts.append("high focus improving momentum higher productive")
    if "same" in pred_row["trend_tomorrow"] and "same" in pred_row["trend_next_week"]:
        parts.append("stable neutral baseline normal steady same as usual")

    n_switch = (user_apps["classification"] == "Switching Mostly").sum()
    n_avoid  = (user_apps["classification"] == "Try Avoiding").sum()
    n_focus  = (user_apps["classification"] == "Focus App").sum()
    if n_switch >= 3:
        parts.append("switching mostly frequent fragmented bursts context switch distraction")
    if n_avoid >= 2:
        parts.append("try avoiding nonproductive distraction entertainment social media time sink")
    if n_focus >= 1:
        parts.append("focus app productive sustained good habit reinforce good time window morning")
    parts.append("break rest fatigue long session tired pause recovery")
    return " ".join(parts)


def run_for_all_users():
    preds = pd.read_csv("focus_predictions_all_users.csv")
    apps  = pd.read_csv("app_classification_all_users.csv")

    rows = []
    for _, prow in preds.iterrows():
        user = prow["user_type"]
        uapps = apps[apps["user_type"] == user]
        ctx = RecommendationContext(window_size=5)
        query = build_query(prow, uapps)
        hits = ctx.ask(query)

        top_switch = uapps[uapps["classification"] == "Switching Mostly"] \
            .sort_values("n_sessions", ascending=False)["app_web"].head(1).tolist()
        top_avoid = uapps[uapps["classification"] == "Try Avoiding"] \
            .sort_values("total_time_min", ascending=False)["app_web"].head(1).tolist()
        top_focus = uapps[uapps["classification"] == "Focus App"] \
            .sort_values("total_time_min", ascending=False)["app_web"].head(1).tolist()

        rows.append({
            "user_type": user,
            "predicted_focus_tomorrow_pct": prow["predicted_focus_tomorrow_pct"],
            "predicted_focus_next_7day_avg_pct": prow["predicted_focus_next_7day_avg_pct"],
            "top_recommendation": hits[0][1] if hits else "",
            "all_recommendations": " | ".join(t for _, t in hits),
            "app_to_batch_instead_of_switching": top_switch[0] if top_switch else "",
            "app_to_avoid": top_avoid[0] if top_avoid else "",
            "app_to_lean_on_for_focus": top_focus[0] if top_focus else "",
        })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    result = run_for_all_users()
    result.to_csv("recommendations_all_users.csv", index=False)
    print(f"Saved recommendations_all_users.csv  shape={result.shape}")
    print(result.to_string(index=False))