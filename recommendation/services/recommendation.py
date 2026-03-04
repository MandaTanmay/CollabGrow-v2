import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD
import logging

logger = logging.getLogger(__name__)

def get_project_recommendations(db_pool, user_id: str, top_n: int = 10):
    """Get recommended projects for a user using hybrid recommendation."""
    conn = db_pool.getconn()
    try:
        # Check if user exists
        user_check = _query(conn, "SELECT id FROM users WHERE id = %s LIMIT 1", (user_id,))
        if not user_check:
            logger.warning(f"User {user_id} not found in database")
            return []
        
        logger.info(f"[Recommend] User {user_id} found")
        
        # Fetch data - be more lenient with queries
        users_rows = _query(conn, "SELECT id FROM users WHERE is_active = TRUE")
        
        # Try flexible project query
        projects_rows = _query(conn, 
            "SELECT id, title, description, skills FROM projects WHERE status != 'completed' LIMIT 1000")
        
        if not projects_rows:
            # Fallback: get any projects
            projects_rows = _query(conn, "SELECT id, title, description, skills FROM projects LIMIT 1000")
        
        # Get interactions (may be empty for new users)
        interactions_rows = _query(conn, 
            "SELECT DISTINCT user_id, project_id FROM project_interactions") or []
        
        logger.info(f"[Recommend] Retrieved: {len(users_rows) if users_rows else 0} users, {len(projects_rows) if projects_rows else 0} projects, {len(interactions_rows) if interactions_rows else 0} interactions")
        
        if not projects_rows:
            logger.warning("[Recommend] No projects found in database")
            return []
        
        # Handle cold start (new user with no interactions)
        if not interactions_rows:
            logger.info("[Recommend] No interactions found - cold start. Returning random projects")
            # For new users, return top projects by some metric or random
            return [
                {
                    "id": p[0],
                    "score": 0.5
                }
                for p in projects_rows[:top_n]
            ]
        
        # Content-based scores
        content_scores = _content_based(user_id, projects_rows, interactions_rows)
        logger.info(f"[Recommend] Content scores: min={content_scores.min():.3f}, max={content_scores.max():.3f}")
        
        # Collaborative scores
        collab_scores = _collaborative_filtering(user_id, users_rows, projects_rows, interactions_rows)
        logger.info(f"[Recommend] Collab scores: min={collab_scores.min():.3f}, max={collab_scores.max():.3f}")
        
        # Hybrid: 50% content, 50% collaborative
        hybrid_scores = 0.5 * content_scores + 0.5 * collab_scores
        
        # Get top N excluding already interacted projects
        user_projects = set(interaction[1] for interaction in interactions_rows 
                           if interaction[0] == user_id)
        
        logger.info(f"[Recommend] User has {len(user_projects)} existing interactions")
        
        recommendations = []
        for idx, project in enumerate(projects_rows):
            if project[0] not in user_projects:
                recommendations.append({
                    "id": project[0],
                    "score": float(hybrid_scores[idx])
                })
        
        # Sort by score and return top N
        result = sorted(recommendations, key=lambda x: x['score'], reverse=True)[:top_n]
        logger.info(f"[Recommend] Returning {len(result)} recommendations")
        return result
    
    except Exception as e:
        logger.error(f"Error in get_project_recommendations: {e}", exc_info=True)
        return []
    finally:
        db_pool.putconn(conn)

def get_collaborator_recommendations(db_pool, project_id: str, top_n: int = 10):
    """Get recommended collaborators for a project."""
    conn = db_pool.getconn()
    try:
        # Get project details
        project = _query(conn, 
            "SELECT skills FROM projects WHERE id = %s", (project_id,))
        
        if not project:
            return []
        
        project_skills = project[0][0] or ""
        
        # Get current collaborators
        collab_ids = _query(conn, 
            "SELECT user_id FROM project_collaborators WHERE project_id = %s AND status = 'Active'", 
            (project_id,))
        collab_set = set(cid[0] for cid in collab_ids) if collab_ids else set()
        
        # Get all users with matching skills
        users = _query(conn, 
            "SELECT id, full_name, skills, reputation_points FROM users WHERE is_active = TRUE")
        
        recommendations = []
        project_skills_list = [s.strip() for s in project_skills.split(',')]
        
        for user in users:
            user_id, name, skills, reputation = user
            if user_id not in collab_set:
                user_skills = skills or ""
                user_skills_list = [s.strip() for s in user_skills.split(',')]
                
                # Match score: count matching skills
                match_count = len(set(project_skills_list) & set(user_skills_list))
                
                # Boost by reputation
                score = match_count + (reputation or 0) * 0.1
                
                if score > 0:
                    recommendations.append({
                        "id": user_id,
                        "name": name,
                        "score": float(score)
                    })
        
        return sorted(recommendations, key=lambda x: x['score'], reverse=True)[:top_n]
    
    except Exception as e:
        logger.error(f"Error in get_collaborator_recommendations: {e}")
        return []
    finally:
        db_pool.putconn(conn)

def _query(conn, sql: str, params=None):
    """Execute query and return results."""
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        result = cursor.fetchall()
        cursor.close()
        return result
    except Exception as e:
        logger.error(f"Query error: {e}")
        return []

def _content_based(user_id: str, projects, interactions):
    """Content-based filtering using TF-IDF cosine similarity."""
    # Get projects user has interacted with
    user_project_ids = set(interaction[1] for interaction in interactions if interaction[0] == user_id)
    
    if not user_project_ids:
        return np.zeros(len(projects))
    
    # Build project text profiles
    project_texts = []
    for p in projects:
        text = f"{p[1]} {p[2]} {p[3] or ''}"
        project_texts.append(text)
    
    try:
        # TF-IDF vectorization
        vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(project_texts)
        
        # User profile: average of interacted projects
        user_indices = [i for i, p in enumerate(projects) if p[0] in user_project_ids]
        if user_indices:
            user_vec = np.asarray(tfidf_matrix[user_indices].mean(axis=0)).flatten()
            similarities = cosine_similarity([user_vec], tfidf_matrix)[0]
        else:
            similarities = np.zeros(len(projects))
    except Exception as e:
        logger.warning(f"TF-IDF error: {e}")
        similarities = np.zeros(len(projects))
    
    return similarities

def _collaborative_filtering(user_id: str, users, projects, interactions):
    """Collaborative filtering using SVD."""
    user_ids = [u[0] for u in users]
    project_ids = [p[0] for p in projects]
    
    # Create user-project interaction matrix
    user_idx_map = {uid: i for i, uid in enumerate(user_ids)}
    project_idx_map = {pid: i for i, pid in enumerate(project_ids)}
    
    matrix = np.zeros((len(user_ids), len(project_ids)))
    for interaction in interactions:
        user_idx = user_idx_map.get(interaction[0])
        project_idx = project_idx_map.get(interaction[1])
        if user_idx is not None and project_idx is not None:
            matrix[user_idx, project_idx] = 1
    
    try:
        if matrix.sum() == 0:
            return np.zeros(len(projects))
        
        # SVD decomposition
        n_components = min(10, min(matrix.shape) - 1)
        svd = TruncatedSVD(n_components=n_components, random_state=42)
        user_factors = svd.fit_transform(matrix)
        project_factors = svd.components_.T
        
        # Get user factor vector
        user_idx = user_idx_map.get(user_id)
        if user_idx is None:
            return np.zeros(len(projects))
        
        user_factor = user_factors[user_idx]
        scores = user_factor @ project_factors.T
    except Exception as e:
        logger.warning(f"SVD error: {e}")
        scores = np.zeros(len(projects))
    
    # Normalize to 0-1
    if scores.max() > scores.min():
        scores = (scores - scores.min()) / (scores.max() - scores.min())
    else:
        scores = np.zeros_like(scores)
    
    return scores
