import React, { useState, useEffect, useMemo } from 'react';
import { saveAs } from 'file-saver'; // Import file-saver
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { FaMedal, FaExclamationCircle } from 'react-icons/fa';
import PrimaryButton from './PrimaryButton';
import TextInput from './TextInput';

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

// --- NEW: Define Drill Categories (Locally for this component) ---
const DRILL_CATEGORIES = {
  'Speed': [DRILL_TYPES.FORTY_M_DASH],
  'Power': [DRILL_TYPES.VERTICAL_JUMP],
  'Skill': [DRILL_TYPES.CATCHING, DRILL_TYPES.THROWING, DRILL_TYPES.AGILITY]
};
// --- END NEW Drill Categories ---

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

function Spinner() {
  return <div className="spinner"><div></div><div></div><div></div></div>;
}

function CoachDashboard({ user }) {
  console.log("🟢 Authenticated User:", user);
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
        console.log("🟡 Fetched Players:", playersData);
        setPlayers(playersData);

        // 2. Fetch drill results for each player
        const resultsPromises = playersData.map(player => 
          fetch(`${API_BASE_URL}/players/${player.id}/results/`)
            .then(res => res.ok ? res.json() : Promise.reject(`HTTP error fetching results for player ${player.id}: ${res.status}`))
            .then(resultData => {
              console.log(`🔵 Drill Results for player ${player.id}:`, resultData);
              return resultData;
            })
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
      customCompositeScore: calculateCustomCompositeScore(player.id),
      officialCompositeScore: player.composite_score // Assume backend sends 'composite_score'
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

  // --- NEW: CSV Export Handler ---
  const handleExportCustomCsv = () => {
    if (!filteredAndSortedPlayers.length) {
      alert("No players to export in the current view.");
      return;
    }

    const headers = [
      "Rank",
      "Name",
      "Number",
      "Age Group",
      "Custom Composite Score",
      "Official Composite Score",
      ...Object.values(DRILL_TYPES).map(dt => `${dt.replace(/_/g, ' ').toUpperCase()} (Normalized Score)`) // Dynamic drill headers
    ];

    // Prepare data rows
    const rows = filteredAndSortedPlayers.map((player, index) => {
      const playerResults = drillResults[player.id] || [];
      const bestNormalizedScores = {};
      playerResults.forEach(result => {
        if (result.normalized_score !== null) {
          const currentBest = bestNormalizedScores[result.drill_type] || -1;
          if (result.normalized_score > currentBest) {
            bestNormalizedScores[result.drill_type] = result.normalized_score;
          }
        }
      });

      const rowData = [
        index + 1, // Rank
        player.name,
        player.number || 'N/A',
        player.age_group,
        player.customCompositeScore.toFixed(2),
        player.officialCompositeScore !== null && player.officialCompositeScore !== undefined 
          ? player.officialCompositeScore.toFixed(2) 
          : 'N/A',
        // Add normalized scores for each drill type
        ...Object.values(DRILL_TYPES).map(drillType => 
          bestNormalizedScores[drillType] !== undefined ? bestNormalizedScores[drillType].toFixed(0) : '0' // Use 0 if not attempted/scored
        )
      ];
      return rowData;
    });

    // Convert to CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")) // Handle potential commas/quotes in fields
    ].join("\n");

    // Create Blob and trigger download using file-saver
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `custom_rankings_${selectedAgeGroup}_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, filename);
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/login';
  };

  // --- Render Logic ---
  if (loading) return <Spinner />;
  if (error) return <div className="error-banner"><FaExclamationCircle className="error-icon" /> {error}</div>;

  return (
    <>
      <h1 style={{ fontWeight: 600, fontSize: '2rem', marginBottom: 8 }}>Coach's Dashboard</h1>
      <div className="dashboard-warning">
        <strong>Coach View Only:</strong> Adjusting weights here recalculates scores <strong>locally</strong> for your view. It <strong>does not</strong> change official player results or rankings.
      </div>
      {/* Weight Adjustment Controls */}
      <div className="form-section weight-controls" style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 600, color: '#0277bd', marginBottom: 12 }}>Adjust Drill Weights (%)</h2>
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
            />
            <input
              type="number"
              min="0"
              max="100"
              value={customWeights[drillType]}
              onChange={(e) => handleWeightChange(drillType, e.target.value)}
            />
            <span>%</span>
          </div>
        ))}
        <PrimaryButton type="button" onClick={resetWeights} className="secondary-action">Reset Weights</PrimaryButton>
      </div>
      <hr style={{ margin: '24px 0' }} />
      {/* Player Table with Custom Scores */}
      <div className="results-section">
        <h2 style={{ fontWeight: 600, color: '#0277bd', marginBottom: 12 }}>Custom Player Rankings</h2>
        {/* Age Group Filter Dropdown */}
        <div className="filter-section" style={{ marginBottom: '15px' }}>
          <label htmlFor="ageGroupFilter" style={{ marginRight: '10px' }}>Filter by Age Group:</label>
          <select 
            id="ageGroupFilter" 
            value={selectedAgeGroup} 
            onChange={handleAgeGroupChange}
            className="login-input"
            style={{ maxWidth: 180, display: 'inline-block' }}
          >
            <option value="All">All</option>
            {AGE_GROUPS.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
        {/* Export Button */}
        <div style={{ marginBottom: '15px' }}>
          <PrimaryButton 
            onClick={handleExportCustomCsv} 
            disabled={filteredAndSortedPlayers.length === 0}
            className="primary-action"
          >
            Download Custom Rankings (.CSV)
          </PrimaryButton>
        </div>
        {/* Rankings Table and Cards (existing code) */}
        {/* ... keep the rest of the rankings rendering as is, but ensure all buttons/inputs use PrimaryButton/TextInput ... */}
      </div>
    </>
  );
}

export default CoachDashboard; 