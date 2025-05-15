import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom'; // Import Link
import Select from 'react-select'; // <-- Import react-select
import './App.css'; // Basic styling
import AppLayout from './AppLayout';

// --- Define Custom Error Class ---
class HttpError extends Error {
  constructor(status, detail, message) {
    super(message || `HTTP error! status: ${status}`);
    this.status = status;
    this.detail = detail || "Unknown server error.";
    this.name = "HttpError";
  }
}

// Consistent with backend Enum
const DRILL_TYPES = {
  FORTY_M_DASH: "40m_dash",
  VERTICAL_JUMP: "vertical_jump",
  CATCHING: "catching",
  THROWING: "throwing",
  AGILITY: "agility",
};

// --- NEW: Define Drill Categories ---
const DRILL_CATEGORIES = {
  'Speed': ['40m_dash'],
  'Power': ['vertical_jump'],
  'Skill': ['catching', 'throwing', 'agility']
  // Add more drills to categories as needed
};

// Helper to get all drill keys from categories
const ALL_DRILL_KEYS = Object.values(DRILL_CATEGORIES).flat();

// Helper function to get category name from drill key
const getCategoryForDrill = (drillKey) => {
  for (const category in DRILL_CATEGORIES) {
    if (DRILL_CATEGORIES[category].includes(drillKey)) {
      return category;
    }
  }
  return 'Other'; // Fallback category
};
// --- END NEW Drill Categories ---

// Add this line at the top, outside the App function
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  // --- Player Form State ---
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [playerMessage, setPlayerMessage] = useState('');
  const [isSubmittingPlayer, setIsSubmittingPlayer] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [generatedPlayerNumber, setGeneratedPlayerNumber] = useState(null); // State for the generated number

  // --- CSV Upload State ---
  const [csvFile, setCsvFile] = useState(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isCsvSectionVisible, setIsCsvSectionVisible] = useState(false); // State for visibility

  // --- Drill Result Form State ---
  const [playerId, setPlayerId] = useState('');
  const [drillType, setDrillType] = useState(DRILL_TYPES.FORTY_M_DASH); // Default drill
  const [rawScore, setRawScore] = useState('');
  const [drillMessage, setDrillMessage] = useState('');
  const [isSubmittingDrill, setIsSubmittingDrill] = useState(false);
  const [matchedPlayer, setMatchedPlayer] = useState(null); // <-- Add this line

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
  const AGE_GROUPS = ["", "6U", "8U", "10U", "12U", "14U"]; // Example age groups

  // --- NEW: State for Rankings Table Column Visibility ---
  // Initialize state based on ALL_DRILL_KEYS, default to true
  const [visibleDrillColumns, setVisibleDrillColumns] = useState(
    ALL_DRILL_KEYS.reduce((acc, key) => {
      acc[key] = true; // Default all drills to visible
      return acc;
    }, {})
  );
  // --- END NEW Column Visibility State ---

  // --- Export State ---
  const [exportFormat, setExportFormat] = useState('csv'); // 'csv' or 'pdf'

  // --- NEW: Reset Players State ---
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // --- NEW: Admin Section Visibility State ---
  const [isAdminSectionVisible, setIsAdminSectionVisible] = useState(false);
  // --- NEW: Reset Tool Visibility State (within Admin section) ---
  const [showResetTool, setShowResetTool] = useState(false);

  // --- >>> NEW: State for inline editing drill results <<< ---
  const [editingResultId, setEditingResultId] = useState(null); // ID of the result being edited
  const [editingRawScore, setEditingRawScore] = useState(''); // Temp value during edit
  const [editError, setEditError] = useState(''); // Error specific to the edit operation
  // --- <<< END NEW EDITING STATE >>> ---

  // --- >>> NEW: State for transferring player age group <<< ---
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [playerToTransfer, setPlayerToTransfer] = useState(null); // Store the full player object
  const [selectedNewAgeGroup, setSelectedNewAgeGroup] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  // --- <<< END NEW TRANSFER STATE >>> ---

  // State for Admin Password Protection
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false); // Track if admin section is unlocked
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false); // Show/hide password input
  const [adminPasswordInput, setAdminPasswordInput] = useState(''); // Current password input value
  const [adminPasswordError, setAdminPasswordError] = useState(''); // Error message for incorrect password

  // --- Effects for Auto-clearing CSV Messages ---
  useEffect(() => {
    let summaryTimer;
    if (uploadSummary) {
      summaryTimer = setTimeout(() => {
        setUploadSummary(null); // Clear summary after 5 seconds
      }, 5000); 
    }
    // Cleanup function to clear the timeout if summary changes or component unmounts
    return () => clearTimeout(summaryTimer);
  }, [uploadSummary]); // Re-run effect only when uploadSummary changes

  useEffect(() => {
    let errorTimer;
    if (uploadError) {
      errorTimer = setTimeout(() => {
        setUploadError(''); // Clear error after 5 seconds
      }, 5000); 
    }
    // Cleanup function to clear the timeout if error changes or component unmounts
    return () => clearTimeout(errorTimer);
  }, [uploadError]); // Re-run effect only when uploadError changes

  // --- NEW: Reset Players Handlers ---
  const openResetModal = () => {
    setResetConfirmationText(''); // Clear any previous input
    setResetError(''); // Clear any previous error
    setIsResetModalOpen(true);
  };

  const closeResetModal = () => {
    setIsResetModalOpen(false);
    setResetConfirmationText('');
    setResetError('');
  };

  const handleResetConfirm = async () => {
    if (resetConfirmationText !== 'REMOVE') {
      setResetError('Please type REMOVE exactly to confirm.');
      return;
    }

    setIsResetting(true);
    setResetError('');

    try {
      // TODO: Add authentication headers if/when implemented
      // const headers = { 'Authorization': `Bearer ${your_jwt_token}` };
      const response = await fetch(`${API_BASE_URL}/admin/reset`, {
        method: 'DELETE',
        // headers: headers, // Add headers here when auth is ready
      });

      const result = await response.json(); // Attempt to parse JSON even on error

      if (!response.ok) {
        // Use HttpError or a similar pattern if available, otherwise throw standard Error
        throw new Error(result.detail || `HTTP error! status: ${response.status}`);
      }

      alert('✅ All players and drill results have been successfully deleted.'); // Simple feedback
      closeResetModal();
      fetchPlayers(); // Refresh the player list

    } catch (error) {
      console.error('Error resetting players:', error);
      // Display error within the modal for context
      setResetError(`Reset failed: ${error.message}`);
      // alert(`❌ Error resetting players: ${error.message}`); // Alternative: Use alert
    } finally {
      setIsResetting(false);
    }
  };
  // --- End NEW Reset Handlers ---

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
    setGeneratedPlayerNumber(null); // Clear previous generated number

    // Validate name and ageGroup
    if (!name || !ageGroup) {
        setPlayerMessage('Please fill in Name and select an Age Group.');
        setIsSubmittingPlayer(false);
        setGeneratedPlayerNumber(null); // Clear number on error too
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('age_group', ageGroup); // Send age_group instead of age
    // Do not send number - it will be generated by the backend
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
      // Update state with the generated number and set a simpler success message
      setGeneratedPlayerNumber(result.number);
      setPlayerMessage(`Player ${result.name} created successfully!`);
      setName('');
      setAgeGroup(''); // Reset age group dropdown
      setPhoto(null);
      setPhotoPreview(null);
      stopCameraStream();
      // Refresh player list after successful creation
      fetchPlayers(); 

    } catch (error) {
      console.error('Error creating player:', error);
      setPlayerMessage(`Error creating player: ${error.message}`);
      setGeneratedPlayerNumber(null); // Clear number on error too
    } finally {
      setIsSubmittingPlayer(false);
    }
  };

  // --- CSV Upload Handler ---
  const handleCsvFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setUploadError(''); // Clear previous error on new file selection
      setUploadSummary(null); // Clear previous summary
    } else {
      setCsvFile(null);
      setUploadError('Please select a valid .csv file.');
      setUploadSummary(null);
    }
  };

  const handleCsvUpload = async (event) => {
    event.preventDefault();
    if (!csvFile) {
      setUploadError('Please select a CSV file to upload.');
      return;
    }

    setIsUploadingCsv(true);
    // Clear previous results immediately upon starting new upload
    setUploadError(''); 
    setUploadSummary(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const response = await fetch(`${API_BASE_URL}/players/upload_csv`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json(); // Try to parse JSON regardless of status

      if (!response.ok) {
        throw new HttpError(response.status, result.detail || 'Failed to upload CSV.');
      }

      setUploadSummary(result); // Store the summary from backend
      setCsvFile(null); // Clear file input after successful upload
      // Optionally reset the file input visually if needed
      // document.getElementById('csvFileInput').value = null;
      fetchPlayers(); // Refresh the player list

    } catch (error) {
      console.error('Error uploading CSV:', error);
      if (error instanceof HttpError) {
          setUploadError(`Error: ${error.detail} (Status: ${error.status})`);
      } else {
          setUploadError(`Error uploading CSV: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // --- Drill Result Form Handler ---
  const handleDrillSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingDrill(true);
    setDrillMessage('');

    if (!playerId || !drillType || rawScore === '') {
        setDrillMessage('Please fill in Player Number, Drill Type, and Raw Score.');
        setIsSubmittingDrill(false);
        return;
    }

    // --- >>> Find the player by number to get their ID <<< ---
    const playerNumberToFind = parseInt(playerId, 10);
    const targetPlayer = allPlayers.find(p => p.number === playerNumberToFind);

    if (!targetPlayer) {
      setDrillMessage(`Error: Player with number ${playerNumberToFind} not found.`);
      setIsSubmittingDrill(false);
      return;
    }
    // --- <<< END Player Lookup >>> ---

    // --- >>> Construct payload with player_number <<< ---
    const drillData = {
        player_number: parseInt(playerId, 10), // Changed from player_id
        drill_type: drillType,
        raw_score: rawScore // Send rawScore directly as a string
    };
    // --- <<< END Payload Construction >>> ---

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
            let errorDetail = `HTTP error! status: ${response.status}`;
            try {
                // Try to get detail from backend JSON response
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (jsonError) {
                // Ignore if response body isn't valid JSON, use status code message
            }
            throw new HttpError(response.status, errorDetail); // Throw custom error
        }

        const result = await response.json();
        setDrillMessage(`Drill result ID ${result.id} for Player ${result.player_id} (${result.drill_type}) recorded successfully!`);
        setRawScore(''); // Clear raw score input on success
        // If the submitted result is for the currently viewed player, refresh their results
        if (result.player_id === parseInt(selectedPlayerIdForView, 10)) {
            fetchPlayerResults(selectedPlayerIdForView);
        }
        // Refresh rankings if an age group is selected
        fetchRankings(selectedAgeGroup);

    } catch (error) {
        console.error('Error submitting drill result:', error);
        // Check if it's our custom HttpError, otherwise use default message
        if (error instanceof HttpError) {
            setDrillMessage(`Error: ${error.detail}`);
        } else {
            setDrillMessage(`Error: ${error.message || error.toString()}`);
        }
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
      const response = await fetch(`${API_BASE_URL}/players/`, {
      });
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
      const response = await fetch(`${API_BASE_URL}/players/${pId}/results/`, {
      });
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

  const fetchRankings = async (ageGroupDisplay) => {
    if (!ageGroupDisplay) {
        setRankings([]);
        setRankingsError('');
        return;
    }
    setRankingsLoading(true);
    setRankingsError('');
    setRankings([]);
    try {
        const response = await fetch(`${API_BASE_URL}/rankings/?age_group=${encodeURIComponent(ageGroupDisplay)}`, {
        });
        if (!response.ok) {
            let errorDetail = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (jsonError) {}
            throw new HttpError(response.status, errorDetail);
        }
        const data = await response.json();
        setRankings(data);
    } catch (error) {
        console.error(`Error fetching rankings for age group ${ageGroupDisplay}:`, error);
        if (error instanceof HttpError) {
            setRankingsError(`Failed to load rankings: ${error.detail}`);
        } else {
            setRankingsError(`Failed to load rankings: ${error.message || error.toString()}`);
        }
    } finally {
        setRankingsLoading(false);
    }
  };

  // --- Export Handler ---
  const handleExport = () => {
    if (!selectedAgeGroup) {
        alert("Please select a valid age group to export.");
        return;
    }
    const exportUrl = `${API_BASE_URL}/rankings/export?format=${exportFormat}&age_group=${encodeURIComponent(selectedAgeGroup)}`;
    
    window.location.href = exportUrl;
  };

  // --- Effects ---
  // Effect to handle setting video source object when stream is ready
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    // Optional: Cleanup srcObject if stream goes away, though stopCameraStream handles tracks
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]); // Rerun when the stream changes

  // Fetch players on initial mount
  useEffect(() => {
    fetchPlayers();
  }, []);

  // Fetch results when selected player changes
  useEffect(() => {
    if (selectedPlayerIdForView) {
      fetchPlayerResults(selectedPlayerIdForView);
    } else {
      setSelectedPlayerResults([]); // Clear results if no player is selected
    }
  }, [selectedPlayerIdForView]);

  // Fetch rankings when selected age group changes
  useEffect(() => {
      fetchRankings(selectedAgeGroup);
  }, [selectedAgeGroup]);

  // Match player number input in drill form
  useEffect(() => {
    if (playerId && allPlayers.length > 0) {
      const match = allPlayers.find(p => p.number.toString() === playerId);
      setMatchedPlayer(match || null);
    } else {
      setMatchedPlayer(null); // Clear if input is empty or players aren't loaded
    }
  }, [playerId, allPlayers]); // <-- Add this useEffect

  // Clean up camera stream on component unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stream]);

  // --- Helper Function to Format Player Options for react-select ---
  const formatPlayerOptions = (players) => {
    const groupedOptions = {};

    // Sort players alphabetically first
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(player => {
      const label = `${player.name} (ID: ${player.id}, Num: ${player.number})`;
      const option = { value: player.id, label: label };
      const groupLabel = player.age_group || 'Unknown Age Group'; // Group by age_group

      if (!groupedOptions[groupLabel]) {
        groupedOptions[groupLabel] = {
          label: groupLabel,
          options: [],
        };
      }
      groupedOptions[groupLabel].options.push(option);
    });

    // Sort group labels if necessary (e.g., U10 before U12)
    // This basic sort works for "U<number>" format. Adjust if needed.
    const sortedGroupLabels = Object.keys(groupedOptions).sort((a, b) => {
        const numA = parseInt(a.replace('U', ''), 10);
        const numB = parseInt(b.replace('U', ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        // Handle non-numeric or 'Unknown' groups
        if (a === 'Unknown Age Group') return 1;
        if (b === 'Unknown Age Group') return -1;
        return a.localeCompare(b);
    });


    return sortedGroupLabels.map(label => groupedOptions[label]);
  };

  // --- >>> NEW: Handler for updating a drill result <<< ---
  const handleUpdateDrillResult = async (resultId) => {
    if (!editingRawScore.trim()) {
      setEditError('Score cannot be empty.');
      return;
    }
    setEditError(''); // Clear previous error

    // Optional confirmation
    if (!window.confirm(`Are you sure you want to update the score to "${editingRawScore}"?`)) {
      return;
    }

    // TODO: Add Auth Headers if needed
    const headers = { 'Content-Type': 'application/json' };

    try {
      const response = await fetch(`${API_BASE_URL}/drill-results/${resultId}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ raw_score: editingRawScore }),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) { /* Ignore JSON parsing error */ }
        throw new HttpError(response.status, errorDetail);
      }

      const updatedResult = await response.json();

      // Update the state locally
      setSelectedPlayerResults(prevResults =>
        prevResults.map(res => 
          res.id === resultId ? updatedResult : res
        )
      );

      // Clear editing state
      setEditingResultId(null);
      setEditingRawScore('');
      alert('Drill result updated successfully!'); // Simple success feedback

      // Refresh rankings as the update might affect composite scores
      fetchRankings(selectedAgeGroup); 

    } catch (error) {
      console.error('Error updating drill result:', error);
      const errorMsg = (error instanceof HttpError) ? error.detail : (error.message || 'Unknown error');
      setEditError(`Update failed: ${errorMsg}`); // Show error near the edit controls
      // alert(`Update failed: ${errorMsg}`); // Alternative: use alert
    }
  };
  // --- <<< END NEW UPDATE HANDLER >>> ---

  // --- >>> NEW: Handler for deleting a drill result <<< ---
  const handleDeleteDrillResult = async (resultId) => {
    if (!window.confirm("Are you sure you want to permanently delete this drill result? This action cannot be undone.")) {
      return;
    }

    // TODO: Add Auth Headers if needed
    const headers = {}; 

    try {
      const response = await fetch(`${API_BASE_URL}/drill-results/${resultId}`, {
        method: 'DELETE',
        headers: headers,
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) { /* Ignore JSON parsing error */ }
        throw new HttpError(response.status, errorDetail);
      }

      // Update the state locally by filtering out the deleted result
      setSelectedPlayerResults(prevResults =>
        prevResults.filter(res => res.id !== resultId)
      );

      alert('✅ Drill result deleted successfully!'); // Simple success feedback

      // Refresh rankings as the deletion might affect composite scores
      fetchRankings(selectedAgeGroup);

    } catch (error) {
      console.error('Error deleting drill result:', error);
      const errorMsg = (error instanceof HttpError) ? error.detail : (error.message || 'Unknown error');
      alert(`❌ Deletion failed: ${errorMsg}`); // Use alert for delete errors
    }
  };
  // --- <<< END NEW DELETE HANDLER >>> ---

  // --- >>> NEW: Handlers for transferring player age group <<< ---
  const openTransferModal = (playerId) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (player) {
      setPlayerToTransfer(player);
      setSelectedNewAgeGroup(''); // Reset selection
      setTransferError(''); // Clear previous errors
      setIsTransferModalOpen(true);
    } else {
      alert("Could not find player details."); // Should ideally not happen
    }
  };

  const handleTransferConfirm = async () => {
    if (!playerToTransfer || !selectedNewAgeGroup) {
      setTransferError("Please select a new age group.");
      return;
    }

    if (selectedNewAgeGroup === playerToTransfer.age_group) {
      setTransferError("New age group must be different from the current one.");
      return;
    }

    if (!window.confirm(`Are you sure you want to transfer ${playerToTransfer.name} (${playerToTransfer.number}) from ${playerToTransfer.age_group} to ${selectedNewAgeGroup}?`)) {
      return;
    }

    setIsTransferring(true);
    setTransferError('');

    try {
      const response = await fetch(`${API_BASE_URL}/players/${playerToTransfer.id}/transfer-age-group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_age_group: selectedNewAgeGroup }),
      });

      const result = await response.json(); // Attempt to parse JSON even on error

      if (!response.ok) {
        throw new HttpError(response.status, result.detail || `HTTP error ${response.status}`);
      }

      alert(`✅ Player ${result.name} successfully transferred to ${result.age_group}.`);
      setIsTransferModalOpen(false);
      setPlayerToTransfer(null);
      setSelectedNewAgeGroup('');

      // Refresh data
      fetchPlayers(); // Refresh the main player list
      if (selectedAgeGroup) {
        fetchRankings(selectedAgeGroup); // Refresh rankings if an age group is being viewed
      }
      // If the transferred player was being viewed, refresh their results too (age group might change display filters in future)
      if(selectedPlayerIdForView === result.id) {
        fetchPlayerResults(result.id);
      }

    } catch (error) {
      console.error('Error transferring player:', error);
      const errorMsg = (error instanceof HttpError) ? error.detail : (error.message || 'Unknown error');
      setTransferError(`Transfer failed: ${errorMsg}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransfer = () => {
    setIsTransferModalOpen(false);
    setPlayerToTransfer(null);
    setSelectedNewAgeGroup('');
    setTransferError('');
  };
  // --- <<< END NEW TRANSFER HANDLERS >>> ---

  // --- >>> NEW: Handler for deleting a player <<< ---
  const handleDeletePlayer = async (playerIdToDelete) => {
    const player = allPlayers.find(p => p.id === playerIdToDelete);
    if (!player) {
      alert("Error: Could not find player details to delete.");
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete ${player.name} (${player.number}) and all their drill results? This action cannot be undone.`)) {
      return;
    }

    // Optional: Add a loading state if deletion takes time
    // setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/players/${playerIdToDelete}`, {
        method: 'DELETE',
        // Add Auth headers if needed
      });

      const result = await response.json(); // Try parsing JSON even on error

      if (!response.ok) {
        throw new HttpError(response.status, result.detail || `HTTP error ${response.status}`);
      }

      alert('✅ Player deleted successfully!');
      
      // Clear the selection if the deleted player was being viewed
      if (selectedPlayerIdForView === playerIdToDelete) {
        setSelectedPlayerIdForView('');
        setSelectedPlayerResults([]);
      }

      // Refresh data
      fetchPlayers(); // Refresh player list
      fetchRankings(selectedAgeGroup); // Refresh rankings (pass current selection)

    } catch (error) {
      console.error('Error deleting player:', error);
      const errorMsg = (error instanceof HttpError) ? error.detail : (error.message || 'Unknown error');
      alert(`❌ Deletion failed: ${errorMsg}`);
    } finally {
      // setIsDeleting(false);
    }
  };
  // --- <<< END NEW DELETE HANDLER >>> ---

  const handleAdminPasswordSubmit = (e) => {
    e.preventDefault();
    // TODO: Move password to env variable or config later
    if (adminPasswordInput === 'combine!') {
        setIsAdminUnlocked(true);
        setShowAdminPasswordPrompt(false);
        setAdminPasswordError('');
        setAdminPasswordInput(''); // Clear input on success
    } else {
        setAdminPasswordError('Incorrect password.');
    }
  };

  // --- NEW: Handler for Toggling Drill Column Visibility ---
  const toggleDrillColumn = (drillKey) => {
    setVisibleDrillColumns(prevState => ({
      ...prevState,
      [drillKey]: !prevState[drillKey],
    }));
  };
  // --- END NEW Handler ---

  // --- Render --- 
  return (
    <AppLayout>
      <div>
        <Link to="/coaches" className="button" style={{ display: 'block', margin: '10px auto', textDecoration: 'none', textAlign: 'center' }}>
          Coaches View
        </Link>

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
                list="player-names-list"
                required
              />
              <datalist id="player-names-list">
                {allPlayers && allPlayers.map((player) => (
                  <option key={player.id} value={player.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="ageGroup">Age Group:</label>
              <select
                id="ageGroup"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                required
              >
                {AGE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group === "" ? "-- Select Age Group --" : group}
                  </option>
                ))}
              </select>
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
          {playerMessage && playerMessage.includes('successfully!') && (
            <div style={{ marginTop: '10px' }}>
              <label htmlFor="generatedNumber">Number:</label>
              <input
                type="text"
                id="generatedNumber"
                readOnly
                value={generatedPlayerNumber || ''}
                placeholder="(Generating...)"
                style={{ fontStyle: 'italic', backgroundColor: '#f0f0f0' }}
              />
              <em style={{ fontSize: '0.9em', color: '#666', marginLeft: '5px' }}>
                 Generated After Creation
              </em>
              <p className="message" style={{ marginTop: '5px' }}>{playerMessage}</p>
            </div>
          )}
          {playerMessage && !playerMessage.includes('successfully!') && (
             <p className="message error">{playerMessage}</p>
          )}
        </div>

        {/* Drill Result Entry Form - Only show if admin is unlocked */}
        {isAdminUnlocked && (
          <div className="form-section">
            <h1>Enter Drill Result</h1>
            <form onSubmit={handleDrillSubmit}>
                <div>
                    <label htmlFor="playerId">Player Number:</label>
                    <input
                        type="number"
                        id="playerId"
                        value={playerId}
                        onChange={(e) => setPlayerId(e.target.value)}
                        required
                    />
                    {/* Add matched player display below input */}
                    {playerId && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#555' }}>
                        {matchedPlayer
                          ? <span style={{ fontWeight: 'bold', color: 'green' }}>✅ Matched: {matchedPlayer.name}</span>
                          : <span style={{ fontWeight: 'bold', color: 'red' }}>❌ No player found with this number</span>}
                      </div>
                    )}
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
        )}

        <hr />

        {/* Player Drill Results Viewer */}
        <div className="results-section">
          <h1>View Player Drill Results</h1>
          <div>
            <label htmlFor="playerSelect">Select Player:</label>
            {playersLoading && <p>Loading players...</p>}
            {playersError && <p className="message error">{playersError}</p>}
            {!playersLoading && !playersError && (
              <Select // <-- Use react-select component
                id="playerSelect"
                options={formatPlayerOptions(allPlayers)} // <-- Pass formatted & grouped options
                value={formatPlayerOptions(allPlayers) // Find the selected option object to control the component
                  .flatMap(group => group.options) // Flatten groups to search all options
                  .find(option => option.value === selectedPlayerIdForView) || null}
                onChange={(selectedOption) => {
                  setSelectedPlayerIdForView(selectedOption ? selectedOption.value : ''); // Update state with selected player ID
                }}
                isClearable // Allow clearing the selection
                placeholder="-- Type to search or select a Player --"
                styles={{ // Optional: basic styling adjustments
                    container: (provided) => ({ ...provided, marginTop: '5px', marginBottom: '15px' }),
                    menu: (provided) => ({ ...provided, zIndex: 9999 }) // Ensure dropdown appears above other elements
                }}
              />
            )}
          </div>

          {selectedPlayerIdForView && (
            <div>
              <h2>Results for Player ID: {selectedPlayerIdForView}</h2>
              {/* --- Player Action Buttons Container - Only show if admin unlocked --- */}
              {isAdminUnlocked && (
                <div style={{ marginBottom: '15px' }}> 
                  {/* Transfer Button */}
                  <button 
                    onClick={() => openTransferModal(selectedPlayerIdForView)}
                    className="button button-secondary button-small"
                  >
                    Transfer Age Group...
                  </button>
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeletePlayer(selectedPlayerIdForView)}
                    className="button button-danger button-small"
                    style={{ marginLeft: '10px' }} // Add space between buttons
                  >
                    🗑️ Delete Player
                  </button>
                </div>
              )}
              {/* --- End Player Action Buttons Container --- */}

              {resultsLoading && <p>Loading results...</p>}
              {resultsError && <p className="message error">{resultsError}</p>}
              {!resultsLoading && !resultsError && selectedPlayerResults.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Drill Type</th>
                      <th>Raw Score</th>
                      <th>Normalized Score</th>
                      <th>Actions</th>{/* <-- ADDED Actions Header */} 
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlayerResults.map((result) => (
                      <tr key={result.id}>
                        <td>{result.drill_type.replace(/_/g, ' ').toUpperCase()}</td>
                        {/* Conditional rendering for Raw Score cell */} 
                        <td>
                          {editingResultId === result.id ? (
                            <input 
                              type="text" // Use text to allow various formats like "7/10"
                              value={editingRawScore}
                              onChange={(e) => setEditingRawScore(e.target.value)}
                              // Basic styling example
                              style={{ width: '80px', padding: '2px' }} 
                            />
                          ) : (
                            result.raw_score
                          )}
                        </td>
                        <td>{result.normalized_score !== null ? result.normalized_score.toFixed(0) : 'N/A'}</td>{/* Keep normalized score read-only */}
                        {/* Actions Cell - Only show if admin unlocked */} 
                        <td>
                          {isAdminUnlocked && (
                            <>
                              <button 
                                onClick={() => { 
                                  setEditingResultId(result.id); 
                                  setEditingRawScore(result.raw_score); 
                                  setEditError(''); // Clear error when starting edit
                                }}
                                className="button button-small button-link-style" // Example styling
                              >
                                ✏️ Edit
                              </button>
                              {/* Add Delete Button - Show only when NOT editing */}
                              <button 
                                onClick={() => handleDeleteDrillResult(result.id)}
                                className="button button-small button-danger button-link-style" // Example styling
                                style={{ marginLeft: '10px' }} // Add some space
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </td>
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
                      <div className="rankings-table-container"> {/* NEW: Wrapper div */}
                          {/* --- Desktop: Column Toggles (Grouped by Category) --- */}
                          <div className="desktop-column-toggles">
                              <span>Show/Hide Drills:</span>
                              {Object.entries(DRILL_CATEGORIES).map(([category, drills]) => (
                                  <div key={category} className="toggle-category-group">
                                      <strong>{category}:</strong>
                                      {drills.map(key => (
                                          <label key={key} className={`toggle-label ${visibleDrillColumns[key] ? 'visible' : ''}`} title={`Toggle ${key.replace(/_/g, ' ').toUpperCase()}`}>
                                              <input
                                                  type="checkbox"
                                                  checked={visibleDrillColumns[key] ?? false} // Handle potential undefined keys gracefully
                                                  onChange={() => toggleDrillColumn(key)}
                                              />
                                              {key.replace(/_/g, ' ').toUpperCase()}
                                          </label>
                                      ))}
                                  </div>
                              ))}
                          </div>

                          {/* --- Desktop: Wide Table --- */}
                          <table className="rankings-table desktop-view">
                              <thead>
                                  {/* Row 1: Base Headers + Category Headers */}
                                  <tr>
                                      <th rowSpan="2" className="sticky-col rank-col">Rank</th>
                                      <th rowSpan="2" className="sticky-col name-col">Name</th>
                                      <th rowSpan="2">Number</th>
                                      <th rowSpan="2">Age</th>
                                      <th rowSpan="2" title="Score calculated using default weightings across all recorded drills.">Composite Score</th>
                                      {/* Category Headers */}
                                      {Object.entries(DRILL_CATEGORIES).map(([category, drills]) => {
                                          const visibleDrillsInCategory = drills.filter(key => visibleDrillColumns[key]);
                                          if (visibleDrillsInCategory.length === 0) return null; // Don't render category header if no drills are visible
                                          return (
                                              <th key={category} colSpan={visibleDrillsInCategory.length} className="category-header">
                                                  {category}
                                              </th>
                                          );
                                      })}
                                  </tr>
                                  {/* Row 2: Individual Drill Headers */}
                                  <tr>
                                      {ALL_DRILL_KEYS.map(key => (
                                          visibleDrillColumns[key] && (
                                              <th key={key} title={key.replace(/_/g, ' ').toUpperCase()} className="drill-header">
                                                  {/* Use abbreviation or shorter name if needed */}
                                                  {key.replace(/_/g, ' ').toUpperCase()}
                                              </th>
                                          )
                                      ))}
                                  </tr>
                              </thead>
                              <tbody>
                                  {rankings.map((player) => (
                                      <tr key={player.id}>
                                          <td className="sticky-col rank-col">{player.rank}</td>
                                          <td className="sticky-col name-col">{player.name}</td>
                                          <td>{player.number}</td>
                                          <td>{player.age}</td>
                                          <td>{player.composite_score.toFixed(2)}</td>
                                          {/* Drill Data Cells */}
                                          {ALL_DRILL_KEYS.map(key => (
                                              visibleDrillColumns[key] && (
                                                  <td key={key}>
                                                      {/* Access drill data - adjust path if needed based on backend response */}
                                                      {player.drills?.[key] !== undefined ? player.drills[key] : 'N/A'}
                                                  </td>
                                              )
                                          ))}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>

                          {/* --- Mobile: Card View --- */}
                          <div className="rankings-cards mobile-view">
                              {rankings.map((player) => (
                                  <div key={player.id} className="player-card">
                                      <div className="player-card-header">
                                          <span className="rank">{player.rank}.</span>
                                          <span className="name">{player.name}</span>
                                          <span className="score">Score: {player.composite_score.toFixed(2)}</span>
                                      </div>
                                      <details className="player-card-details">
                                          <summary>View Details</summary>
                                          {/* Basic Info */}
                                          <div className="card-section">
                                              <p><strong>Number:</strong> {player.number}</p>
                                              <p><strong>Age:</strong> {player.age}</p>
                                          </div>
                                          {/* Drills Grouped by Category */}
                                          {Object.entries(DRILL_CATEGORIES).map(([category, drills]) => {
                                              // Filter drills for this category that exist in the player data
                                              const relevantDrills = drills.filter(key => player.drills?.[key] !== undefined);
                                              if (relevantDrills.length === 0) return null; // Don't show empty categories

                                              return (
                                                  <div key={category} className="card-section">
                                                      <h4 className="card-category-header">{category}</h4>
                                                      {relevantDrills.map(key => (
                                                          <p key={key}>
                                                              <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong>
                                                              {player.drills[key]} 
                                                          </p>
                                                      ))}
                                                  </div>
                                              );
                                          })}
                                          {/* --- NEW: Section for Other/Uncategorized Drills --- */}
                                          {(() => {
                                              const categorizedKeys = new Set(ALL_DRILL_KEYS);
                                              const otherDrills = Object.keys(player.drills || {}).filter(key => !categorizedKeys.has(key));
                                              
                                              if (otherDrills.length > 0) {
                                                  return (
                                                      <div key="other-drills" className="card-section">
                                                          <h4 className="card-category-header">Other Drills</h4>
                                                          {otherDrills.map(key => (
                                                              <p key={key}>
                                                                  <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong>
                                                                  {player.drills[key]} 
                                                              </p>
                                                          ))}
                                                      </div>
                                                  );
                                              }
                                              return null;
                                          })()}
                                          {/* --- END Other Drills Section --- */}
                                      </details>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                  {!rankingsLoading && !rankingsError && rankings.length === 0 && (
                      <p>No players found or ranked in this age group.</p>
                  )}
              </div>
          )}

          {/* Export Controls */} 
          {selectedAgeGroup && (
              <div className="export-controls" style={{ marginTop: '1em' }}>
                  <div className="radio-group">
                    <label>
                        <input 
                            type="radio" 
                            name="exportFormat" 
                            value="csv"
                            checked={exportFormat === 'csv'}
                            onChange={() => setExportFormat('csv')}
                        /> CSV
                    </label>
                    <label>
                        <input 
                            type="radio" 
                            name="exportFormat" 
                            value="pdf"
                            checked={exportFormat === 'pdf'}
                            onChange={() => setExportFormat('pdf')}
                        /> PDF
                    </label>
                  </div>
                  <button onClick={handleExport}>Export Report</button>
              </div>
          )}
        </div>

        {/* --- NEW: Combined & Collapsible Admin Tools Section --- */}
        <div className="admin-tools-container" style={{ marginTop: '30px', borderTop: '2px solid #eee', paddingTop: '15px' }}>
          {!isAdminUnlocked && !showAdminPasswordPrompt && (
            <button
              onClick={() => { setShowAdminPasswordPrompt(true); setAdminPasswordError(''); }} // Show prompt on click
              className="button-link-style" // Use link style for low emphasis
            >
              Show Admin Tools ▼
            </button>
          )}

          {/* --- Password Prompt Form --- */}
          {showAdminPasswordPrompt && !isAdminUnlocked && (
            <form onSubmit={handleAdminPasswordSubmit} style={{ marginBottom: '10px', paddingLeft: '10px' }}>
              <label htmlFor="adminPassword" style={{ marginRight: '5px' }}>Admin Password:</label>
              <input
                type="password"
                id="adminPassword"
                value={adminPasswordInput}
                onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminPasswordError(''); }}
                required
                style={{ marginRight: '5px' }}
              />
              <button type="submit" className="button button-small">Unlock</button>
              <button 
                type="button" 
                onClick={() => { setShowAdminPasswordPrompt(false); setAdminPasswordInput(''); setAdminPasswordError(''); }} 
                className="button button-small button-secondary" 
                style={{ marginLeft: '5px' }}
              >
                Cancel
              </button>
              {adminPasswordError && <p className="message error" style={{ fontSize: '0.9em', marginTop: '5px' }}>{adminPasswordError}</p>}
            </form>
          )}

          {/* --- Admin Tools Content (Only shown when unlocked) --- */}
          {isAdminUnlocked && (
            <>
              {/* Button to HIDE tools again (optional, could just rely on refresh) */}
              <button
                onClick={() => setIsAdminUnlocked(false)} // Simple hide, requires password again
                className="button-link-style"
                style={{ marginBottom: '10px' }}
              >
                Hide Admin Tools ▲
              </button>

              <div style={{ marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
                {/* --- MOVED: CSV Upload SECTION --- */}
                <div className="collapsible-section" style={{ padding: '15px', marginTop: '10px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                  <button 
                    onClick={() => setIsCsvSectionVisible(!isCsvSectionVisible)}
                    className="button-link-style" // Also use link style here
                    style={{ marginBottom: '10px', fontWeight: 'bold' }}
                  >
                    {isCsvSectionVisible ? 'Hide Bulk Upload Tool ▲' : 'Show Bulk Upload Tool ▼'}
                  </button>
                  {isCsvSectionVisible && (
                    <div className="form-section" style={{ marginTop: '0', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                      <h3 style={{ fontSize: '1.1em', marginBottom: '10px' }}>Upload Players via CSV</h3>
                      <form onSubmit={handleCsvUpload}>
                        <div>
                          <label htmlFor="csvFileInput">Select CSV File:</label>
                          <input
                            type="file"
                            id="csvFileInput"
                            accept=".csv"
                            onChange={handleCsvFileChange}
                          />
                        </div>
                        <button type="submit" disabled={isUploadingCsv || !csvFile} className="button button-small">
                          {isUploadingCsv ? 'Uploading...' : 'Upload CSV'}
                        </button>
                      </form>
                      {uploadError && <p className="message error">{uploadError}</p>}
                      {uploadSummary && (
                        <div className="message summary">
                          <h4>Upload Summary</h4>
                          <p>Processed Rows: {uploadSummary.processed_rows}</p>
                          <p>✅ Successfully Imported: {uploadSummary.imported_count}</p>
                          <p>⚠️ Skipped Rows: {uploadSummary.skipped_count}</p>
                          {uploadSummary.skipped_count > 0 && uploadSummary.skipped_details && (
                            <div>
                              <h5>Skipped Row Details:</h5>
                              <ul>
                                {uploadSummary.skipped_details.map((skip, index) => (
                                  <li key={index} style={{fontSize: '0.9em'}}>Row {skip.row}: {skip.reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* --- End MOVED CSV Upload Section --- */}

                {/* --- MOVED: Player Reset Section (Now Collapsible) --- */}
                <div style={{ marginTop: '20px' }}> {/* Container for the reset toggle and section */} 
                  <button 
                    onClick={() => setShowResetTool(!showResetTool)}
                    className="button-link-style" // Use link style for low emphasis
                    style={{ marginBottom: '10px' }}
                  >
                    {showResetTool ? 'Hide Reset Tool ▲' : 'Show Reset Tool ▼'}
                  </button>

                  {showResetTool && (
                    <section className="admin-section" style={{marginTop: '5px'}}> {/* Keep original styling, reduce top margin */} 
                      <h4>Reset Data</h4>
                      <p>Warning: This action is permanent and cannot be undone.</p>
                      <button
                        onClick={openResetModal}
                        className="button button-danger button-small" // Keep existing danger/small style
                        disabled={isResetting}
                      >
                        {isResetting ? 'Resetting...' : 'Reset All Players & Results'}
                      </button>
                    </section>
                  )}
                </div>
                {/* --- End MOVED Player Reset Section --- */}
              </div>
            </>
          )}
        </div>
        {/* --- End Combined Admin Tools Section --- */}

        {/* --- Reset Confirmation Modal (Remains unchanged) --- */}
        {isResetModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Confirm Reset</h2>
              <p><strong>Warning:</strong> This action will permanently delete <strong>all players</strong> and <strong>all associated drill results</strong> from the system.</p>
              <p>This cannot be undone.</p>
              <p>To proceed, please type <strong>REMOVE</strong> in the box below:</p>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={(e) => {
                    setResetConfirmationText(e.target.value);
                    // Clear error as user types
                    if (resetError) setResetError(''); 
                }}
                placeholder="Type REMOVE here"
                className={resetError && resetConfirmationText !== 'REMOVE' ? 'input-error' : ''}
              />
              {/* Display error message inside modal */}
              {resetError && <p className="modal-error">{resetError}</p>}
              
              <div className="modal-actions">
                <button onClick={closeResetModal} className="button" disabled={isResetting}>
                  Cancel
                </button>
                <button
                  onClick={handleResetConfirm}
                  className="button button-danger"
                  disabled={resetConfirmationText !== 'REMOVE' || isResetting}
                >
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* --- End Reset Confirmation Modal --- */}

        {/* --- >>> NEW: Player Transfer Modal <<< --- */}
        {isTransferModalOpen && playerToTransfer && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Transfer Player Age Group</h2>
              <p>Transferring: <strong>{playerToTransfer.name} (#{playerToTransfer.number})</strong></p>
              <p>Current Age Group: <strong>{playerToTransfer.age_group}</strong></p>
              
              <div style={{ margin: '15px 0' }}>
                <label htmlFor="newAgeGroupSelect">Select New Age Group:</label>
                <select
                  id="newAgeGroupSelect"
                  value={selectedNewAgeGroup}
                  onChange={(e) => {
                    setSelectedNewAgeGroup(e.target.value);
                    if (transferError) setTransferError(''); // Clear error on change
                  }}
                  required
                  style={{ marginLeft: '10px', padding: '5px' }}
                >
                  <option value="" disabled>-- Select New Group --</option>
                  {AGE_GROUPS.filter(group => group !== '' && group !== playerToTransfer.age_group).map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>

              {transferError && <p className="modal-error">{transferError}</p>}
              
              <div className="modal-actions">
                <button onClick={handleCancelTransfer} className="button" disabled={isTransferring}>
                  Cancel
                </button>
                <button
                  onClick={handleTransferConfirm}
                  className="button button-primary" // Use primary style for confirm
                  disabled={!selectedNewAgeGroup || isTransferring || selectedNewAgeGroup === playerToTransfer.age_group}
                >
                  {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* --- <<< END NEW PLAYER TRANSFER MODAL >>> --- */}

      </div>
    </AppLayout>
  );
}

export default App; 