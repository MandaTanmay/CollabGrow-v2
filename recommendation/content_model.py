import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import os
from typing import List
import logging

logger = logging.getLogger(__name__)

class ContentModel:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        self.project_vectors = None
        self.project_ids = None

    def fit(self, projects_df: pd.DataFrame):
        """Fit TF-IDF model on project features."""
        if projects_df.empty:
            logger.warning("Empty projects dataframe for content model")
            return
        
        # Use pre-computed features from preprocessing
        if 'features' not in projects_df.columns:
            projects_df['features'] = (
                projects_df.get('title', '') + ' ' +
                projects_df.get('description', '') + ' ' +
                projects_df.get('category', '')
            )
        
        self.project_ids = projects_df['id'].tolist()
        self.project_vectors = self.vectorizer.fit_transform(projects_df['features'])
        logger.info(f"Content model fitted on {len(self.project_ids)} projects")

    def recommend(self, user_profile: str, exclude_ids: List[str], top_n=10):
        """Recommend projects based on user profile using cosine similarity."""
        if self.project_vectors is None or len(self.project_ids) == 0:
            logger.warning("Content model not fitted properly")
            return []
        
        try:
            user_vec = self.vectorizer.transform([user_profile])
            scores = cosine_similarity(user_vec, self.project_vectors).flatten()
            
            # Exclude already interacted projects
            mask = np.array([pid not in exclude_ids for pid in self.project_ids])
            scores = scores * mask
            
            # Get top N
            top_indices = np.argsort(scores)[::-1][:top_n]
            results = [(self.project_ids[i], float(scores[i])) for i in top_indices if scores[i] > 0]
            
            logger.info(f"Content recommendations: {len(results)} for profile")
            return results
        except Exception as e:
            logger.error(f"Error in content recommendation: {e}")
            return []
