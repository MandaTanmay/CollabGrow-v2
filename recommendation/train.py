import pandas as pd
import numpy as np
import pickle
import logging
from data_loader import DataLoader
from preprocessing import preprocess_users, preprocess_projects, preprocess_interactions
from content_model import ContentModel
from collaborative_model import CollaborativeModel
from sklearn.metrics import precision_score, recall_score, f1_score
import os
from db import db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def save_pickle(obj, filename):
    """Save object to pickle file."""
    filepath = os.path.join(MODELS_DIR, filename)
    with open(filepath, 'wb') as f:
        pickle.dump(obj, f)
    logger.info(f"✓ Saved {filename}")

def evaluate(content_model, collaborative_model, users_df, projects_df, interactions_df):
    """Evaluate recommendation quality."""
    logger.info("\n" + "="*60)
    logger.info("MODEL EVALUATION METRICS")
    logger.info("="*60)
    
    precisions, recalls, f1s, coverages = [], [], [], []
    total_users = len(users_df)
    evaluated_users = 0
    
    for user_id in users_df['id'].head(50):  # Evaluate first 50 users
        user_interactions = interactions_df[interactions_df['user_id'] == user_id]
        if len(user_interactions) == 0:
            continue
            
        true_projects = set(user_interactions['project_id'].tolist())
        exclude_ids = list(true_projects)
        
        # Get recommendations from both models
        content_recs = content_model.recommend(user_id, exclude_ids, top_n=10)
        collab_recs = collaborative_model.recommend(user_id, exclude_ids, top_n=10)
        
        # Merge and deduplicate
        rec_dict = {}
        for pid, score in content_recs:
            rec_dict[pid] = rec_dict.get(pid, 0) + 0.5 * score
        for pid, score in collab_recs:
            rec_dict[pid] = rec_dict.get(pid, 0) + 0.5 * score
        
        rec_ids = sorted(rec_dict.keys(), key=lambda x: rec_dict[x], reverse=True)[:10]
        
        if not rec_ids:
            continue
            
        y_true = np.array([1 if pid in true_projects else 0 for pid in rec_ids])
        y_pred = np.ones(len(rec_ids))
        
        precisions.append(precision_score(y_true, y_pred, zero_division=0))
        recalls.append(recall_score(y_true, y_pred, zero_division=0))
        f1s.append(f1_score(y_true, y_pred, zero_division=0))
        
        if len(true_projects) > 0:
            coverages.append(len(rec_ids) / len(true_projects))
        
        evaluated_users += 1
    
    if precisions:
        logger.info(f"Evaluated: {evaluated_users} / {total_users} users")
        logger.info(f"Precision@10: {np.mean(precisions):.4f}")
        logger.info(f"Recall@10: {np.mean(recalls):.4f}")
        logger.info(f"F1 Score: {np.mean(f1s):.4f}")
        logger.info(f"Coverage: {np.mean(coverages):.4f}")
    else:
        logger.warning("Not enough data for evaluation")

def main():
    try:
        logger.info("="*60)
        logger.info("RECOMMENDATION MODEL TRAINING")
        logger.info("="*60)
        
        # Load data from database
        logger.info("\n📊 Loading data from database...")
        users_df = DataLoader.fetch_users()
        logger.info(f"  ✓ Loaded {len(users_df)} active users")
        
        projects_df = DataLoader.fetch_projects()
        logger.info(f"  ✓ Loaded {len(projects_df)} public projects")
        
        interactions_df = DataLoader.fetch_interactions()
        logger.info(f"  ✓ Loaded {len(interactions_df)} interactions")
        
        # Preprocess
        logger.info("\n🔧 Preprocessing data...")
        users_df = preprocess_users(users_df)
        logger.info("  ✓ Users preprocessed")
        
        projects_df = preprocess_projects(projects_df)
        logger.info("  ✓ Projects preprocessed")
        
        interactions_df = preprocess_interactions(interactions_df)
        logger.info("  ✓ Interactions preprocessed")
        
        # Train content model
        logger.info("\n📚 Training content-based model...")
        content_model = ContentModel()
        content_model.fit(projects_df)
        logger.info(f"  ✓ TF-IDF vectorizer fitted on {len(projects_df)} projects")
        logger.info(f"  ✓ Vocabulary size: {len(content_model.vectorizer.vocabulary_)}")
        
        # Train collaborative model
        logger.info("\n👥 Training collaborative filtering model...")
        collaborative_model = CollaborativeModel(n_components=10)
        collaborative_model.fit(interactions_df)
        logger.info(f"  ✓ SVD fitted with {collaborative_model.n_components} components")
        logger.info(f"  ✓ User-project interaction matrix: {len(collaborative_model.user_ids)} users × {len(collaborative_model.project_ids)} projects")
        
        # Save models
        logger.info("\n💾 Saving models...")
        save_pickle(content_model.vectorizer, 'tfidf_vectorizer.pkl')
        save_pickle(content_model.project_vectors, 'project_vectors.pkl')
        save_pickle(content_model.project_ids, 'project_ids.pkl')
        save_pickle(collaborative_model.svd, 'svd_model.pkl')
        save_pickle(collaborative_model.user_ids, 'user_ids.pkl')
        save_pickle(collaborative_model.project_ids, 'collab_project_ids.pkl')
        save_pickle(collaborative_model.user_factors, 'user_factors.pkl')
        save_pickle(collaborative_model.project_factors, 'project_factors.pkl')
        
        # Evaluate
        logger.info("\n")
        evaluate(content_model, collaborative_model, users_df, projects_df, interactions_df)
        
        logger.info("\n" + "="*60)
        logger.info("✅ TRAINING COMPLETED SUCCESSFULLY")
        logger.info("="*60)
        logger.info(f"Models saved to: {MODELS_DIR}")
        
    except Exception as e:
        logger.error(f"❌ Training failed: {e}", exc_info=True)
        raise
    finally:
        db.close()

if __name__ == '__main__':
    main()
