import pandas as pd
from data_loader import DataLoader
from preprocessing import preprocess_users, preprocess_projects, preprocess_interactions
from content_model import ContentModel
from collaborative_model import CollaborativeModel
from hybrid_model import HybridModel

class Recommender:
    def __init__(self):
        self.users_df = DataLoader.fetch_users()
        self.projects_df = DataLoader.fetch_projects()
        self.interactions_df = DataLoader.fetch_interactions()
        self.users_df = preprocess_users(self.users_df)
        self.projects_df = preprocess_projects(self.projects_df)
        self.interactions_df = preprocess_interactions(self.interactions_df)
        self.content_model = ContentModel()
        self.collaborative_model = CollaborativeModel()
        self.hybrid_model = HybridModel(self.content_model, self.collaborative_model)
        self.content_model.fit(self.projects_df)
        self.collaborative_model.fit(self.interactions_df)

    def recommend_projects(self, user_id, top_n=10):
        user = self.users_df[self.users_df['id'] == user_id]
        if user.empty:
            return []
        user_profile = user.iloc[0]['skills'] + ' ' + user.iloc[0]['bio'] + ' ' + user.iloc[0]['major']
        exclude_ids = self.interactions_df[self.interactions_df['user_id'] == user_id]['project_id'].tolist()
        return self.hybrid_model.recommend(user_id, user_profile, exclude_ids, top_n=top_n)

    def recommend_collaborators(self, project_id, top_n=10):
        project = self.projects_df[self.projects_df['id'] == project_id]
        if project.empty:
            return []
        project_skills = project.iloc[0]['skills']
        # Recommend users with matching skills, not already collaborators
        collab_users = self.interactions_df[self.interactions_df['project_id'] == project_id]['user_id'].tolist()
        candidates = self.users_df[~self.users_df['id'].isin(collab_users)]
        candidates['match_score'] = candidates['skills'].apply(lambda s: sum([1 for skill in project_skills.split(',') if skill.strip() in s]))
        candidates = candidates.sort_values('match_score', ascending=False)
        return [{'id': row['id'], 'score': row['match_score']} for _, row in candidates.head(top_n).iterrows()]
