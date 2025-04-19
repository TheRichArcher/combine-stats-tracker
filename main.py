from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

# Assuming database.py and models.py are in the same directory or accessible
import models
import database # Contains get_db function (or equivalent) and init_db
import os

# Initialize DB if needed (similar to Flask setup)
if not os.path.exists('./test.db'):
    print("Initializing database...")
    database.init_db() # Ensure this works standalone or via a script
    print("Database initialized.")

app = FastAPI(title="Combine App API")

# --- CORS Middleware --- NEW
# Define the origins allowed to access the API
# In production, restrict this to your actual frontend domain
# origins = [
#     "https://woo-combine.com",
#     # You might also need http://localhost:xxxx equivalents for local dev
#     # "http://localhost",
#     # "http://localhost:8080", # Example port
#     # "http://localhost:3000", # Example port for React dev server
# ]

# SECOND TEMPORARY TEST: Allow all origins
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PUT", "OPTIONS"], # Allow relevant methods
    allow_headers=["*"], # Allow all headers
)

# --- Database Dependency ---
# (Adapt this based on your database.py setup - assuming a session generator)
def get_db():
    db = database.db_session() # Get a session from scoped_session
    try:
        yield db
    finally:
        database.db_session.remove() # Remove session after request

# --- Authentication Placeholder ---
# Replace this with your actual authentication logic (e.g., OAuth2, JWT)
async def get_current_admin_user(request: Request):
    # --- Placeholder Logic ---
    # In a real app, you'd verify a token from headers (e.g., request.headers.get('Authorization'))
    # and return the user object or raise HTTPException if invalid/not admin.
    print("⚠️ Authentication Check: Placeholder - Allowing access. Implement real auth!")
    # Example check (replace with real logic):
    # if request.headers.get("X-Admin-Token") != "SECRET_ADMIN_TOKEN":
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Not authenticated or not an admin",
    #         headers={"WWW-Authenticate": "Bearer"}, # Or appropriate scheme
    #     )
    # Return a dummy admin user object for now
    class DummyAdmin:
        is_admin = True
    return DummyAdmin()
    # --- End Placeholder ---


# --- Static Files & Templates (If serving index.html from FastAPI) ---
# If React handles routing, you might not need Jinja2Templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory=".") # Serve index.html from root

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serves the main HTML page (likely handled by React router in production)."""
    return templates.TemplateResponse("index.html", {"request": request})


# --- Player Routes ---

@app.get("/players/")
async def get_players(db: Session = Depends(get_db)):
    """Gets a list of all players."""
    players = db.query(models.Player).all()
    # Consider using Pydantic models for response validation later
    player_list = [{'id': p.id, 'name': p.name, 'jersey_number': p.jersey_number} for p in players]
    return player_list

@app.post("/players", status_code=status.HTTP_201_CREATED)
async def add_player(player_data: dict, db: Session = Depends(get_db)): # Use Pydantic model later
    """Adds a new player."""
    if not player_data or 'name' not in player_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing player name")
    try:
        new_player = models.Player(name=player_data['name'], jersey_number=player_data.get('jersey_number'))
        db.add(new_player)
        db.commit()
        db.refresh(new_player) # Refresh to get ID etc.
        return {"status": "success", "player": {'id': new_player.id, 'name': new_player.name, 'jersey_number': new_player.jersey_number}}
    except Exception as e:
        db.rollback()
        # Log the exception e
        print(f"Error adding player: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not add player: {e}")


# --- ADDED: Player Reset Endpoint (FastAPI) ---
@app.delete("/players/reset")
async def reset_players(
    db: Session = Depends(get_db),
    current_admin_user: models.Player = Depends(get_current_admin_user) # Enforce admin auth
):
    """Deletes all players and their associated drill results (Admin Only)."""
    # The Depends(get_current_admin_user) handles the auth check.
    # If the dependency raises HTTPException, this code won't execute.
    try:
        num_results_deleted = db.query(models.DrillResult).delete()
        num_players_deleted = db.query(models.Player).delete()
        db.commit()
        print(f"ADMIN ACTION: Deleted {num_players_deleted} players and {num_results_deleted} drill results.")
        return JSONResponse(
            content={"status": "success", "deleted_count": num_players_deleted},
            status_code=status.HTTP_200_OK
        )
    except Exception as e:
        db.rollback()
        # Log the exception e
        print(f"Error resetting players: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during reset: {e}"
        )

# --- Optional: Run with Uvicorn ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
# Typically run via: uvicorn main:app --reload 