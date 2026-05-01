"""Client + Brand CI endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import BrandCI, Client, User, UserRole
from ..schemas import (
    BrandCIOut,
    BrandCIUpdate,
    ClientCreate,
    ClientOut,
    ClientUpdate,
)

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    include_archived: bool = False,
):
    q = db.query(Client)
    if not include_archived:
        q = q.filter_by(archived=False)
    return [ClientOut.model_validate(c) for c in q.order_by(Client.name).all()]


@router.post("", response_model=ClientOut)
def create_client(
    payload: ClientCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == UserRole.CLIENT:
        raise HTTPException(403, "Clients cannot create clients")
    c = Client(**payload.model_dump())
    db.add(c)
    db.flush()
    ci = BrandCI(client_id=c.id)
    db.add(ci)
    db.commit()
    db.refresh(c)
    return ClientOut.model_validate(c)


@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    return ClientOut.model_validate(c)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == UserRole.CLIENT:
        raise HTTPException(403, "Forbidden")
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return ClientOut.model_validate(c)


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Only admins can delete clients")
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ------------------ Brand CI ------------------

@router.get("/{client_id}/brand-ci", response_model=BrandCIOut)
def get_brand_ci(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    if c.brand_ci is None:
        ci = BrandCI(client_id=c.id)
        db.add(ci)
        db.commit()
        db.refresh(ci)
        return BrandCIOut.model_validate(ci)
    return BrandCIOut.model_validate(c.brand_ci)


@router.patch("/{client_id}/brand-ci", response_model=BrandCIOut)
def update_brand_ci(
    client_id: int,
    payload: BrandCIUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == UserRole.CLIENT:
        raise HTTPException(403, "Forbidden")
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    ci = c.brand_ci or BrandCI(client_id=c.id)
    if ci.id is None:
        db.add(ci)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ci, k, v)
    db.commit()
    db.refresh(ci)
    return BrandCIOut.model_validate(ci)
