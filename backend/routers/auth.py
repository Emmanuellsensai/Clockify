from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.schemas import PinVerification
from backend.models import EmployeeModel

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/verify-pin")
def verify_pin(payload: PinVerification):
    """
    Verifies that the provided employee ID and PIN match.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM employees WHERE id = ? AND pin = ?", (payload.employee_id, payload.pin))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid Employee ID or Security PIN")

    return {
        "status": "success",
        "message": "Authentication successful",
        "employee": EmployeeModel.to_dict(row)
    }
