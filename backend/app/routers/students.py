import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instructor import Instructor
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.services.auth_service import get_current_instructor
from app.services.stripe_service import FREE_STUDENT_LIMIT


router = APIRouter()


@router.get("", response_model=list[StudentResponse])
async def list_students(
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> list[Student]:
    result = await db.execute(
        select(Student)
        .where(Student.instructor_id == current.id, Student.is_active == True)  # noqa: E712
        .order_by(Student.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    body: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> Student:
    # Free tier: max 5 active students
    if current.plan == "free":
        count = await db.scalar(
            select(func.count(Student.id)).where(
                Student.instructor_id == current.id,
                Student.is_active == True,  # noqa: E712
            )
        )
        if (count or 0) >= FREE_STUDENT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="free_limit_students",
            )

    student = Student(instructor_id=current.id, **body.model_dump())
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return student


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> Student:
    result = await db.execute(
        select(Student).where(Student.id == student_id, Student.instructor_id == current.id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: uuid.UUID,
    body: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> Student:
    result = await db.execute(
        select(Student).where(Student.id == student_id, Student.instructor_id == current.id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    await db.flush()
    await db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> None:
    result = await db.execute(
        select(Student).where(Student.id == student_id, Student.instructor_id == current.id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Soft delete — preserves lesson history
    student.is_active = False
    await db.flush()
