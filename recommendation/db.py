import psycopg2
import psycopg2.pool
import os
from config import Config

class Database:
    def __init__(self):
        self.pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=Config.POOL_SIZE,
            dsn=Config.get_db_uri()
        )

    def get_conn(self):
        return self.pool.getconn()

    def put_conn(self, conn):
        self.pool.putconn(conn)

    def execute(self, query, params=None, fetch=True):
        conn = self.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                if fetch:
                    result = cur.fetchall()
                else:
                    result = None
                conn.commit()
                return result
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            self.put_conn(conn)

    def close(self):
        self.pool.closeall()

db = Database()
