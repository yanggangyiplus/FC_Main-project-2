"""
파일 업로드 엔드포인트 (사진, 녹음)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import shutil

from app.database import get_db
from app.models.models import AudioFile, ImageFile
from app.models.user import User
from app.api.routes.auth import get_current_user

router = APIRouter(
    prefix="/files",
    tags=["files"],
    dependencies=[Depends(get_current_user)]
)

# 업로드 디렉토리
AUDIO_UPLOAD_DIR = "uploads/audio"
IMAGE_UPLOAD_DIR = "uploads/images"
os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGE_UPLOAD_DIR, exist_ok=True)


@router.post("/audio", status_code=status.HTTP_201_CREATED)
async def upload_audio_file(
    file: UploadFile = File(...),
    todo_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """녹음 파일 업로드"""
    try:
        # 파일 저장
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp3'
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(AUDIO_UPLOAD_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 파일 크기 확인
        file_size = os.path.getsize(file_path)
        
        # DB에 저장
        db_audio = AudioFile(
            user_id=current_user.id,
            todo_id=todo_id,
            file_path=file_path,
            file_name=file.filename,
            file_size=file_size,
            mime_type=file.content_type or 'audio/mpeg'
        )
        
        db.add(db_audio)
        db.commit()
        db.refresh(db_audio)
        
        return {
            "id": db_audio.id,
            "file_path": file_path,
            "file_name": file.filename,
            "file_size": file_size,
            "mime_type": file.content_type,
            "created_at": db_audio.created_at
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 업로드 실패: {str(e)}"
        )


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image_file(
    file: UploadFile = File(...),
    todo_id: Optional[str] = None,
    memo_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """이미지 파일 업로드"""
    try:
        # 파일 저장
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(IMAGE_UPLOAD_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 파일 크기 확인
        file_size = os.path.getsize(file_path)
        
        # DB에 저장
        db_image = ImageFile(
            user_id=current_user.id,
            todo_id=todo_id,
            memo_id=memo_id,
            file_path=file_path,
            file_name=file.filename,
            file_size=file_size,
            mime_type=file.content_type or 'image/jpeg'
        )
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return {
            "id": db_image.id,
            "file_path": file_path,
            "file_name": file.filename,
            "file_size": file_size,
            "mime_type": file.content_type,
            "created_at": db_image.created_at
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 업로드 실패: {str(e)}"
        )


@router.get("/audio/{file_id}")
async def get_audio_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """녹음 파일 조회"""
    audio_file = db.query(AudioFile).filter(
        AudioFile.id == file_id,
        AudioFile.user_id == current_user.id,
        AudioFile.deleted_at.is_(None)
    ).first()
    
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다"
        )
    
    return {
        "id": audio_file.id,
        "file_path": audio_file.file_path,
        "file_name": audio_file.file_name,
        "file_size": audio_file.file_size,
        "mime_type": audio_file.mime_type,
        "transcribed_text": audio_file.transcribed_text,
        "created_at": audio_file.created_at
    }


@router.get("/image/{file_id}")
async def get_image_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """이미지 파일 조회"""
    image_file = db.query(ImageFile).filter(
        ImageFile.id == file_id,
        ImageFile.user_id == current_user.id,
        ImageFile.deleted_at.is_(None)
    ).first()
    
    if not image_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다"
        )
    
    return {
        "id": image_file.id,
        "file_path": image_file.file_path,
        "file_name": image_file.file_name,
        "file_size": image_file.file_size,
        "mime_type": image_file.mime_type,
        "extracted_text": image_file.extracted_text,
        "created_at": image_file.created_at
    }

