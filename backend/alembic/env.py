import os
from logging.config import fileConfig

from sqlmodel import SQLModel
from dotenv import load_dotenv
import sys

# Add the project root directory (parent of 'backend') to the path
# This allows importing 'backend.main' as a module
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

# Now import models using the module path
from backend.main import Player, DrillResult

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Try finding .env starting from the project root determined earlier
dotenv_path = os.path.join(project_root, '.env')
if not os.path.exists(dotenv_path):
    # Fallback: try relative to the env.py file's location
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env') 

print(f"Attempting to load .env file from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path, override=True)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Get the database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

# Set the sqlalchemy.url in the config object
# This ensures Alembic uses the env var, overriding alembic.ini default
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = SQLModel.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    db_url_for_engine = DATABASE_URL
    if db_url_for_engine and "+asyncpg" not in db_url_for_engine:
        print(f"WARNING: Forcing +asyncpg driver onto URL: {db_url_for_engine}")
        db_url_for_engine = db_url_for_engine.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not db_url_for_engine:
        raise ValueError("DATABASE_URL is unexpectedly None in run_migrations_online")

    connectable = create_async_engine(
        db_url_for_engine,
        poolclass=pool.NullPool
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


import asyncio

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
