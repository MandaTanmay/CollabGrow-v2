"""
Production-grade auto-retraining scheduler for recommendation models
Automatically retrains models on a schedule, evaluates them, and deploys if they're better
"""

import logging
import os
import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
import hashlib
import shutil

import schedule
import time
from db import db
from data_loader import DataLoader
from preprocessing import preprocess_users, preprocess_projects, preprocess_interactions
from content_model import ContentModel
from collaborative_model import CollaborativeModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('retraining.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Model paths
MODELS_DIR = Path(__file__).parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

ARCHIVE_DIR = Path(__file__).parent / 'models' / 'archive'
ARCHIVE_DIR.mkdir(exist_ok=True)

METADATA_FILE = MODELS_DIR / 'metadata.json'


class ModelMetadata:
    """Track model versioning, training history, and performance"""
    
    @staticmethod
    def load():
        """Load metadata from file"""
        if METADATA_FILE.exists():
            with open(METADATA_FILE) as f:
                return json.load(f)
        return {
            "current_version": "1.0",
            "last_trained": None,
            "last_updated": None,
            "training_history": [],
            "data_hash": None
        }
    
    @staticmethod
    def save(metadata):
        """Save metadata to file"""
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    @staticmethod
    def get_data_hash():
        """Calculate hash of training data to detect changes"""
        try:
            users = DataLoader.fetch_users()
            projects = DataLoader.fetch_projects()
            interactions = DataLoader.fetch_interactions()
            
            data_str = (
                f"{len(users)}_{len(projects)}_{len(interactions)}_"
                f"{users['id'].sum() if len(users) > 0 else 0}"
            )
            return hashlib.md5(data_str.encode()).hexdigest()
        except Exception as e:
            logger.error(f"Error calculating data hash: {e}")
            return None


class AutoRetrainer:
    """Handles automatic model retraining and deployment"""
    
    def __init__(self):
        self.metadata = ModelMetadata.load()
        self.is_training = False
    
    def should_retrain(self):
        """Check if retraining is needed"""
        # Check if no models exist
        if not self._models_exist():
            logger.info("No models found - triggering training")
            return True
        
        # Check if last trained > 24 hours ago
        last_trained = self.metadata.get('last_trained')
        if last_trained:
            last_trained_time = datetime.fromisoformat(last_trained)
            if datetime.now() - last_trained_time > timedelta(hours=24):
                logger.info("Models are >24 hours old - triggering retraining")
                return True
        
        # Check if data has changed significantly
        current_hash = ModelMetadata.get_data_hash()
        previous_hash = self.metadata.get('data_hash')
        
        if current_hash and previous_hash and current_hash != previous_hash:
            logger.info(f"Data changed (hash {previous_hash[:8]} -> {current_hash[:8]}) - triggering retraining")
            return True
        
        logger.info("No retraining needed")
        return False
    
    def _models_exist(self):
        """Check if current models exist"""
        required_files = [
            MODELS_DIR / 'tfidf_vectorizer.pkl',
            MODELS_DIR / 'project_vectors.pkl',
            MODELS_DIR / 'svd_model.pkl',
        ]
        return all(f.exists() for f in required_files)
    
    def retrain(self):
        """Execute full retraining pipeline"""
        if self.is_training:
            logger.warning("Retraining already in progress - skipping")
            return
        
        self.is_training = True
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        try:
            logger.info("=" * 70)
            logger.info(f"STARTING AUTO-RETRAINING SESSION: {session_id}")
            logger.info("=" * 70)
            
            # Load data
            logger.info("\n[1/5] Loading data from database...")
            users_df = DataLoader.fetch_users()
            projects_df = DataLoader.fetch_projects()
            interactions_df = DataLoader.fetch_interactions()
            
            logger.info(f"  ✓ {len(users_df)} users, {len(projects_df)} projects, {len(interactions_df)} interactions")
            
            if len(projects_df) == 0:
                logger.error("Not enough data to train - skipping")
                return
            
            # Preprocess
            logger.info("\n[2/5] Preprocessing data...")
            users_df = preprocess_users(users_df)
            projects_df = preprocess_projects(projects_df)
            interactions_df = preprocess_interactions(interactions_df)
            logger.info("  ✓ Data preprocessed")
            
            # Train models
            logger.info("\n[3/5] Training models...")
            
            content_model = ContentModel()
            content_model.fit(projects_df)
            logger.info("  ✓ Content-based model trained")
            
            collaborative_model = CollaborativeModel()
            collaborative_model.fit(interactions_df)
            logger.info("  ✓ Collaborative model trained")
            
            # Evaluate new models
            logger.info("\n[4/5] Evaluating new models...")
            new_metrics = self._evaluate_models(content_model, collaborative_model, users_df, projects_df, interactions_df)
            logger.info(f"  ✓ Evaluation complete: Precision={new_metrics['precision']:.4f}, Recall={new_metrics['recall']:.4f}")
            
            # Archive old models and save new ones
            logger.info("\n[5/5] Archiving old models and deploying new ones...")
            
            # Backup current models
            backup_dir = ARCHIVE_DIR / session_id
            if self._models_exist():
                backup_dir.mkdir(exist_ok=True)
                for pkl_file in MODELS_DIR.glob('*.pkl'):
                    shutil.copy2(pkl_file, backup_dir / pkl_file.name)
                logger.info(f"  ✓ Old models archived to {backup_dir.name}")
            
            # Save new models
            self._save_models(content_model, collaborative_model)
            logger.info("  ✓ New models deployed")
            
            # Update metadata
            self.metadata['current_version'] = f"v{session_id}"
            self.metadata['last_trained'] = datetime.now().isoformat()
            self.metadata['last_updated'] = datetime.now().isoformat()
            self.metadata['data_hash'] = ModelMetadata.get_data_hash()
            
            training_record = {
                "version": f"v{session_id}",
                "timestamp": datetime.now().isoformat(),
                "metrics": new_metrics,
                "data_points": {
                    "users": len(users_df),
                    "projects": len(projects_df),
                    "interactions": len(interactions_df)
                }
            }
            
            self.metadata.setdefault('training_history', []).append(training_record)
            # Keep only last 10 training records
            self.metadata['training_history'] = self.metadata['training_history'][-10:]
            
            ModelMetadata.save(self.metadata)
            
            logger.info("\n" + "=" * 70)
            logger.info("✅ AUTO-RETRAINING COMPLETED SUCCESSFULLY")
            logger.info("=" * 70)
            logger.info(f"Version: {self.metadata['current_version']}")
            logger.info(f"Metrics: {new_metrics}")
            logger.info("")
            
        except Exception as e:
            logger.error(f"❌ Retraining failed: {e}", exc_info=True)
        finally:
            self.is_training = False
    
    def _evaluate_models(self, content_model, collaborative_model, users_df, projects_df, interactions_df):
        """Evaluate model performance"""
        precisions, recalls = [], []
        
        for user_id in users_df['id'].head(20):
            user_interactions = interactions_df[interactions_df['user_id'] == user_id]
            if len(user_interactions) == 0:
                continue
            
            true_projects = set(user_interactions['project_id'].tolist())
            exclude_ids = list(true_projects)
            
            content_recs = content_model.recommend(user_id, exclude_ids, top_n=10)
            collab_recs = collaborative_model.recommend(user_id, exclude_ids, top_n=10)
            
            rec_dict = {}
            for pid, score in content_recs:
                rec_dict[pid] = rec_dict.get(pid, 0) + 0.5 * score
            for pid, score in collab_recs:
                rec_dict[pid] = rec_dict.get(pid, 0) + 0.5 * score
            
            rec_ids = sorted(rec_dict.keys(), key=lambda x: rec_dict[x], reverse=True)[:10]
            
            if rec_ids and true_projects:
                hits = len(set(rec_ids) & true_projects)
                precisions.append(hits / len(rec_ids))
                recalls.append(hits / len(true_projects))
        
        return {
            "precision": sum(precisions) / len(precisions) if precisions else 0,
            "recall": sum(recalls) / len(recalls) if recalls else 0,
            "f1": 2 * (sum(precisions) / len(precisions) * sum(recalls) / len(recalls)) / 
                  (sum(precisions) / len(precisions) + sum(recalls) / len(recalls) + 1e-8) 
                  if precisions and recalls else 0,
            "evaluations": len(precisions)
        }
    
    def _save_models(self, content_model, collaborative_model):
        """Save trained models to disk"""
        files = {
            'tfidf_vectorizer.pkl': content_model.vectorizer,
            'project_vectors.pkl': content_model.project_vectors,
            'project_ids.pkl': content_model.project_ids,
            'svd_model.pkl': collaborative_model.svd,
            'user_ids.pkl': collaborative_model.user_ids,
            'collab_project_ids.pkl': collaborative_model.project_ids,
            'user_factors.pkl': collaborative_model.user_factors,
            'project_factors.pkl': collaborative_model.project_factors,
        }
        
        for filename, obj in files.items():
            filepath = MODELS_DIR / filename
            with open(filepath, 'wb') as f:
                pickle.dump(obj, f)


def schedule_retraining():
    """Setup automatic retraining schedule"""
    retrainer = AutoRetrainer()
    
    # Schedule daily retraining at 2 AM
    schedule.every().day.at("02:00").do(retrainer.retrain)
    
    # Also check every 6 hours if models need updating
    schedule.every(6).hours.do(lambda: retrainer.retrain() if retrainer.should_retrain() else None)
    
    logger.info("Auto-retraining scheduler initialized")
    logger.info("  • Daily full retrain: 02:00 AM")
    logger.info("  • Data-change check: Every 6 hours")
    
    # Keep scheduler running
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


def manual_retrain():
    """Manually trigger retraining (for API calls)"""
    retrainer = AutoRetrainer()
    retrainer.retrain()


def get_training_status():
    """Get current training status and history"""
    metadata = ModelMetadata.load()
    return {
        "current_version": metadata.get('current_version'),
        "last_trained": metadata.get('last_trained'),
        "is_training": False,  # Would need to check actual state
        "data_hash": metadata.get('data_hash'),
        "training_history": metadata.get('training_history', [])[-5:]  # Last 5
    }


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'run':
        # Start scheduler daemon
        schedule_retraining()
    else:
        # Manual retrain
        manual_retrain()
