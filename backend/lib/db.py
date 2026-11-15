import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from lib.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

def get_database() -> AsyncIOMotorDatabase:
    if db_instance.db is None:
        db_instance.client = AsyncIOMotorClient(
            settings.MONGO_URL,
            serverSelectionTimeoutMS=2500,
            connectTimeoutMS=2500
        )
        db_instance.db = db_instance.client[settings.DB_NAME]
    return db_instance.db

async def init_db():
    database = get_database()
    try:
        # Create indexes according to specification in DRYRUN_BRIEF.md
        # 1. sessions by (device_id, started_at)
        await database.sessions.create_index([("device_id", 1), ("started_at", -1)])
        await database.sessions.create_index([("id", 1)], unique=True)
        # 2. turns by (session_id, created_at)
        await database.turns.create_index([("session_id", 1), ("created_at", 1)])
        await database.turns.create_index([("device_id", 1), ("session_id", 1)])
        # 3. reports by (device_id, created_at)
        await database.reports.create_index([("device_id", 1), ("created_at", -1)])
        await database.reports.create_index([("session_id", 1)], unique=True)
        await database.reports.create_index([("id", 1)], unique=True)
        # 4. mastery by (device_id, topic) unique
        await database.mastery.create_index([("device_id", 1), ("topic", 1)], unique=True)
        logger.info("MongoDB indexes verified successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize MongoDB indexes (will retry on operations): {e}")

async def close_db():
    if db_instance.client:
        db_instance.client.close()
