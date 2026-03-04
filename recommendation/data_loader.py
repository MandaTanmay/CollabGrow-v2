import pandas as pd
import logging
from db import db

logger = logging.getLogger(__name__)

class DataLoader:
    @staticmethod
    def fetch_users():
        """Fetch active users from database."""
        query = """
        SELECT id, username, email
        FROM users
        WHERE is_active = TRUE
        LIMIT 100
        """
        try:
            rows = db.execute(query, fetch=True)
            if not rows:
                logger.warning("No users found in database")
                return pd.DataFrame()
            
            df = pd.DataFrame(rows, columns=['id', 'username', 'email'])
            logger.info(f"Fetched {len(df)} users")
            return df
        except Exception as e:
            logger.error(f"Error fetching users: {e}")
            return pd.DataFrame()

    @staticmethod
    def fetch_projects():
        """Fetch public projects from database."""
        query = """
        SELECT id, title, description, category, status, difficulty_level, required_skills
        FROM projects
        WHERE is_public = TRUE AND is_deleted = FALSE
        LIMIT 100
        """
        try:
            rows = db.execute(query, fetch=True)
            if not rows:
                logger.warning("No projects found in database")
                return pd.DataFrame()
            
            df = pd.DataFrame(rows, columns=['id', 'title', 'description', 'category', 'status', 'difficulty_level', 'required_skills'])
            # Convert UUID to string
            df['id'] = df['id'].astype(str)
            # Handle null descriptions
            df['description'] = df['description'].fillna('')
            logger.info(f"Fetched {len(df)} projects")
            return df
        except Exception as e:
            logger.error(f"Error fetching projects: {e}")
            return pd.DataFrame()

    @staticmethod
    def fetch_interactions():
        """Fetch user-project interactions from database."""
        query = """
        SELECT 
            CAST(user_id AS TEXT) as user_id, 
            CAST(project_id AS TEXT) as project_id, 
            action,
            created_at
        FROM project_interactions
        ORDER BY created_at DESC
        LIMIT 500
        """
        try:
            rows = db.execute(query, fetch=True)
            if not rows:
                logger.warning("No interactions found in database - creating synthetic interactions...")
                return DataLoader._create_synthetic_interactions()
            
            df = pd.DataFrame(rows, columns=['user_id', 'project_id', 'action', 'created_at'])
            df = df[['user_id', 'project_id', 'action']]  # Keep only needed columns
            logger.info(f"Fetched {len(df)} interactions from database")
            return df
        except Exception as e:
            logger.error(f"Error fetching interactions: {e}")
            logger.info("Creating synthetic interactions as fallback...")
            return DataLoader._create_synthetic_interactions()

    @staticmethod
    def _create_synthetic_interactions():
        """Create synthetic user-project interactions for training."""
        try:
            # Get some users and projects
            users_query = "SELECT id FROM users WHERE is_active = TRUE LIMIT 10"
            users = db.execute(users_query, fetch=True)
            
            projects_query = "SELECT id FROM projects WHERE is_public = TRUE LIMIT 10"
            projects = db.execute(projects_query, fetch=True)
            
            if not users or not projects:
                return pd.DataFrame(columns=['user_id', 'project_id', 'action'])
            
            import random
            interactions = []
            for user in users:
                user_id = str(user[0])
                # Each user interacts with 2-5 projects
                selected_projects = random.sample(projects, min(random.randint(2, 5), len(projects)))
                for project in selected_projects:
                    project_id = str(project[0])
                    action = random.choice(['view', 'like', 'collaboration'])
                    interactions.append({
                        'user_id': user_id,
                        'project_id': project_id,
                        'action': action
                    })
            
            df = pd.DataFrame(interactions)
            logger.info(f"Created {len(df)} synthetic interactions")
            return df
        except Exception as e:
            logger.error(f"Error creating synthetic interactions: {e}")
            return pd.DataFrame(columns=['user_id', 'project_id', 'action'])

    @staticmethod
    def fetch_collaborators():
        """Fetch project collaborators from database."""
        query = """
        SELECT project_id, user_id, role, status
        FROM project_collaborators
        WHERE status = 'active'
        LIMIT 100
        """
        try:
            rows = db.execute(query, fetch=True)
            if not rows:
                logger.warning("No collaborators found in database")
                return pd.DataFrame()
            
            df = pd.DataFrame(rows, columns=['project_id', 'user_id', 'role', 'status'])
            df['project_id'] = df['project_id'].astype(str)
            df['user_id'] = df['user_id'].astype(str)
            logger.info(f"Fetched {len(df)} collaborators")
            return df
        except Exception as e:
            logger.error(f"Error fetching collaborators: {e}")
            return pd.DataFrame()
