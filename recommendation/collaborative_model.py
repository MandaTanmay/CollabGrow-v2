import pandas as pd
import numpy as np
from sklearn.decomposition import TruncatedSVD
import logging

logger = logging.getLogger(__name__)

class CollaborativeModel:
    def __init__(self, n_components=10):
        self.n_components = n_components
        self.svd = None
        self.user_factors = None
        self.project_factors = None
        self.user_ids = None
        self.project_ids = None

    def fit(self, interactions_df: pd.DataFrame):
        """Fit collaborative filtering model on interaction matrix."""
        if interactions_df.empty:
            logger.warning("Empty interactions dataframe for collaborative model")
            return
        
        # Map interaction actions to weights
        feedback_map = {'view': 1, 'save': 2, 'like': 3, 'apply': 5, 'collaboration': 4}
        interactions_df['feedback'] = interactions_df['action'].map(feedback_map).fillna(1)
        
        # Create user-project interaction matrix
        matrix = interactions_df.pivot_table(
            index='user_id', 
            columns='project_id', 
            values='feedback', 
            fill_value=0
        )
        
        if matrix.shape[1] == 0 or matrix.shape[0] == 0:
            logger.warning("Empty interaction matrix")
            return
        
        self.user_ids = matrix.index.tolist()
        self.project_ids = matrix.columns.tolist()
        
        # Dynamically set n_components based on matrix dimensions
        max_components = min(matrix.shape) - 1  # Must be less than both dimensions
        actual_components = min(self.n_components, max_components)
        
        if actual_components <= 0:
            logger.warning("Not enough data for SVD decomposition")
            return
        
        logger.info(f"SVD matrix shape: {matrix.shape[0]} users × {matrix.shape[1]} projects")
        logger.info(f"Using {actual_components} components (max available: {max_components})")
        
        # Fit SVD
        self.svd = TruncatedSVD(n_components=actual_components, random_state=42)
        self.svd.fit(matrix)
        self.user_factors = self.svd.transform(matrix)
        self.project_factors = self.svd.components_.T

    def recommend(self, user_id: str, exclude_ids: list, top_n=10):
        """Recommend projects for user using collaborative filtering."""
        if self.svd is None or self.user_ids is None:
            logger.warning("Collaborative model not fitted")
            return []
        
        try:
            if user_id not in self.user_ids:
                logger.info(f"Cold start for user {user_id} - no collaborative data")
                return []  # Cold start: no collaborative data
            
            idx = self.user_ids.index(user_id)
            scores = np.dot(self.project_factors, self.user_factors[idx])
            
            # Normalize
            scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-8)
            
            # Exclude already interacted projects
            mask = np.array([pid not in exclude_ids for pid in self.project_ids])
            scores = scores * mask
            
            # Get top N
            top_indices = np.argsort(scores)[::-1][:top_n]
            results = [(self.project_ids[i], float(scores[i])) for i in top_indices if scores[i] > 0]
            
            logger.info(f"Collab recommendations: {len(results)} for user {user_id}")
            return results
        except Exception as e:
            logger.error(f"Error in collaborative recommendation: {e}")
            return []
