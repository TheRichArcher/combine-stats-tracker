import React, { useState, useRef, useEffect } from 'react';
import './App.css'; // Basic styling

// Consistent with backend Enum
const DRILL_TYPES = {
  FORTY_M_DASH: "40m_dash",
  VERTICAL_JUMP: "vertical_jump",
  CATCHING: "catching",
  THROWING: "throwing",
  AGILITY: "agility",
};

// Add this line at the top, outside the App function
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  // --- Player Form State ---
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [age, setAge] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [playerMessage, setPlayerMessage] = useState('');
  const [isSubmittingPlayer, setIsSubmittingPlayer] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  // --- Drill Result Form State ---
  const [playerId, setPlayerId] = useState('');
  const [drillType, setDrillType] = useState(DRILL_TYPES.FORTY_M_DASH); // Default drill
  const [rawScore, setRawScore] = useState('');
  const [drillMessage, setDrillMessage] = useState('');
  const [isSubmittingDrill, setIsSubmittingDrill] = useState(false);

  // --- Player Results Viewer State ---
  const [allPlayers, setAllPlayers] = useState([]);
  const [selectedPlayerIdForView, setSelectedPlayerIdForView] = useState('');
  const [selectedPlayerResults, setSelectedPlayerResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState('');

  // --- Rankings State ---
  const [rankings, setRankings] = useState([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(''); // e.g., "6-8"
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState('');
  const AGE_GROUPS = ["", "6-8", "9-11", "12-14", "15-18"]; // Example age groups

  // --- Export State ---
  const [exportFormat, setExportFormat] = useState('csv'); // 'csv' or 'pdf'

  // --- Player Form Handlers ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      stopCameraStream(); // Stop camera if file is chosen
    }
  };

  const startCamera = async () => {
    setPlayerMessage(''); // Clear message for player form
    setPhoto(null); // Clear file input if camera starts
    setPhotoPreview(null);
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(cameraStream);
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      setPlayerMessage(`Error accessing camera: ${err.name}. Ensure permissions are granted.`);
    }
  };

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `capture-${timestamp}.png`;
            const capturedFile = new File([blob], fileName, { type: 'image/png' });
            setPhoto(capturedFile);
            setPhotoPreview(URL.createObjectURL(capturedFile));
            stopCameraStream(); // Stop stream after capture
        }
      }, 'image/png');
    }
  };

  const handlePlayerSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingPlayer(true);
    setPlayerMessage('');

    if (!name || !number || !age) {
        setPlayerMessage('Please fill in Name, Number, and Age.');
        setIsSubmittingPlayer(false);
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('number', parseInt(number, 10));
    formData.append('age', parseInt(age, 10));
    if (photo) {
      formData.append('photo', photo);
    }

    try {
      // Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/players/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setPlayerMessage(`Player ${result.name} (ID: ${result.id}) created successfully!`);
      setName('');
      setNumber('');
      setAge('');
      setPhoto(null);
      setPhotoPreview(null);
      stopCameraStream();
      // Refresh player list after successful creation
      fetchPlayers(); 

    } catch (error) {
      console.error('Error creating player:', error);
      setPlayerMessage(`Error creating player: ${error.message}`);
    } finally {
      setIsSubmittingPlayer(false);
    }
  };

  // --- Drill Result Form Handler ---
  const handleDrillSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingDrill(true);
    setDrillMessage('');

    if (!playerId || !drillType || rawScore === '') {
        setDrillMessage('Please fill in Player ID, Drill Type, and Raw Score.');
        setIsSubmittingDrill(false);
        return;
    }

    const drillData = {
        player_id: parseInt(playerId, 10),
        drill_type: drillType,
        raw_score: parseFloat(rawScore)
    };

    try {
        // Use API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/drill-results/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(drillData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setDrillMessage(`Drill result ID ${result.id} for Player ${result.player_id} (${result.drill_type}) recorded successfully!`);
        // If the submitted result is for the currently viewed player, refresh their results
        if (result.player_id === parseInt(selectedPlayerIdForView, 10)) {
            fetchPlayerResults(selectedPlayerIdForView);
        }
        // Refresh rankings if an age group is selected
        fetchRankings(selectedAgeGroup);

    } catch (error) {
        console.error('Error submitting drill result:', error);
        setDrillMessage(`Error submitting drill result: ${error.message}`);
    } finally {
        setIsSubmittingDrill(false);
    }
  };

  // --- Data Fetching Functions ---
  const fetchPlayers = async () => {
    setPlayersLoading(true);
    setPlayersError('');
    try {
      // Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/players/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAllPlayers(data);
    } catch (error) {
      console.error("Error fetching players:", error);
      setPlayersError(`Failed to load players: ${error.message}`);
    } finally {
      setPlayersLoading(false);
    }
  };

  const fetchPlayerResults = async (pId) => {
    if (!pId) return; // Don't fetch if no player is selected
    setResultsLoading(true);
    setResultsError('');
    setSelectedPlayerResults([]); // Clear previous results
    try {
      // Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/players/${pId}/results/`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSelectedPlayerResults(data);
    } catch (error) {
      console.error(`Error fetching results for player ${pId}:`, error);
      setResultsError(`Failed to load results: ${error.message}`);
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchRankings = async (ageGroup) => {
    if (!ageGroup) {
        setRankings([]); // Clear rankings if no group selected
        setRankingsError('');
        return;
    }
    setRankingsLoading(true);
    setRankingsError('');
    setRankings([]); // Clear previous rankings
    try {
        // Use API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/rankings/?age_group=${encodeURIComponent(ageGroup)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setRankings(data);
    } catch (error) {
        console.error(`Error fetching rankings for age group ${ageGroup}:`, error);
        setRankingsError(`Failed to load rankings: ${error.message}`);
    } finally {
        setRankingsLoading(false);
    }
  };

  // --- Export Handler ---
  const handleExport = () => {
    if (!selectedAgeGroup) {
        alert("Please select an age group to export.");
        return;
    }
    // Use API_BASE_URL
    const exportUrl = `${API_BASE_URL}/rankings/export?format=${exportFormat}&age_group=${encodeURIComponent(selectedAgeGroup)}`;
    
    // Trigger download by navigating to the URL
    window.location.href = exportUrl;
  };

  // --- Effects ---
  // Fetch players on initial mount
  useEffect(() => {
    fetchPlayers();
  }, []);

  // Fetch results when selected player changes
  useEffect(() => {
    fetchPlayerResults(selectedPlayerIdForView);
  }, [selectedPlayerIdForView]);

  // Fetch rankings when selected age group changes
  useEffect(() => {
      fetchRankings(selectedAgeGroup);
  }, [selectedAgeGroup]);

  // Clean up camera stream on component unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stream]);

  // --- Render --- 
  return (
    <div className="App">
      {/* Player Creation Form */}
      <div className="form-section">
        <h1>Create Player Profile</h1>
        <form onSubmit={handlePlayerSubmit}>
          <div>
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="number">Number:</label>
            <input
              type="number"
              id="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="age">Age:</label>
            <input
              type="number"
              id="age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Photo:</label>
            {!stream && (
              <>
                <button type="button" onClick={startCamera}>Start Camera</button>
                <span> or </span>
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </>
            )}
          </div>
          {stream && (
            <div className="camera-container">
              <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: '100%', height: 'auto' }}></video>
              <button type="button" onClick={capturePhoto}>Capture Photo</button>
              <button type="button" onClick={stopCameraStream}>Stop Camera</button>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          {photoPreview && (
            <div className="preview-container">
              <p>Photo Preview:</p>
              <img src={photoPreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px' }} />
            </div>
          )}

          <button type="submit" disabled={isSubmittingPlayer}>
            {isSubmittingPlayer ? 'Submitting...' : 'Create Player'}
          </button>
        </form>
        {playerMessage && <p className="message">{playerMessage}</p>}
      </div>

      <hr />

      {/* Drill Result Entry Form */}
      <div className="form-section">
        <h1>Enter Drill Result</h1>
        <form onSubmit={handleDrillSubmit}>
            <div>
                <label htmlFor="playerId">Player ID:</label>
                <input
                    type="number"
                    id="playerId"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="drillType">Drill Type:</label>
                <select
                    id="drillType"
                    value={drillType}
                    onChange={(e) => setDrillType(e.target.value)}
                    required
                >
                    {Object.entries(DRILL_TYPES).map(([key, value]) => (
                        <option key={key} value={value}>{value.replace(/_/g, ' ').toUpperCase()}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="rawScore">Raw Score:</label>
                <input
                    type="number"
                    id="rawScore"
                    value={rawScore}
                    onChange={(e) => setRawScore(e.target.value)}
                    step="any" // Allow decimals
                    required
                />
            </div>
            <button type="submit" disabled={isSubmittingDrill}>
                {isSubmittingDrill ? 'Submitting...' : 'Record Drill Result'}
            </button>
        </form>
        {drillMessage && <p className="message">{drillMessage}</p>}
      </div>

      <hr />

      {/* Player Drill Results Viewer */}
      <div className="results-section">
        <h1>View Player Drill Results</h1>
        <div>
          <label htmlFor="playerSelect">Select Player:</label>
          {playersLoading && <p>Loading players...</p>}
          {playersError && <p className="message error">{playersError}</p>}
          {!playersLoading && !playersError && (
            <select
              id="playerSelect"
              value={selectedPlayerIdForView}
              onChange={(e) => setSelectedPlayerIdForView(e.target.value)}
            >
              <option value="">-- Select a Player --</option>
              {allPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} (ID: {player.id}, Num: {player.number})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedPlayerIdForView && (
          <div>
            <h2>Results for Player ID: {selectedPlayerIdForView}</h2>
            {resultsLoading && <p>Loading results...</p>}
            {resultsError && <p className="message error">{resultsError}</p>}
            {!resultsLoading && !resultsError && selectedPlayerResults.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Drill Type</th>
                    <th>Raw Score</th>
                    <th>Normalized Score</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlayerResults.map((result) => (
                    <tr key={result.id}>
                      <td>{result.drill_type.replace(/_/g, ' ').toUpperCase()}</td>
                      <td>{result.raw_score}</td>
                      <td>{result.normalized_score !== null ? result.normalized_score.toFixed(2) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!resultsLoading && !resultsError && selectedPlayerResults.length === 0 && (
              <p>No drill results found for this player.</p>
            )}
          </div>
        )}
      </div>

      <hr />

      {/* Rankings Viewer */}
      <div className="rankings-section">
        <h1>Player Rankings</h1>
        <div>
            <label htmlFor="ageGroupSelect">Select Age Group:</label>
            <select
                id="ageGroupSelect"
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
            >
                {AGE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                        {group === "" ? "-- Select Age Group --" : group}
                    </option>
                ))}
            </select>
        </div>

        {selectedAgeGroup && (
            <div>
                <h2>Rankings for Age Group: {selectedAgeGroup}</h2>
                {rankingsLoading && <p>Loading rankings...</p>}
                {rankingsError && <p className="message error">{rankingsError}</p>}
                {!rankingsLoading && !rankingsError && rankings.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Name</th>
                                <th>Number</th>
                                <th>Age</th>
                                <th>Composite Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankings.map((player) => (
                                <tr key={player.id}>
                                    <td>{player.rank}</td>
                                    <td>{player.name}</td>
                                    <td>{player.number}</td>
                                    <td>{player.age}</td>
                                    <td>{player.composite_score.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!rankingsLoading && !rankingsError && rankings.length === 0 && (
                    <p>No players found or ranked in this age group.</p>
                )}
            </div>
        )}

        {/* Export Controls */} 
        {selectedAgeGroup && (
            <div className="export-controls" style={{ marginTop: '1em' }}>
                <label style={{ marginRight: '1em' }}>Export Format:</label>
                <label style={{ marginRight: '1em' }}>
                    <input 
                        type="radio" 
                        name="exportFormat" 
                        value="csv"
                        checked={exportFormat === 'csv'}
                        onChange={() => setExportFormat('csv')}
                    /> CSV
                </label>
                <label style={{ marginRight: '1em' }}>
                    <input 
                        type="radio" 
                        name="exportFormat" 
                        value="pdf"
                        checked={exportFormat === 'pdf'}
                        onChange={() => setExportFormat('pdf')}
                    /> PDF
                </label>
                <button onClick={handleExport}>Export Report</button>
            </div>
        )}
      </div>

    </div>
  );
}

export default App; 