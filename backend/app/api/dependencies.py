from http import HTTPStatus
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.infrastructure.database.models import UserModel
from app.infrastructure.repositories.sqlalchemy_user_repo import UserRepositoryDep
from app.infrastructure.security.jwt import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    repo: UserRepositoryDep,
    token: str = Depends(oauth2_scheme),
) -> UserModel:
    credentials_exception = HTTPException(
        status_code=HTTPStatus.UNAUTHORIZED,
        detail="Credenciais inválidas.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = await repo.get_by_id(UUID(user_id))
    if not user or not user.is_active:
        raise credentials_exception

    return user


CurrentUser = Annotated[UserModel, Depends(get_current_user)]


async def require_owner(user: CurrentUser) -> UserModel:
    if user.role not in ("OWNER", "SUPER_ADMIN"):
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Acesso restrito a administradores.")  # noqa: E501
    return user


OwnerUser = Annotated[UserModel, Depends(require_owner)]
