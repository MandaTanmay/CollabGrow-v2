#!/usr/bin/env python3
"""Quick script to diagnose database schema and data."""
import psycopg2
from config import Config

config = Config()
conn = psycopg2.connect(config.get_db_uri())
cursor = conn.cursor()

print("=" * 60)
print("SCHEMA CHECK")
print("=" * 60)

# Check tables
cursor.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
""")
tables = cursor.fetchall()
print(f"\nTables: {[t[0] for t in tables]}")

# Check projects table structure
print("\n--- PROJECTS TABLE ---")
try:
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='projects'")
    cols = cursor.fetchall()
    for col, dtype in cols:
        print(f"  {col}: {dtype}")
except Exception as e:
    print(f"  Error: {e}")

# Check projects data
print("\nProjects sample:")
try:
    cursor.execute("SELECT COUNT(*) FROM projects")
    count = cursor.fetchone()[0]
    print(f"  Total projects: {count}")
    cursor.execute("SELECT id, title FROM projects LIMIT 5")
    for row in cursor.fetchall():
        print(f"    {row}")
except Exception as e:
    print(f"  Error: {e}")

# Check interactions
print("\n--- INTERACTIONS ---")
try:
    cursor.execute("SELECT COUNT(*) FROM project_interactions")
    count = cursor.fetchone()[0]
    print(f"  Total interactions: {count}")
except Exception as e:
    print(f"  Table doesn't exist: {e}")

# Check users
print("\n--- USERS ---")
try:
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
    count = cursor.fetchone()[0]
    print(f"  Active users: {count}")

    cursor.execute("SELECT id FROM users LIMIT 1")
    user = cursor.fetchone()
    if user:
        print(f"  Sample user: {user[0]}")
except Exception as e:
    print(f"  Error: {e}")

conn.close()
print("\n" + "=" * 60)
