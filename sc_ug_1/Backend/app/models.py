from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import ForeignKey
from sqlalchemy import DateTime

from .database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)

    username = Column(
        String(50),
        unique=True,
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        nullable=False,
        default="user"
    )

    created_at = Column(
        DateTime,
        nullable=False
    )

class Video(Base):
    __tablename__ = "videos"

    video_id = Column(Integer, primary_key=True)

    title = Column(
        String(255),
        nullable=False
    )

    description = Column(Text)

    upload_date = Column(
        DateTime,
        nullable=False
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=False
    )

    pipeline_id = Column(
        Integer,
        ForeignKey("pipelines.pipeline_id"),
        nullable=True
    )

    status = Column(
        String(20),
        nullable=False
    )

    thumbnail_path = Column(
        String(500)
    )

    filename = Column(
        String(255),
        nullable=True
    )   

class VideoVariant(Base):
    __tablename__ = "video_variants"

    variant_id = Column(
        Integer,
        primary_key=True
    )

    video_id = Column(
        Integer,
        ForeignKey("videos.video_id"),
        nullable=False
    )

    resolution = Column(
        String(20),
        nullable=False
    )

    bitrate = Column(
        Integer,
        nullable=False
    )

    playlist_path = Column(
        String(500),
        nullable=False
    )


class Segment(Base):
    __tablename__ = "segments"

    segment_id = Column(
        Integer,
        primary_key=True
    )

    variant_id = Column(
        Integer,
        ForeignKey("video_variants.variant_id"),
        nullable=False
    )

    segment_number = Column(
        Integer,
        nullable=False
    )

    duration = Column(
        Integer,
        nullable=False
    )

    file_path = Column(
        String(500),
        nullable=False
    )

class Pipeline(Base):
    __tablename__ = "pipelines"

    pipeline_id = Column(
        Integer,
        primary_key=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    region = Column(
        String(100),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False
    )

class SegmentHealth(Base):
    __tablename__ = "segment_health"

    health_id = Column(
        Integer,
        primary_key=True
    )

    segment_id = Column(
        Integer,
        ForeignKey("segments.segment_id"),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False
    )

    notes = Column(Text)

    checked_at = Column(
        DateTime,
        nullable=False
    )
