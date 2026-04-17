import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


class UserRole(enum.Enum):
    OWNER = "OWNER"
    MEMBER = "MEMBER"


@dataclass
class User:
    email: str
    name: str
    password_hash: str
    id: UUID = field(default_factory=uuid4)
    role: UserRole = UserRole.MEMBER
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
