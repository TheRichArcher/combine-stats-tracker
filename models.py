from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# Placeholder Player model - adapt to your actual schema
class Player(Base):
    __tablename__ = 'players'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    jersey_number = Column(Integer, unique=True, nullable=True) # Example field

    # Relationship to DrillResult (if you want to delete related results)
    drill_results = relationship("DrillResult", back_populates="player", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Player {self.name!r}>'

# Placeholder DrillResult model - adapt to your actual schema
class DrillResult(Base):
    __tablename__ = 'drill_results'
    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey('players.id'), nullable=False)
    drill_name = Column(String(100), nullable=False) # Example field
    score = Column(Integer) # Example field

    player = relationship("Player", back_populates="drill_results")

    def __repr__(self):
        return f'<DrillResult {self.drill_name} for Player ID {self.player_id}>'

# Add other models as needed 