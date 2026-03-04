class HybridModel:
    def __init__(self, content_model, collaborative_model):
        self.content_model = content_model
        self.collaborative_model = collaborative_model

    def recommend(self, user_id, user_profile, exclude_ids, top_n=10):
        content_recs = dict(self.content_model.recommend(user_profile, exclude_ids, top_n=top_n))
        collab_recs = dict(self.collaborative_model.recommend(user_id, exclude_ids, top_n=top_n))
        all_ids = set(content_recs.keys()) | set(collab_recs.keys())
        results = []
        for pid in all_ids:
            content_score = content_recs.get(pid, 0)
            collab_score = collab_recs.get(pid, 0)
            final_score = 0.6 * content_score + 0.4 * collab_score
            results.append({'id': pid, 'score': round(final_score, 4)})
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_n]
