import os
from typing import AsyncGenerator, Optional, List, Dict, Literal
from enum import Enum
import io
import datetime
import pandas as pd
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Body, Query
from sqlmodel import Field, SQLModel, create_engine, Session, select, Column, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import logging
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import NoResultFound # Import for potential future use
from sqlalchemy import Enum as SqlEnum # Import sqlalchemy Enum
from sqlalchemy import Date # Import Date type for birthdate
import csv # Added for CSV parsing
import asyncio # Added for dummy sleep
from fastapi.responses import JSONResponse

# --- Environment Variables & Config ---
# Load environment variables from .env file for database connection
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@host:port/dbname")

if DATABASE_URL == "postgresql+asyncpg://user:password@host:port/dbname":
    logging.warning("DATABASE_URL not found in environment variables. Using default placeholder.")
    # In a real app, you might want to raise an error or exit if the DB URL isn't set.

# --- Database Setup ---
# Use explicit async engine for FastAPI
engine = create_async_engine(DATABASE_URL, echo=True, future=True)

async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all) # Use cautiously in dev - RE-COMMENTED AFTER SCHEMA SYNC
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async_session = AsyncSession(engine, expire_on_commit=False)
    try:
        yield async_session
    finally:
        await async_session.close()

# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    await init_db()
    print("Database initialized.")
    yield
    print("Shutting down...")

# --- FastAPI App Initialization ---
app = FastAPI(lifespan=lifespan)

# --- CORS Configuration ---
# IMPORTANT: Update origins with your deployed frontend URL
# You can use "*" for development, but be specific in production
origins = [
    "https://combine-stats-tracker-frontend.onrender.com", # Keep existing Render URL
    "https://woo-combine.com", # Add the primary domain
    "http://localhost:5173", # Keep for local development if needed
    "http://127.0.0.1:5173" # Keep for local development if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Explicit frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Enums ---
class AgeGroupEnum(str, Enum):
    SIX_U = "6U"
    EIGHT_U = "8U"
    TEN_U = "10U"
    TWELVE_U = "12U"
    FOURTEEN_U = "14U"

class DrillType(str, Enum):
    FORTY_M_DASH = "40m_dash"
    VERTICAL_JUMP = "vertical_jump"
    CATCHING = "catching"
    THROWING = "throwing"
    AGILITY = "agility"

# --- Normalization Constants (Example Values - Should be configurable) ---
# For drills where lower scores are better (e.g., time)
LOWER_IS_BETTER_DRILLS = {
    DrillType.FORTY_M_DASH: {"min": 4.0, "max": 10.0},
    DrillType.AGILITY: {"min": 8.0, "max": 20.0},
}
# For drills where higher scores are better
HIGHER_IS_BETTER_DRILLS = {
    DrillType.VERTICAL_JUMP: {"min": 0.0, "max": 50.0}, # Inches
    DrillType.CATCHING: {"min": 0.0, "max": 20.0},   # Number of catches
    DrillType.THROWING: {"min": 0.0, "max": 100.0},  # Example: Velocity or Distance
}

# --- Default Weights (Example - Should be configurable per event) ---
DEFAULT_DRILL_WEIGHTS: Dict[DrillType, float] = {
    DrillType.FORTY_M_DASH: 0.30, # 30%
    DrillType.VERTICAL_JUMP: 0.20, # 20%
    DrillType.AGILITY: 0.20, # 20%
    DrillType.THROWING: 0.15, # 15%
    DrillType.CATCHING: 0.15, # 15%
}

# --- Normalization Function ---
def calculate_normalized_score(drill_type: DrillType, raw_score: str) -> int:
    """Calculates a normalized score (0-100) based on the drill type and raw score."""
    try:
        # TODO: Implement robust parsing for different raw_score formats (e.g., "7/10", "5.12 sec")
        # For now, assume it can be directly converted to float after removing potential text (like " sec")
        score_str = raw_score.split()[0] # Basic attempt to get the number part
        score = float(score_str)
    except ValueError:
        print(f"Warning: Could not parse raw_score '{raw_score}' to float for drill type {drill_type}. Returning 0.")
        return 0 # Cannot calculate if parsing fails

    normalized_score = 0.0

    if drill_type in LOWER_IS_BETTER_DRILLS:
        config = LOWER_IS_BETTER_DRILLS[drill_type]
        min_val, max_val = config["min"], config["max"]
        if max_val == min_val: return 100 # Return int
        clamped_score = max(min_val, min(score, max_val))
        normalized_score = 100 * (max_val - clamped_score) / (max_val - min_val)

    elif drill_type in HIGHER_IS_BETTER_DRILLS:
        config = HIGHER_IS_BETTER_DRILLS[drill_type]
        min_val, max_val = config["min"], config["max"]
        if max_val == min_val: return 100 # Return int
        clamped_score = max(min_val, min(score, max_val))
        normalized_score = 100 * (clamped_score - min_val) / (max_val - min_val)
    else:
        print(f"Warning: Normalization config not found for drill type: {drill_type}")
        return 0 # Return int

    # Return rounded integer score
    return int(round(normalized_score)) # Cast to int

# --- Helper Functions ---

# Map age groups to number ranges
AGE_GROUP_RANGES = {
    "6U": (600, 699),
    "8U": (800, 899),
    "10U": (1000, 1099),
    "12U": (1200, 1299),
    "14U": (1400, 1499),
}

async def generate_player_number(age_group: str, session: AsyncSession) -> int:
    """Generates the next available player number for the given age group."""
    if age_group not in AGE_GROUP_RANGES:
        raise HTTPException(status_code=400, detail=f"Invalid age group specified: {age_group}")

    start, end = AGE_GROUP_RANGES[age_group]

    # Find existing numbers in the range
    result = await session.execute(
        select(Player.number)
        .where(Player.number >= start, Player.number <= end)
    )
    used_numbers = set(result.scalars().all())

    # Find the lowest available number
    for num in range(start, end + 1):
        if num not in used_numbers:
            return num

    # If no number is found
    raise HTTPException(status_code=409, detail=f"No available player numbers left in age group {age_group}")

async def calculate_composite_score(
    player_id: int,
    session: AsyncSession,
    weights: Dict[DrillType, float] = DEFAULT_DRILL_WEIGHTS
) -> tuple[float, Dict[DrillType, int], Dict[DrillType, str]]:
    """
    Fetches normalized scores, calculates composite score ensuring all drill types 
    are considered (missing drills count as 0 normalized points). 
    Returns composite score, best normalized scores (potentially including 0 for missing), 
    and best raw scores (only for drills attempted).
    """
    # Fetch all drill results for the player
    result = await session.execute(
        select(DrillResult).where(DrillResult.player_id == player_id)
    )
    drill_results = result.scalars().all()

    # Find the best normalized and raw score for each *attempted* drill
    attempted_best_normalized_scores: Dict[DrillType, int] = {}
    attempted_best_raw_scores: Dict[DrillType, str] = {} 
    for res in drill_results:
        if res.normalized_score is not None:
            if res.drill_type not in attempted_best_normalized_scores or res.normalized_score > attempted_best_normalized_scores[res.drill_type]:
                 attempted_best_normalized_scores[res.drill_type] = res.normalized_score
                 attempted_best_raw_scores[res.drill_type] = res.raw_score 

    total_score = 0.0
    total_weight_applied = 0.0 # This will now sum weights for ALL drill types

    # Iterate through ALL possible drill types defined in the Enum
    for drill_type in DrillType: 
        # Get the best score for this drill type, default to 0 if not attempted
        norm_score = attempted_best_normalized_scores.get(drill_type, 0) 
        
        # Get the weight for this drill type
        weight = weights.get(drill_type, 0) # Use default weight from DEFAULT_DRILL_WEIGHTS

        # Add to the weighted total score
        total_score += norm_score * weight
        
        # Add the weight of this drill type to the total weight divisor
        total_weight_applied += weight

    # Calculate the final composite score
    if total_weight_applied > 0:
        composite_score = (total_score / total_weight_applied)
    else:
        # Should only happen if weights are all zero or DrillType enum is empty
        composite_score = 0.0

    # --- Return Values ---
    # The `best_normalized_scores` returned might now include 0s for drills the player didn't attempt,
    # which might be useful for some display purposes, but the primary impact is the composite score.
    # The `best_raw_scores` dictionary still only contains scores for drills actually attempted.
    
    # Create the final dictionary of normalized scores to return (including 0s for missing)
    final_normalized_scores = {dt: attempted_best_normalized_scores.get(dt, 0) for dt in DrillType}

    return round(composite_score, 2), final_normalized_scores, attempted_best_raw_scores

# --- Models ---
# Define the allowed age group literals
# AllowedAgeGroup = Literal["6U", "8U", "10U", "12U", "14U"]

class PlayerBase(SQLModel):
    name: str
    # Use AgeGroupEnum with sa_column for database mapping, disable native enum
    age_group: AgeGroupEnum = Field(sa_column=Column(SqlEnum(AgeGroupEnum, native_enum=False)))

class Player(PlayerBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    number: Optional[int] = Field(default=None, unique=True)
    photo_url: Optional[str] = Field(default=None)

class PlayerCreate(SQLModel):
    name: str
    age_group: AgeGroupEnum # Use Enum for request validation too

class PlayerRead(PlayerBase):
    id: int
    number: Optional[int]
    photo_url: Optional[str]

# Updated DrillResult Models
class DrillResultBase(SQLModel):
    player_id: int = Field(foreign_key="player.id")
    drill_type: DrillType
    raw_score: str
    normalized_score: Optional[int] = Field(default=None)

class DrillResult(DrillResultBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class DrillResultCreate(SQLModel):
    player_number: int
    drill_type: DrillType
    raw_score: str
    # Exclude normalized_score from create payload

    model_config = {
        "json_schema_extra": {
            "example": {
                "player_number": 1400,
                "drill_type": "40m_dash",
                "raw_score": "5.12 sec"
            }
        }
    }

class DrillResultRead(DrillResultBase):
    id: int

# --- >>> NEW: Model for updating raw_score <<< ---
class DrillResultUpdate(SQLModel):
    raw_score: str
# --- <<< END NEW MODEL >>> --- 

# New Response Models for Ranking
class PlayerSummaryRead(PlayerRead):
    composite_score: float

class PlayerRankingRead(PlayerSummaryRead):
    rank: int

# --- >>> NEW: Model for transferring age group <<< ---
class PlayerTransferAgeGroup(SQLModel):
    new_age_group: AgeGroupEnum
# --- <<< END NEW MODEL >>> ---

# --- API Endpoints ---
@app.post("/players/", response_model=PlayerRead)
async def create_player(
    name: str = Form(...),
    age_group: AgeGroupEnum = Form(...), # Use Enum here too
    photo: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_session)
):
    print(f"Received player data: Name={name}, Age Group={age_group}")

    # Generate the next available player number
    try:
        new_number = await generate_player_number(age_group, session)
        print(f"Generated player number: {new_number}")
    except HTTPException as e:
        # Propagate HTTPException (e.g., 400 invalid group, 409 no numbers left)
        raise e
    except Exception as e:
        # Catch unexpected errors during number generation
        print(f"Unexpected error generating number: {e}")
        raise HTTPException(status_code=500, detail="Error generating player number")

    if photo:
        print(f"Received photo: {photo.filename}, Content-Type: {photo.content_type}")
        # TODO: Implement actual photo saving logic
        photo_url_placeholder = f"uploads/{photo.filename}"
    else:
        print("No photo received.")
        photo_url_placeholder = None

    # Create Player instance
    player_data = PlayerCreate(name=name, age_group=age_group)
    # Use the full Player model for DB creation, setting generated/derived fields
    db_player = Player.model_validate(player_data)
    db_player.number = new_number
    db_player.photo_url = photo_url_placeholder

    try:
        session.add(db_player)
        await session.commit()
        await session.refresh(db_player)
        print(f"Player created successfully: {db_player}")
        # Return the full player data including the generated number
        return db_player
    except Exception as e:
        await session.rollback()
        # Check for unique constraint violation (likely number collision if generation logic had race condition)
        if "unique constraint" in str(e).lower():
             print(f"Error: Potential number collision for number {new_number}. Error: {e}")
             raise HTTPException(status_code=409, detail=f"Failed to assign unique player number. Please try again.")
        print(f"Error creating player in DB: {e}")
        raise HTTPException(status_code=500, detail=f"Database error during player creation: {e}")

# Updated Drill Result Endpoint
@app.post("/drill-results/", response_model=DrillResultRead)
async def create_drill_result(
    drill_result: DrillResultCreate,
    session: AsyncSession = Depends(get_session)
):
    # Find player by their number
    player_result = await session.execute(
        select(Player).where(Player.number == drill_result.player_number)
    )
    player = player_result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail=f"Player with number {drill_result.player_number} not found")

    print(f"Found player: {player} based on number {drill_result.player_number}")
    print(f"Received drill result data: {drill_result}")

    # Calculate normalized score (now accepts str, returns int)
    normalized_score = calculate_normalized_score(drill_result.drill_type, drill_result.raw_score)
    print(f"Calculated normalized score: {normalized_score}")

    # Create the database model instance (raw_score is str, normalized_score is int)
    db_drill_result = DrillResult(
        player_id=player.id,
        drill_type=drill_result.drill_type,
        raw_score=drill_result.raw_score,
        normalized_score=normalized_score
    )

    try:
        session.add(db_drill_result)
        await session.commit()
        await session.refresh(db_drill_result)
        print(f"Drill result created successfully: {db_drill_result}")
        return db_drill_result
    except Exception as e:
        await session.rollback()
        print(f"Error creating drill result: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

# New: Get list of all players
@app.get("/players/", response_model=List[PlayerRead])
async def read_players(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Player))
    players = result.scalars().all()
    return players

# New: Get drill results for a specific player
@app.get("/players/{player_id}/results/", response_model=List[DrillResultRead])
async def read_player_drill_results(
    player_id: int,
    session: AsyncSession = Depends(get_session)
):
    # Check if player exists first
    player = await session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail=f"Player with id {player_id} not found")

    # Query for drill results associated with the player_id
    result = await session.execute(
        select(DrillResult).where(DrillResult.player_id == player_id)
    )
    drill_results = result.scalars().all()
    return drill_results

# New: Get player summary with composite score
@app.get("/players/{player_id}/summary/", response_model=PlayerSummaryRead)
async def read_player_summary(
    player_id: int,
    session: AsyncSession = Depends(get_session)
):
    player = await session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail=f"Player with id {player_id} not found")

    composite_score, _ = await calculate_composite_score(player_id, session) # Use default weights for now

    # Combine player data with the score
    summary_data = player.model_dump()
    summary_data['composite_score'] = composite_score
    return PlayerSummaryRead(**summary_data)

# New: Get rankings by age group
@app.get("/rankings/", response_model=List[PlayerRankingRead])
async def read_rankings(
    # Use Enum for query parameter validation
    age_group: Optional[AgeGroupEnum] = Query(None, description="Age group filter (6U, 8U, 10U, 12U, 14U)"),
    session: AsyncSession = Depends(get_session)
):
    # Build query for players
    query = select(Player)
    if age_group:
        # Filter directly on the age_group Enum value
        query = query.where(Player.age_group == age_group)

    try:
        result = await session.execute(query)
        players = result.scalars().all()
    except Exception as e:
        logging.error(f"Error fetching players for ranking: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching players")

    # Calculate composite score for each player
    player_scores = []
    for player in players:
        try:
            # Use all return values from calculate_composite_score
            composite_score, _, _ = await calculate_composite_score(player.id, session) 
            player_data = player.model_dump()
            player_data['composite_score'] = composite_score
            player_scores.append(player_data)
        except Exception as e:
            logging.error(f"Error calculating composite score for player {player.id} ({player.name}): {e}")
            # Optionally skip this player or assign a default score
            # For now, skip the player to avoid breaking the ranking
            continue 

    # Sort players by composite score (descending)
    player_scores.sort(key=lambda p: p['composite_score'], reverse=True)

    # Assign ranks - Simpler logic
    ranked_players = []
    current_rank = 1
    last_score = None
    players_at_current_rank = 0

    for i, player_data in enumerate(player_scores):
        score = player_data['composite_score']
        
        if i > 0 and score == last_score:
            # Tied with the previous player(s), assign the same rank
            rank_to_assign = ranked_players[-1].rank
            players_at_current_rank += 1 # Increment count of players at this rank
        else:
            # New score or first player
            # The rank is the previous rank + number of players tied at that previous rank
            rank_to_assign = current_rank 
            current_rank += players_at_current_rank # Add the count of players from the *previous* rank
            players_at_current_rank = 1 # Reset count for the new rank
            current_rank = rank_to_assign # Set current_rank to the rank just assigned

        player_data['rank'] = rank_to_assign
        try:
            ranked_players.append(PlayerRankingRead(**player_data))
            last_score = score # Update last score seen
            current_rank +=1 # Increment for the next rank position
        except Exception as e:
            # Log error if Pydantic validation fails for some reason
            logging.error(f"Error creating PlayerRankingRead for data {player_data}: {e}")
            # Skip this player if validation fails
            continue

    return ranked_players

# +++ DEBUGGING: Add simple healthcheck route +++
@app.get("/healthcheck")
async def health_check():
    print("+++ DEBUG: /healthcheck endpoint reached +++")
    return {"status": "ok"}
# +++ END DEBUGGING +++

# +++ DEBUGGING: Add simplified reset route +++
@app.delete("/admin/reset")
async def reset_players(
    session: AsyncSession = Depends(get_session) # <-- Uncomment DB session dependency
):
    """Deletes all players and their associated drill results (Admin Only)."""
    print("--- DEBUG: reset_players function entered - Attempting DB delete ---")
    try:
        # Note: SQLModel doesn't directly support bulk delete on the model itself easily with async.
        # We use SQLAlchemy core delete statements.
        # Import delete if not already imported
        from sqlmodel import delete

        # Delete Drill Results first due to foreign key constraint
        delete_results_stmt = delete(DrillResult)
        result_results = await session.execute(delete_results_stmt)
        deleted_results_count = result_results.rowcount

        # Delete Players
        delete_players_stmt = delete(Player)
        result_players = await session.execute(delete_players_stmt)
        deleted_players_count = result_players.rowcount
        
        await session.commit()
        print(f"ADMIN ACTION: Deleted {deleted_players_count} players and {deleted_results_count} drill results.")
        return JSONResponse(
            content={"status": "success", "deleted_players": deleted_players_count, "deleted_results": deleted_results_count},
            status_code=200
        )
    except Exception as e:
        await session.rollback()
        print(f"Error resetting players: {e}")
        raise HTTPException(status_code=500, detail=f"Database error during reset: {e}")

# +++ END DEBUGGING +++

# New: Export rankings endpoint
@app.get("/rankings/export")
async def export_rankings(
    format: Literal["csv", "pdf"] = Query(..., description="Export format: 'csv' or 'pdf'"),
    age_group: Optional[AgeGroupEnum] = Query(None, description="Age group filter (6U, 8U, 10U, 12U, 14U)"),
    session: AsyncSession = Depends(get_session)
):
    # --- 1. Fetch and Rank Players ---
    query = select(Player)
    if age_group:
        query = query.where(Player.age_group == age_group)

    result = await session.execute(query)
    players = result.scalars().all()

    player_data_list = []
    for player in players:
        # Fetch composite score, best normalized scores, AND best raw scores
        composite_score, best_normalized_scores, best_raw_scores = await calculate_composite_score(player.id, session)
        player_info = player.model_dump()
        player_info['composite_score'] = composite_score
        # Store the raw scores corresponding to the best normalized attempts
        player_info['best_raw_scores'] = best_raw_scores
        # # We might not need to store best_normalized_scores here anymore if only composite and raw are needed for export
        # for drill_type_enum in DrillType:
        #     drill_key = f"{drill_type_enum.value}_norm"
        #     player_info[drill_key] = best_normalized_scores.get(drill_type_enum, None)
        player_data_list.append(player_info)

    player_data_list.sort(key=lambda p: p['composite_score'], reverse=True)

    ranked_player_export_data = []
    current_rank = 1
    for i, player_data in enumerate(player_data_list):
        if i > 0 and player_data['composite_score'] == player_data_list[i-1]['composite_score']:
            rank_to_assign = ranked_player_export_data[-1]['Rank']
        else:
            rank_to_assign = current_rank

        export_entry = {
            "Rank": rank_to_assign,
            "Name": player_data['name'],
            "Number": player_data['number'],
            "AgeGroup": player_data['age_group'],
            "CompositeScore": player_data['composite_score'],
            "PhotoURL": player_data['photo_url'] if player_data['photo_url'] else "N/A",
        }
        # Add individual RAW scores to export entry
        retrieved_raw_scores = player_data.get('best_raw_scores', {}) # Get the raw scores dict
        for drill_type_enum in DrillType:
             raw_score = retrieved_raw_scores.get(drill_type_enum)
             # Use the raw score string directly, or "N/A" if missing
             export_entry[drill_type_enum.value] = raw_score if raw_score is not None else "N/A"

        ranked_player_export_data.append(export_entry)
        current_rank += 1 # Increment rank for the next player regardless of ties for display

    # --- 2. Generate File Content --- 
    file_content = io.BytesIO() # Use BytesIO for binary formats like PDF
    filename = f"combine_rankings_{age_group if age_group else 'all'}_{datetime.date.today()}.{format}"
    media_type = ""

    if format == "csv":
        media_type = "text/csv"
        output = io.StringIO() # Use StringIO for text data
        writer = csv.writer(output)

        # Write header row dynamically including drill types
        header = ["Rank", "Name", "Number", "AgeGroup", "CompositeScore"]
        for drill_type_enum in DrillType:
            header.append(drill_type_enum.value.replace("_", " ").title())
        writer.writerow(header)

        # Write player data rows
        for player_data in ranked_player_export_data:
            age_group_val = player_data["AgeGroup"]
            if isinstance(age_group_val, AgeGroupEnum):
                age_group_val = age_group_val.value
            
            row = [
                str(player_data["Rank"]),
                str(player_data["Name"]),
                str(player_data["Number"]),
                str(age_group_val),
                f"{player_data['CompositeScore']:.2f}",
            ]
            # Add raw drill scores
            for drill_type_enum in DrillType:
                 row.append(player_data[drill_type_enum.value]) 
            writer.writerow(row)

        # Reset the stream position to the beginning
        output.seek(0)
        
        # Return StreamingResponse directly with the StringIO object
        return StreamingResponse(output, media_type=media_type, headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })

    elif format == "pdf":
        media_type = "application/pdf"
        doc = SimpleDocTemplate(file_content, pagesize=landscape(letter))
        styles = getSampleStyleSheet()
        story = []

        # Title - Use .value for Enum
        age_group_str = age_group.value if age_group else 'All'
        title = f"Combine Player Rankings - Age Group: {age_group_str}"
        story.append(Paragraph(title, styles['h1']))
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(f"Generated on: {datetime.date.today()}", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))

        # Prepare table data - Remove Photo URL from header
        header = ["Rank", "Name", "Number", "Age Group", "Composite Score"] + \
                 [dt.value.replace('_',' ').title() for dt in DrillType] # Removed: + ["Photo URL"]
        table_data = [header]

        for player_data in ranked_player_export_data:
            # Ensure age_group is the string value
            age_group_val = player_data["AgeGroup"]
            if isinstance(age_group_val, AgeGroupEnum):
                age_group_val = age_group_val.value
            
            row = [
                str(player_data["Rank"]),
                str(player_data["Name"]),
                str(player_data["Number"]),
                str(age_group_val),
                f"{player_data['CompositeScore']:.2f}",
            ]
            # Add drill scores (already formatted as strings or 'N/A')
            for drill_type_enum in DrillType:
                 row.append(player_data[drill_type_enum.value])
            # Removed: row.append(player_data["PhotoURL"])
            table_data.append(row)

        if not ranked_player_export_data: # Handle empty data
             story.append(Paragraph("No players found for this age group.", styles['Normal']))
        else:
            # Create and style table - Remove Photo URL width, adjust others
            table = Table(table_data, colWidths=([0.5*inch] + [1.8*inch]*1 + [0.7*inch]*1 + [0.9*inch]*1 + [1.1*inch]*1 + [0.9*inch]*len(DrillType) )) # Total width reduced
            # Updated TableStyle (mostly unchanged, ensures bold header)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'), # Center align all
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), # Bold header
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0,0), (-1,-1), 0.5, colors.grey), # Thinner grid lines
                ('FONTSIZE', (0,0), (-1,0), 10), # Header font size
                ('FONTSIZE', (0,1), (-1,-1), 9),  # Body font size
                ('BOTTOMPADDING', (0,0), (-1,-1), 4), # Reduce padding
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), # Vertical alignment
            ]))
            story.append(table)

        doc.build(story)
        file_content.seek(0)
        # Return as StreamingResponse for binary data
        return StreamingResponse(file_content, media_type=media_type, headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })

    else:
        # Should not happen due to Enum validation, but good practice
        raise HTTPException(status_code=400, detail="Invalid format specified. Use 'csv' or 'pdf'.")

@app.get("/")
async def read_root():
    return {"message": "Combine Stats Tracker Backend"}

# --- NEW CSV Upload Endpoint ---
@app.post("/players/upload_csv")
async def upload_players_csv(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Uploads a CSV file to bulk-create player profiles.
    Extracts 'Player First Name', 'Player Last Name', 'Player Birth Date', 'Division Name'.
    Validates required fields and 'Division Name' against allowed AgeGroupEnum values.
    Skips rows with invalid data.
    Returns a summary of the import process.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV file.")

    content = await file.read()
    # Decode content and wrap in a StringIO object for csv.reader
    content_str = content.decode('utf-8')
    csvfile = io.StringIO(content_str)

    processed_rows = 0
    imported_count = 0
    skipped_rows = [] # List to store details of skipped rows (e.g., row number, reason, data)

    # Define allowed age groups for validation (case-insensitive mapping)
    allowed_age_groups = {ag.value.upper(): ag for ag in AgeGroupEnum}

    try:
        reader = csv.DictReader(csvfile)
        headers = reader.fieldnames
        print(f"CSV Headers: {headers}")

        # --- Header Validation (optional but recommended) ---
        required_headers = ["Player First Name", "Player Last Name", "Division Name"]
        if not all(h in headers for h in required_headers):
             missing = [h for h in required_headers if h not in headers]
             raise HTTPException(status_code=400, detail=f"Missing required CSV headers: {', '.join(missing)}")
        # --- End Header Validation ---

        for i, row in enumerate(reader):
            row_num = i + 2 # Adding 2 for 1-based index + header row
            processed_rows += 1
            player_first_name = row.get("Player First Name", "").strip()
            player_last_name = row.get("Player Last Name", "").strip()
            division_name = row.get("Division Name", "").strip()

            # --- Data Validation ---
            if not player_first_name or not player_last_name:
                skipped_rows.append({"row": row_num, "reason": "Missing required field (First or Last Name)", "data": row})
                continue

            if not division_name:
                skipped_rows.append({"row": row_num, "reason": "Missing Division Name", "data": row})
                continue

            # Validate and map age group (case-insensitive)
            age_group_enum = allowed_age_groups.get(division_name.upper())
            if not age_group_enum:
                skipped_rows.append({"row": row_num, "reason": f"Invalid or unsupported Division Name: '{division_name}'", "data": row})
                continue

            # --- End Data Validation ---

            try:
                # Generate player number
                new_number = await generate_player_number(age_group_enum, session)

                # Create Player instance
                player_name = f"{player_first_name} {player_last_name}"
                player_data = PlayerCreate(name=player_name, age_group=age_group_enum)
                db_player = Player.model_validate(player_data)
                db_player.number = new_number
                db_player.photo_url = None # No photo upload via CSV

                # Add to session (commit later for efficiency)
                session.add(db_player)
                imported_count += 1

            except HTTPException as e:
                # Catch known errors like no available numbers
                skipped_rows.append({"row": row_num, "reason": f"Failed to create player: {e.detail}", "data": row})
                await session.rollback() # Rollback potential partial changes for this row
                continue # Continue to next row
            except Exception as e:
                # Catch unexpected errors during player creation/number generation
                logging.error(f"Error processing row {row_num}: {e}")
                skipped_rows.append({"row": row_num, "reason": f"Internal server error during processing: {e}", "data": row})
                await session.rollback()
                continue # Continue to next row

        # Commit all successfully processed players at once
        if imported_count > 0:
            await session.commit()
            # Note: Refreshing individual players after bulk commit is complex/inefficient.
            # The response confirms import count, frontend can refresh list if needed.

        return {
            "message": "CSV processing complete.",
            "processed_rows": processed_rows,
            "imported_count": imported_count,
            "skipped_count": len(skipped_rows),
            "skipped_details": skipped_rows # Optionally return details
        }

    except Exception as e:
        logging.error(f"Error processing CSV file {file.filename}: {e}")
        await session.rollback() # Ensure rollback if error happens during reading/initial processing
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {e}")

    finally:
        await file.close()

# --- >>> NEW: Endpoint to update a specific drill result <<< ---
@app.patch("/drill-results/{result_id}", response_model=DrillResultRead)
async def update_drill_result(
    result_id: int,
    update_data: DrillResultUpdate, 
    session: AsyncSession = Depends(get_session),
    # TODO: Add admin authentication dependency here, e.g.:
    # current_admin_user: User = Depends(get_current_admin_user) 
):
    """Updates the raw_score for a specific drill result and recalculates normalized_score."""
    
    # Fetch the existing drill result
    db_result = await session.get(DrillResult, result_id)
    if not db_result:
        raise HTTPException(status_code=404, detail="Drill result not found")

    print(f"Updating drill result ID: {result_id}")
    print(f"Original raw_score: {db_result.raw_score}, New raw_score: {update_data.raw_score}")

    # Update the raw score
    db_result.raw_score = update_data.raw_score
    
    # Recalculate the normalized score
    try:
        # Use the existing drill_type from the fetched record
        db_result.normalized_score = calculate_normalized_score(db_result.drill_type, db_result.raw_score)
        print(f"Recalculated normalized_score: {db_result.normalized_score}")
    except Exception as e:
        # Log if calculation fails, but potentially proceed depending on requirements
        # Maybe should raise 422 if new raw_score is unparseable?
        logging.error(f"Could not recalculate normalized score for drill result {result_id} with raw score '{db_result.raw_score}': {e}")
        # For now, we might allow saving the raw score even if normalization fails, setting norm_score to None/0
        # db_result.normalized_score = None # Or 0, depending on desired behavior
        # Let's raise an error if calculation fails, as it implies invalid input
        raise HTTPException(status_code=422, detail=f"Could not process raw_score '{db_result.raw_score}' for normalization.")

    # Save changes to the database
    try:
        session.add(db_result)
        await session.commit()
        await session.refresh(db_result)
        print(f"Drill result {result_id} updated successfully.")
        return db_result
    except Exception as e:
        await session.rollback()
        logging.error(f"Database error updating drill result {result_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error during update")
# --- <<< END NEW ENDPOINT >>> --- 

# --- >>> NEW: Endpoint to delete a specific drill result <<< ---
@app.delete("/drill-results/{result_id}")
async def delete_drill_result(
    result_id: int,
    session: AsyncSession = Depends(get_session),
    # TODO: Add admin authentication dependency here
):
    """Deletes a specific drill result by its ID."""
    
    # Fetch the existing drill result
    db_result = await session.get(DrillResult, result_id)
    if not db_result:
        raise HTTPException(status_code=404, detail="Drill result not found")

    print(f"Deleting drill result ID: {result_id}")

    # Delete from the database
    try:
        await session.delete(db_result)
        await session.commit()
        print(f"Drill result {result_id} deleted successfully.")
        return {"message": "Drill result deleted successfully."}
    except Exception as e:
        await session.rollback()
        logging.error(f"Database error deleting drill result {result_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error during deletion")
# --- <<< END NEW DELETE ENDPOINT >>> ---

# --- >>> NEW: Endpoint to transfer a player's age group <<< ---
@app.patch("/players/{player_id}/transfer-age-group", response_model=PlayerRead)
async def transfer_player_age_group(
    player_id: int,
    transfer_data: PlayerTransferAgeGroup,
    session: AsyncSession = Depends(get_session),
    # TODO: Add admin authentication dependency here, e.g.:
    # current_admin_user: User = Depends(get_current_admin_user)
):
    """Updates the age_group for a specific player."""
    
    # Fetch the player
    player = await session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail=f"Player with id {player_id} not found")

    print(f"Transferring player ID: {player_id} ({player.name}) from {player.age_group} to {transfer_data.new_age_group}")

    # Update the age group
    player.age_group = transfer_data.new_age_group
    
    # Save changes to the database
    try:
        session.add(player) # Add the updated player instance to the session
        await session.commit()
        await session.refresh(player)
        print(f"Player {player_id} age group updated successfully to {player.age_group}.")
        return player
    except Exception as e:
        await session.rollback()
        logging.error(f"Database error transferring player {player_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error during player transfer")
# --- <<< END NEW TRANSFER ENDPOINT >>> ---

# --- Uvicorn Runner (for local development) ---
if __name__ == "__main__":
    import uvicorn
    # Note: Database URL should be configured via environment variables or a .env file
    print(f"Starting Uvicorn server. Ensure PostgreSQL is running and accessible at {DATABASE_URL}")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 