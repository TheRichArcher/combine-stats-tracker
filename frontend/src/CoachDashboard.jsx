import React, { useState, useEffect, useMemo } from 'react';
import './App.css'; // Reuse existing styles if applicable

// Assuming API_BASE_URL is defined similarly or passed as prop/context
// Use environment variable or hardcode temporarily if needed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Consistent with backend Enum - important for keys
const DRILL_TYPES = {
  FORTY_M_DASH: "40m_dash",
  VERTICAL_JUMP: "vertical_jump",
  CATCHING: "catching",
  THROWING: "throwing",
  AGILITY: "agility",
};

// Backend Age Groups (update if backend changes)
const AGE_GROUPS = ["6U", "8U", "10U", "12U", "14U"];

// Default weights matching official backend logic
const OFFICIAL_DEFAULT_WEIGHTS = {
  [DRILL_TYPES.FORTY_M_DASH]: 30, // 30%
  [DRILL_TYPES.VERTICAL_JUMP]: 20, // 20%
  [DRILL_TYPES.AGILITY]: 20, // 20%
  [DRILL_TYPES.THROWING]: 15, // 15%
  [DRILL_TYPES.CATCHING]: 15, // 15%
};

function CoachDashboard() {
  const [players, setPlayers] = useState([]);
  const [drillResults, setDrillResults] = useState({}); // Store results keyed by player ID
  const [customWeights, setCustomWeights] = useState(OFFICIAL_DEFAULT_WEIGHTS); // Use official defaults
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('All'); // New state for age group filter

  // --- Data Fetching ---
  useEffect(() => {
    const fetchCoachData = async () => {
      setLoading(true);
      setError('');
      try {
        // 1. Fetch all players
        const playersResponse = await fetch(`${API_BASE_URL}/players/`);
        if (!playersResponse.ok) throw new Error(`HTTP error fetching players: ${playersResponse.status}`);
        const playersData = await playersResponse.json();
        setPlayers(playersData);

        // 2. Fetch drill results for each player
        const resultsPromises = playersData.map(player => 
          fetch(`${API_BASE_URL}/players/${player.id}/results/`)
            .then(res => res.ok ? res.json() : Promise.reject(`HTTP error fetching results for player ${player.id}: ${res.status}`))
            .catch(err => {
              console.error(err); // Log individual errors
              return []; // Return empty array on error for this player
            })
        );
        
        const resultsArrays = await Promise.all(resultsPromises);
        
        const resultsMap = {};
        playersData.forEach((player, index) => {
          resultsMap[player.id] = resultsArrays[index] || []; // Ensure an empty array if fetch failed
        });
        setDrillResults(resultsMap);

      } catch (err) { // Catch errors from fetching players or Promise.all issues
        console.error("Error fetching coach data:", err);
        setError(err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCoachData();
  }, []);

  // --- Custom Composite Score Calculation Logic (Frontend) ---
  const calculateCustomCompositeScore = (playerId) => {
    const playerResults = drillResults[playerId] || [];
    
    // Find best *normalized* score for each attempted drill type
    const bestNormalizedScores = {};
    playerResults.forEach(result => {
      if (result.normalized_score !== null) {
        const currentBest = bestNormalizedScores[result.drill_type] || -1; // Use -1 to handle 0 score
        if (result.normalized_score > currentBest) {
          bestNormalizedScores[result.drill_type] = result.normalized_score;
        }
      }
    });

    let totalScore = 0.0;
    let totalWeightApplied = 0.0;

    // Iterate through ALL possible drill types
    for (const drillTypeKey in DRILL_TYPES) {
      const drillType = DRILL_TYPES[drillTypeKey];
      const normScore = bestNormalizedScores[drillType] !== undefined ? bestNormalizedScores[drillType] : 0; // Default to 0 if drill wasn't attempted
      const weightPercentage = customWeights[drillType] || 0;
      const weight = weightPercentage / 100.0; // Convert percentage to decimal

      totalScore += normScore * weight;
      totalWeightApplied += weight;
    }

    if (totalWeightApplied === 0) return 0.0; // Avoid division by zero

    const customComposite = totalScore / totalWeightApplied;
    return Math.round(customComposite * 100) / 100; // Round to 2 decimal places
  };

  // --- Memoized Player Data with Custom Scores AND Filtering ---
  const filteredAndSortedPlayers = useMemo(() => {
    // 1. Filter by selected age group
    const filteredPlayers = players.filter(player => 
      selectedAgeGroup === 'All' || player.age_group === selectedAgeGroup
    );

    // 2. Calculate custom composite scores for filtered players
    const playersWithScores = filteredPlayers.map(player => ({
      ...player,
      customCompositeScore: calculateCustomCompositeScore(player.id)
      // TODO: Add official composite score if needed later
    }));
    
    // 3. Sort the scored players by custom score
    return playersWithScores.sort((a, b) => b.customCompositeScore - a.customCompositeScore); // Sort descending by custom score

  }, [players, drillResults, customWeights, selectedAgeGroup]); // Recalculate when data, weights, or filter changes

  // --- Event Handlers ---
  const handleWeightChange = (drillType, value) => {
    const newWeight = Math.max(0, Math.min(100, Number(value))); // Clamp between 0-100
    setCustomWeights(prevWeights => ({
      ...prevWeights,
      [drillType]: newWeight,
    }));
  };

  const resetWeights = () => {
    setCustomWeights(OFFICIAL_DEFAULT_WEIGHTS); // Reset to official defaults
  };

  // New handler for age group filter change
  const handleAgeGroupChange = (event) => {
    setSelectedAgeGroup(event.target.value);
  };

  // --- Render Logic ---
  if (loading) return <div>Loading Coach Dashboard...</div>;
  if (error) return <div className="message error">Error: {error}</div>;

  return (
    <div className="App container coach-dashboard"> {/* Add specific class */} 
      <h1>Coach's Dashboard</h1>
      <p style={{ fontStyle: 'italic', color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>
        <strong>Coach View Only:</strong> Adjusting weights here recalculates scores <strong>locally</strong> for your view. 
        It does <strong>not</strong> change official player results or rankings.
      </p>

      {/* Weight Adjustment Controls */}
      <div className="form-section weight-controls">
        <h2>Adjust Drill Weights (%)</h2>
        {Object.entries(DRILL_TYPES).map(([key, drillType]) => (
          <div key={drillType} className="weight-slider">
            <label htmlFor={`weight-${drillType}`}>{drillType.replace(/_/g, ' ').toUpperCase()}:</label>
            <input 
              type="range" 
              id={`weight-${drillType}`} 
              min="0" 
              max="100" 
              value={customWeights[drillType]}
              onChange={(e) => handleWeightChange(drillType, e.target.value)} 
              style={{ marginLeft: '10px', marginRight: '10px' }}
            />
            <input
              type="number"
              min="0"
              max="100"
              value={customWeights[drillType]}
              onChange={(e) => handleWeightChange(drillType, e.target.value)}
              style={{ width: '60px' }}
            />
            <span>%</span>
          </div>
        ))}
        <button onClick={resetWeights} style={{ marginTop: '15px' }}>Reset Weights</button>
      </div>

      <hr />

      {/* Player Table with Custom Scores */}
      <div className="results-section">
        <h2>Custom Player Rankings</h2>
        
        {/* Age Group Filter Dropdown */}
        <div className="filter-section" style={{ marginBottom: '15px' }}>
          <label htmlFor="ageGroupFilter" style={{ marginRight: '10px' }}>Filter by Age Group:</label>
          <select 
            id="ageGroupFilter" 
            value={selectedAgeGroup} 
            onChange={handleAgeGroupChange}
          >
            <option value="All">All</option>
            {AGE_GROUPS.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        {filteredAndSortedPlayers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Number</th>
                <th>Age Group</th>
                {/* Add official score header later if needed */}
                <th>Custom Composite Score</th>
                {/* Optionally add raw scores here if needed */}
              </tr>
            </thead>
            <tbody>
              {/* Use the filtered and sorted list */}
              {filteredAndSortedPlayers.map((player, index) => ( 
                <tr key={player.id}>
                  <td>{index + 1}</td> {/* Rank based on current filter/sort */} 
                  <td>{player.name}</td>
                  <td>{player.number || 'N/A'}</td>
                  <td>{player.age_group}</td>
                  {/* Add official score data cell later if needed */}
                  <td>{player.customCompositeScore.toFixed(2)}</td> 
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No players found{selectedAgeGroup !== 'All' ? ` for age group ${selectedAgeGroup}` : ''}.</p>
        )}
      </div>
    </div>
  );
}

export default CoachDashboard; 