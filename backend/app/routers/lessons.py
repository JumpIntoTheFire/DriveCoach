import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instructor import Instructor
from app.models.lesson import Lesson
from app.models.student import Student
from app.schemas.lesson import LessonCreate, LessonResponse, LessonUpdate, VALID_STATUSES
from app.services.auth_service import get_current_instructor


router = APIRouter()


def _to_response(lesson: Lesson, student_name: str) -> LessonResponse:
    return LessonResponse(
        id=lesson.id,
        instructor_id=lesson.instructor_id,
        student_id=lesson.student_id,
        student_name=student_name,
        start_time=lesson.start_time,
        duration_minutes=lesson.duration_minutes,
        location=lesson.location,
        price=float(lesson.price) if lesson.price is not None else None,
        status=lesson.status,
        created_at=lesson.created_at,
    )


@router.get("", response_model=list[LessonResponse])
async def list_lessons(
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> list[LessonResponse]:
    query = (
        select(Lesson, Student.name)
        .join(Student, Student.id == Lesson.student_id)
        .where(Lesson.instructor_id == current.id)
    )
    if student_id:
        query = query.where(Lesson.student_id == student_id)
    query = query.order_by(Lesson.start_time)

    result = await db.execute(query)
    return [_to_response(lesson, name) for lesson, name in result.all()]


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    body: LessonCreate,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> LessonResponse:
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    # Ensure the student belongs to this instructor
    sr = await db.execute(
        select(Student).where(Student.id == body.student_id, Student.instructor_id == current.id)
    )
    student = sr.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    lesson = Lesson(instructor_id=current.id, **body.model_dump())
    db.add(lesson)
    await db.flush()
    await db.refresh(lesson)
    return _to_response(lesson, student.name)


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> LessonResponse:
    result = await db.execute(
        select(Lesson, Student.name)
        .join(Student, Student.id == Lesson.student_id)
        .where(Lesson.id == lesson_id, Lesson.instructor_id == current.id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    lesson, student_name = row
    return _to_response(lesson, student_name)


@router.put("/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: uuid.UUID,
    body: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> LessonResponse:
    result = await db.execute(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.instructor_id == current.id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    updates = body.model_dump(exclude_unset=True)

    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    if "student_id" in updates:
        sr = await db.execute(
            select(Student).where(
                Student.id == updates["student_id"], Student.instructor_id == current.id
            )
        )
        if not sr.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    for field, value in updates.items():
        setattr(lesson, field, value)
    await db.flush()

    # Re-fetch with student name
    result2 = await db.execute(
        select(Lesson, Student.name)
        .join(Student, Student.id == Lesson.student_id)
        .where(Lesson.id == lesson_id)
    )
    updated_lesson, student_name = result2.one()
    return _to_response(updated_lesson, student_name)


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> None:
    result = await db.execute(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.instructor_id == current.id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    await db.delete(lesson)
    await db.flush()
