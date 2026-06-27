from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(prefix="/masters", tags=["Masters"])


@router.get("/", response_model=List[schemas.MasterResponse])
def get_masters(db: Session = Depends(get_db)):
    return db.query(models.Master).all()


@router.get("/{master_id}", response_model=schemas.MasterResponse)
def get_master(master_id: int, db: Session = Depends(get_db)):
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")
    return master


@router.post("/", response_model=schemas.MasterResponse)
def create_master(master: schemas.MasterCreate, db: Session = Depends(get_db)):
    db_master = models.Master(
        name=master.name,
        role=master.role,
        photo_url=master.photo_url,
        bio=master.bio,
    )
    db.add(db_master)
    db.commit()
    db.refresh(db_master)
    return db_master
