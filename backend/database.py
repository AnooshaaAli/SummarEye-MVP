import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy import event

# Connect to local SQLite file
DATABASE_URL = "sqlite:///./sightline.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")
    tracking_events = relationship("TrackingEvent", back_populates="user", cascade="all, delete-orphan")

class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending") # 'pending', 'processing', 'done', 'error'
    duration_s = Column(Float, nullable=True)
    event_count = Column(Integer, default=0)
    error_msg = Column(String, nullable=True)

    # Relationships
    events = relationship("Event", back_populates="video", cascade="all, delete-orphan")
    user = relationship("User", back_populates="videos")

class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration_s = Column(Float, nullable=False)
    label = Column(String, nullable=False) # 'person_detected' or 'loitering'
    confidence = Column(Float, nullable=False)
    clip_path = Column(String, nullable=True)
    thumbnail = Column(String, nullable=True)
    flagged = Column(Boolean, default=False)
    flag_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="events")

@event.listens_for(Event, 'before_insert')
def auto_compute_duration(mapper, connection, target):
    if target.start_time is not None and target.end_time is not None:
        if target.duration_s is None:
            target.duration_s = float(target.end_time) - float(target.start_time)

class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    event_name = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(String, nullable=True) # JSON dump of metadata

    user = relationship("User", back_populates="tracking_events")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
