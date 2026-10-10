from alembic import context
from school2036 import models  # noqa: F401
from school2036.config import get_settings
from school2036.database import Base, create_session_factory

settings = context.config.attributes.get("settings") or get_settings()
if context.is_offline_mode():
    context.configure(
        url=settings.database_url.get_secret_value(),
        target_metadata=Base.metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine, _ = create_session_factory(settings)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
