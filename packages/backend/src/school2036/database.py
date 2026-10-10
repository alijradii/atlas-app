from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from school2036.config import Settings


class Base(DeclarativeBase):
    pass


def create_session_factory(settings: Settings):
    engine = create_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"connect_timeout": 3},
    )
    return engine, sessionmaker(bind=engine, expire_on_commit=False)
