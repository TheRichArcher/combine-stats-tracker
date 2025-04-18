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
from sqlmodel import Field, SQLModel, Session, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import logging
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# --- Environment Variables & Config ---
# Load environment variables from .env file for database connection
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@host:port/dbname")

if DATABASE_URL == "postgresql+asyncpg://user:password@host:port/dbname":
    logging.warning("DATABASE_URL not found in environment variables. Using default placeholder.")
    # In a real app, you might want to raise an error or exit if the DB URL isn't set.

# --- Database Setup ---
# Use explicit async engine with connect_args for SSL
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    # future=True, # future=True is default/deprecated in SQLAlchemy 2.0+
    connect_args={"ssl": "require"} # Pass SSL mode via connect_args for asyncpg
)

async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all) # Use cautiously in dev
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
    "http://localhost:5173", # Allow frontend dev server
    # "https://your-frontend-name.onrender.com", # Add your Render frontend URL here!
    # "*" # Use cautiously for testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- Enums ---
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
def calculate_normalized_score(drill_type: DrillType, raw_score: float) -> float:
    """Calculates a normalized score (0-100) based on the drill type and raw score."""
    score = float(raw_score) # Ensure score is float
    normalized_score = 0.0

    if drill_type in LOWER_IS_BETTER_DRILLS:
        config = LOWER_IS_BETTER_DRILLS[drill_type]
        min_val, max_val = config["min"], config["max"]
        if max_val == min_val: return 100.0 # Avoid division by zero if min/max are same
        # Clamp score within bounds
        clamped_score = max(min_val, min(score, max_val))
        # Calculate normalized score (higher is better)
        normalized_score = 100 * (max_val - clamped_score) / (max_val - min_val)

    elif drill_type in HIGHER_IS_BETTER_DRILLS:
        config = HIGHER_IS_BETTER_DRILLS[drill_type]
        min_val, max_val = config["min"], config["max"]
        if max_val == min_val: return 100.0 # Avoid division by zero
        # Clamp score within bounds
        clamped_score = max(min_val, min(score, max_val))
        # Calculate normalized score
        normalized_score = 100 * (clamped_score - min_val) / (max_val - min_val)
    else:
        # Handle unknown drill types if necessary (e.g., return 0 or raise error)
        print(f"Warning: Normalization config not found for drill type: {drill_type}")
        return 0.0 # Default to 0 if config missing

    # Return rounded score to avoid excessive decimals
    return round(normalized_score, 2)

# --- Helper Functions ---
async def calculate_composite_score(
    player_id: int,
    session: AsyncSession,
    weights: Dict[DrillType, float] = DEFAULT_DRILL_WEIGHTS
) -> tuple[float, Dict[DrillType, float]]:
    """Fetches normalized scores, calculates composite score, returns score and best normalized scores."""
    # Fetch all drill results for the player
    result = await session.execute(
        select(DrillResult).where(DrillResult.player_id == player_id)
    )
    drill_results = result.scalars().all()

    total_score = 0.0
    total_weight_applied = 0.0

    best_scores: Dict[DrillType, float] = {}
    for res in drill_results:
        if res.normalized_score is not None:
            # Only consider the best score if multiple attempts exist for the same drill
            if res.drill_type not in best_scores or res.normalized_score > best_scores[res.drill_type]:
                 best_scores[res.drill_type] = res.normalized_score

    # Calculate weighted score based on best scores
    for drill_type, norm_score in best_scores.items():
        weight = weights.get(drill_type, 0) # Default to 0 weight if not defined
        total_score += norm_score * weight
        total_weight_applied += weight

    # Optional: Normalize the final score based on the total weight applied
    # This handles cases where a player might not have scores for all weighted drills.
    # If total_weight_applied is 0, score remains 0.
    if total_weight_applied > 0:
        composite_score = (total_score / total_weight_applied) 
    else:
        composite_score = 0.0
        
    return round(composite_score, 2), best_scores

# --- Models ---
class PlayerBase(SQLModel):
    name: str
    number: int
    age: int
    # photo_url will be handled separately for now

class Player(PlayerBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    photo_url: Optional[str] = Field(default=None) # Store URL or path later

class PlayerCreate(PlayerBase):
    pass # Use PlayerBase fields

class PlayerRead(PlayerBase):
    id: int
    photo_url: Optional[str]

# Updated DrillResult Models
class DrillResultBase(SQLModel):
    player_id: int = Field(foreign_key="player.id")
    drill_type: DrillType
    raw_score: float
    normalized_score: Optional[float] = Field(default=None) # Added normalized_score

class DrillResult(DrillResultBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Add relationship if needed for ORM features, but not strictly necessary for this endpoint
    # player: Optional[Player] = Relationship(back_populates="results")

class DrillResultCreate(DrillResultBase):
    # Exclude normalized_score from create payload, it will be calculated
    model_config = {
        "json_schema_extra": {
            "example": {
                "player_id": 1,
                "drill_type": "40m_dash",
                "raw_score": 5.5
            }
        }
    }
    normalized_score: Optional[float] = Field(default=None, exclude=True)

class DrillResultRead(DrillResultBase):
    id: int
    # normalized_score is inherited from DrillResultBase

# New Response Models for Ranking
class PlayerSummaryRead(PlayerRead):
    composite_score: float

class PlayerRankingRead(PlayerSummaryRead):
    rank: int

# --- API Endpoints ---
@app.post("/players/", response_model=PlayerRead)
async def create_player(
    name: str = Form(...),
    number: int = Form(...),
    age: int = Form(...),
    photo: Optional[UploadFile] = File(None), # Accept photo but don't process/store yet
    session: AsyncSession = Depends(get_session)
):
    print(f"Received player data: Name={name}, Number={number}, Age={age}")
    if photo:
        print(f"Received photo: {photo.filename}, Content-Type: {photo.content_type}")
        # TODO: Implement actual photo saving logic (e.g., to cloud storage)
        # For now, we just acknowledge receipt and save a placeholder or None
        photo_url_placeholder = f"uploads/{photo.filename}" # Example placeholder
    else:
        print("No photo received.")
        photo_url_placeholder = None

    # Create Player instance without the photo file itself
    player_data = PlayerCreate(name=name, number=number, age=age)
    db_player = Player.model_validate(player_data)
    db_player.photo_url = photo_url_placeholder # Assign placeholder URL

    try:
        session.add(db_player)
        await session.commit()
        await session.refresh(db_player)
        print(f"Player created successfully: {db_player}")
        return db_player
    except Exception as e:
        await session.rollback()
        print(f"Error creating player: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

# Updated Drill Result Endpoint
@app.post("/drill-results/", response_model=DrillResultRead)
async def create_drill_result(
    drill_result: DrillResultCreate,
    session: AsyncSession = Depends(get_session)
):
    # Basic validation: Check if player exists (optional but good practice)
    player_exists = await session.get(Player, drill_result.player_id)
    if not player_exists:
        raise HTTPException(status_code=404, detail=f"Player with id {drill_result.player_id} not found")

    print(f"Received drill result data: {drill_result}")

    # Calculate normalized score
    normalized_score = calculate_normalized_score(drill_result.drill_type, drill_result.raw_score)
    print(f"Calculated normalized score: {normalized_score}")

    # Create the database model instance including the normalized score
    db_drill_result = DrillResult.model_validate(drill_result)
    db_drill_result.normalized_score = normalized_score # Assign calculated score

    try:
        session.add(db_drill_result)
        await session.commit()
        await session.refresh(db_drill_result)
        print(f"Drill result created successfully: {db_drill_result}")
        return db_drill_result
    except Exception as e:
        await session.rollback()
        print(f"Error creating drill result: {e}")
        # Consider more specific error handling (e.g., foreign key violation)
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
    age_group: Optional[str] = Query(None, description="Age group filter, e.g., '6-8' or '9-11'"),
    session: AsyncSession = Depends(get_session)
):
    min_age: Optional[int] = None
    max_age: Optional[int] = None

    # Parse age_group string
    if age_group:
        try:
            min_age_str, max_age_str = age_group.split('-')
            min_age = int(min_age_str)
            max_age = int(max_age_str)
            if min_age > max_age:
                raise ValueError("Min age cannot be greater than max age")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid age_group format: {e}. Use 'min-max', e.g., '6-8'.")

    # Build query for players
    query = select(Player)
    if min_age is not None:
        query = query.where(Player.age >= min_age)
    if max_age is not None:
        query = query.where(Player.age <= max_age)

    result = await session.execute(query)
    players = result.scalars().all()

    # Calculate composite score for each player
    player_scores = []
    for player in players:
        composite_score, _ = await calculate_composite_score(player.id, session) # Use default weights
        player_data = player.model_dump()
        player_data['composite_score'] = composite_score
        player_scores.append(player_data)

    # Sort players by composite score (descending)
    player_scores.sort(key=lambda p: p['composite_score'], reverse=True)

    # Assign ranks
    ranked_players = []
    current_rank = 1
    for i, player_data in enumerate(player_scores):
        # Handle ties: if the score is the same as the previous player, assign the same rank
        if i > 0 and player_data['composite_score'] == player_scores[i-1]['composite_score']:
            rank_to_assign = ranked_players[-1]['rank'] # Assign same rank as previous
        else:
            rank_to_assign = current_rank
        
        player_data['rank'] = rank_to_assign
        ranked_players.append(PlayerRankingRead(**player_data))
        current_rank += 1

    return ranked_players

# New: Export rankings endpoint
@app.get("/rankings/export")
async def export_rankings(
    format: Literal["csv", "pdf"] = Query(..., description="Export format: 'csv' or 'pdf'"),
    age_group: Optional[str] = Query(None, description="Age group filter, e.g., '6-8' or '9-11'"),
    session: AsyncSession = Depends(get_session)
):
    # --- 1. Fetch and Rank Players (similar to /rankings endpoint) ---
    min_age: Optional[int] = None
    max_age: Optional[int] = None

    if age_group:
        try:
            min_age_str, max_age_str = age_group.split('-')
            min_age = int(min_age_str)
            max_age = int(max_age_str)
            if min_age > max_age:
                raise ValueError("Min age cannot be greater than max age")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid age_group format: {e}. Use 'min-max', e.g., '6-8'.")

    query = select(Player)
    if min_age is not None:
        query = query.where(Player.age >= min_age)
    if max_age is not None:
        query = query.where(Player.age <= max_age)

    result = await session.execute(query)
    players = result.scalars().all()

    player_data_list = []
    for player in players:
        composite_score, best_normalized_scores = await calculate_composite_score(player.id, session)
        player_info = player.model_dump()
        player_info['composite_score'] = composite_score
        # Add individual normalized scores
        for drill_type_enum in DrillType:
            drill_key = f"{drill_type_enum.value}_norm"
            player_info[drill_key] = best_normalized_scores.get(drill_type_enum, None)
        player_data_list.append(player_info)

    player_data_list.sort(key=lambda p: p['composite_score'], reverse=True)

    ranked_player_export_data = []
    current_rank = 1
    for i, player_data in enumerate(player_data_list):
        if i > 0 and player_data['composite_score'] == player_data_list[i-1]['composite_score']:
            rank_to_assign = ranked_player_export_data[-1]['Rank'] # Use Rank key from export dict
        else:
            rank_to_assign = current_rank
        
        export_entry = {
            "Rank": rank_to_assign,
            "Name": player_data['name'],
            "Number": player_data['number'],
            "Age": player_data['age'],
            "CompositeScore": player_data['composite_score'],
            "PhotoURL": player_data['photo_url'] if player_data['photo_url'] else "N/A",
        }
        # Add individual scores to export entry
        for drill_type_enum in DrillType:
             drill_key = f"{drill_type_enum.value}_norm"
             score = player_data.get(drill_key)
             # Format score for display
             export_entry[drill_type_enum.value] = f"{score:.2f}" if score is not None else "N/A"

        ranked_player_export_data.append(export_entry)
        current_rank += 1

    # --- 2. Generate File Content --- 
    file_content = io.BytesIO() # Use BytesIO for binary formats like PDF
    filename = f"combine_rankings_{age_group if age_group else 'all'}_{datetime.date.today()}.{format}"
    media_type = ""

    if format == "csv":
        media_type = "text/csv"
        df = pd.DataFrame(ranked_player_export_data)
        # Reorder columns for clarity
        column_order = ["Rank", "Name", "Number", "Age", "CompositeScore"] + \
                       [dt.value for dt in DrillType] + ["PhotoURL"]
        df = df[column_order]
        csv_content = df.to_csv(index=False)
        file_content = io.StringIO(csv_content) # Use StringIO for text
        file_content.seek(0)
        # Return as StreamingResponse for text
        return StreamingResponse(file_content, media_type=media_type, headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })

    elif format == "pdf":
        media_type = "application/pdf"
        doc = SimpleDocTemplate(file_content, pagesize=landscape(letter))
        styles = getSampleStyleSheet()
        story = []

        # Title
        title = f"Combine Player Rankings - Age Group: {age_group if age_group else 'All'}"
        story.append(Paragraph(title, styles['h1']))
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(f"Generated on: {datetime.date.today()}", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))

        # Prepare table data
        header = ["Rank", "Name", "Num", "Age", "Comp Score"] + \
                 [dt.value.replace('_',' ').title() for dt in DrillType] + ["Photo URL"]
        table_data = [header]

        for player_data in ranked_player_export_data:
            row = [
                player_data["Rank"],
                player_data["Name"],
                player_data["Number"],
                player_data["Age"],
                f"{player_data['CompositeScore']:.2f}",
            ]
            # Add drill scores
            for drill_type_enum in DrillType:
                 row.append(player_data[drill_type_enum.value]) # Already formatted
            # Add Photo URL
            # TODO: Fetch and embed actual image if URL is valid and accessible
            row.append(player_data["PhotoURL"])
            table_data.append(row)

        if not ranked_player_export_data: # Handle empty data
             story.append(Paragraph("No players found for this age group.", styles['Normal']))
        else:
            # Create and style table
            table = Table(table_data, colWidths=([0.5*inch] + [1.5*inch]*1 + [0.5*inch]*2 + [1.0*inch]*1 + [0.8*inch]*len(DrillType) + [1.5*inch]*1 )) # Adjust widths as needed
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0,0), (-1,-1), 8), # Smaller font for more columns
            ]))
            story.append(table)

        doc.build(story)
        file_content.seek(0)
        # Return as StreamingResponse for binary data
        return StreamingResponse(file_content, media_type=media_type, headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })

    else:
        # Should not happen due to Literal validation, but good practice
        raise HTTPException(status_code=400, detail="Invalid format specified. Use 'csv' or 'pdf'.")

@app.get("/")
async def read_root():
    return {"message": "Combine Stats Tracker Backend"}

# --- Uvicorn Runner (for local development) ---
if __name__ == "__main__":
    import uvicorn
    # Note: Database URL should be configured via environment variables or a .env file
    print(f"Starting Uvicorn server. Ensure PostgreSQL is running and accessible at {DATABASE_URL}")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 