from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import OwnerUser
from app.application.schemas.auth import UserOut
from app.infrastructure.database.models import UserModel, UserRoleEnum
from app.infrastructure.database.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _: OwnerUser,
    session: AsyncSession = Depends(get_db),
) -> list[UserModel]:
    result = await session.execute(select(UserModel).order_by(UserModel.created_at))
    return list(result.scalars().all())


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: UUID,
    current_user: OwnerUser,
    session: AsyncSession = Depends(get_db),
) -> UserModel:
    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível alterar seu próprio role.")

    user.role = UserRoleEnum.OWNER if user.role == UserRoleEnum.MEMBER else UserRoleEnum.MEMBER
    await session.commit()
    await session.refresh(user)
    return user
