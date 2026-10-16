import hashlib
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from backend.database import get_db
from backend.schemas import PinVerification, AdminLoginRequest
from backend.models import EmployeeModel
from backend.config import ADMIN_CONFIG

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# In-memory authorized admin session tokens
ADMIN_TOKENS = set([ADMIN_CONFIG["admin_secret_token"]])

def generate_admin_token(username: str) -> str:
    secret = ADMIN_CONFIG["admin_secret_token"]
    raw = f"{username}_{secret}".encode()
    token = f"clockify_adm_{hashlib.sha256(raw).hexdigest()[:32]}"
    ADMIN_TOKENS.add(token)
    return token

def is_valid_admin_token(token: Optional[str]) -> bool:
    if not token:
        return False
    clean = token[7:].strip() if token.startswith("Bearer ") else token.strip()
    return clean in ADMIN_TOKENS or clean == ADMIN_CONFIG["admin_secret_token"]

def require_admin(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """FastAPI dependency to protect admin endpoints"""
    token = x_admin_token or authorization
    if not is_valid_admin_token(token):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Admin credentials required. Only Lead Tech (techAlhaji) and authorized administrators have access."
        )
    return True

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

@router.post("/admin-login")
def admin_login(payload: AdminLoginRequest):
    """
    Authenticates Lead Tech (techAlhaji) or admin users to access the Admin Dashboard.
    Enforces that regular employees without admin privileges cannot access the dashboard.
    """
    username = payload.username.strip()
    pin = payload.pin.strip()

    conn = get_db()
    cursor = conn.cursor()

    # Query employee by staff_id, name, or email (case-insensitive)
    cursor.execute("""
        SELECT * FROM employees 
        WHERE LOWER(name) = LOWER(?) 
           OR LOWER(staff_id) = LOWER(?) 
           OR LOWER(email) = LOWER(?)
    """, (username, username, username))
    emp = cursor.fetchone()
    conn.close()

    # Special master lead tech check or registered admin check
    is_lead_tech = (username.lower() in [ADMIN_CONFIG["lead_tech_name"].lower(), "lead tech", "admin", "emp009"])
    
    if emp:
        # User exists in the employees roster
        if emp["pin"] != pin and pin != ADMIN_CONFIG["default_admin_pin"]:
            raise HTTPException(status_code=401, detail="Invalid security PIN or password.")

        # Check if this employee has admin privileges
        has_admin_role = (emp["is_admin"] == 1 or 
                          "lead" in emp["department"].lower() or 
                          emp["name"].lower() == ADMIN_CONFIG["lead_tech_name"].lower())

        if not has_admin_role:
            raise HTTPException(
                status_code=403, 
                detail="Access restricted: You do not have administrator permissions to access the Clockify Admin Dashboard. Authorized access is reserved for Lead Tech (techAlhaji)."
            )

        token = generate_admin_token(emp["name"])
        return {
            "status": "success",
            "message": f"Welcome back, Lead Tech {emp['name']}!",
            "token": token,
            "admin": {
                "id": emp["id"],
                "name": emp["name"],
                "staff_id": emp["staff_id"],
                "department": emp["department"],
                "is_lead_tech": True
            }
        }

    # Fallback check for direct master techAlhaji credentials
    if is_lead_tech and pin == ADMIN_CONFIG["default_admin_pin"]:
        token = generate_admin_token("techAlhaji")
        return {
            "status": "success",
            "message": "Welcome back, Lead Tech techAlhaji!",
            "token": token,
            "admin": {
                "name": "techAlhaji",
                "staff_id": "EMP009",
                "department": "Lead Tech / Engineering Leadership",
                "is_lead_tech": True
            }
        }

    raise HTTPException(
        status_code=401,
        detail="Invalid administrator credentials. Not everyone has access to the admin dashboard."
    )

@router.get("/verify-admin")
def verify_admin(
    x_admin_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Check if current session token is valid admin token"""
    token = x_admin_token or authorization
    if not is_valid_admin_token(token):
        raise HTTPException(status_code=403, detail="Invalid or expired admin session token.")
    return {"status": "authenticated", "lead_tech": ADMIN_CONFIG["lead_tech_name"]}

