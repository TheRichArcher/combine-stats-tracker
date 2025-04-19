from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os # Import os module

# --- Database Configuration ---
# Get the database URL from the environment variable.
# Fallback to SQLite for local development if not set.
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./test.db')

# Adjust connect_args for SQLite only
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

db_session = scoped_session(sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=engine))
Base = declarative_base()
Base.query = db_session.query_property()

def init_db():
    # import all modules here that might define models so that
    # they will be registered properly on the metadata. Otherwise
    # you will have to import them first before calling init_db()
    import models
    print(f"Connecting to DB: {DATABASE_URL}") # Log the DB being used
    print("Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created (or already exist).")
    except Exception as e:
        print(f"Error creating database tables: {e}")

# Example usage:
# from database import db_session
# At the end of a request or when the application shuts down:
# db_session.remove() 