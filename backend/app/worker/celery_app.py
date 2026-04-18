from celery import Celery
from celery.schedules import timedelta

from app.config import settings

celery_app = Celery(
    "meeting_rooms",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "process-outbox-events": {
            "task": "process_pending_events",
            "schedule": timedelta(seconds=settings.OUTBOX_POLL_INTERVAL_SECONDS),
        },
    },
)
