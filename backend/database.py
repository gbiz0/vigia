import os
import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./data/vigia.db"
)

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    input = Column(Text)
    actual_output = Column(Text)
    model = Column(String, nullable=True)
    
    # Neutrality
    neutrality_score = Column(Float)
    neutrality_std_dev = Column(Float)
    neutrality_is_stable = Column(Boolean)
    neutrality_reason = Column(Text)
    
    # Electoral Bias
    electoral_bias_score = Column(Float)
    electoral_bias_std_dev = Column(Float)
    electoral_bias_is_stable = Column(Boolean)
    electoral_bias_reason = Column(Text)
    
    # Hallucination
    hallucination_score = Column(Float)
    hallucination_std_dev = Column(Float)
    hallucination_is_stable = Column(Boolean)
    hallucination_reason = Column(Text)
    
    # Bias Direction
    bias_direction_reason = Column(Text)
    
    # Composite Score
    composite_risk_score = Column(Float)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
