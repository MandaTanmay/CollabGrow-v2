import os

class Config:
    POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'aws-1-ap-south-1.pooler.supabase.com')
    POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
    POSTGRES_DB = os.getenv('POSTGRES_DB', 'postgres')
    POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres.hbusvutayfndbvgnljnh')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'QErNIV1lwtUXnCxp')
    POOL_SIZE = int(os.getenv('POOL_SIZE', 10))

    @classmethod
    def get_db_uri(cls):
        return f"postgresql://{cls.POSTGRES_USER}:{cls.POSTGRES_PASSWORD}@{cls.POSTGRES_HOST}:{cls.POSTGRES_PORT}/{cls.POSTGRES_DB}"
