import pandas as pd
import numpy as np
from typing import List

def normalize_text(text: str) -> str:
    if not text:
        return ''
    return str(text).lower().strip()

def handle_nulls(df: pd.DataFrame, fill_value='') -> pd.DataFrame:
    return df.fillna(fill_value)

def preprocess_users(users_df: pd.DataFrame) -> pd.DataFrame:
    """Preprocess user data."""
    if users_df.empty:
        return users_df
    
    users_df = handle_nulls(users_df)
    # Only normalize columns that exist
    for col in ['username', 'email']:
        if col in users_df.columns:
            users_df[col] = users_df[col].apply(normalize_text)
    
    return users_df

def preprocess_projects(projects_df: pd.DataFrame) -> pd.DataFrame:
    """Preprocess project data."""
    if projects_df.empty:
        return projects_df
    
    projects_df = handle_nulls(projects_df)
    
    # Normalize text columns
    for col in ['title', 'description', 'category', 'difficulty_level']:
        if col in projects_df.columns:
            projects_df[col] = projects_df[col].apply(normalize_text)
    
    # Handle skills array/list
    if 'required_skills' in projects_df.columns:
        def process_skills(skills):
            if isinstance(skills, list):
                return ' '.join([str(s).lower() for s in skills if s])
            elif isinstance(skills, str):
                return skills.lower()
            else:
                return ''
        
        projects_df['skills'] = projects_df['required_skills'].apply(process_skills)
    else:
        projects_df['skills'] = ''
    
    # Create a combined text feature for TF-IDF
    projects_df['features'] = (
        projects_df.get('title', '') + ' ' +
        projects_df.get('description', '') + ' ' +
        projects_df.get('skills', '') + ' ' +
        projects_df.get('category', '')
    )
    
    return projects_df

def preprocess_interactions(interactions_df: pd.DataFrame) -> pd.DataFrame:
    """Preprocess interaction data."""
    if interactions_df.empty:
        return interactions_df
    
    interactions_df = handle_nulls(interactions_df)
    return interactions_df
