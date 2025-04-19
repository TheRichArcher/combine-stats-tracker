console.log("static/script.js loaded successfully."); // Add confirmation log

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/serviceWorker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// --- Base URL for the Backend API ---
const API_BASE_URL = 'https://combine-stats-tracker.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const resetPlayersBtn = document.getElementById('resetPlayersBtn');
    const resetConfirmationModalEl = document.getElementById('resetConfirmationModal');
    const resetTypeConfirmModalEl = document.getElementById('resetTypeConfirmModal');
    const confirmResetStep1Btn = document.getElementById('confirmResetStep1');
    const confirmResetStep2Btn = document.getElementById('confirmResetStep2');
    const resetConfirmTextInput = document.getElementById('resetConfirmText');
    const playerList = document.getElementById('playerList'); // Assuming this exists for fetchPlayers
    const loadingIndicator = document.getElementById('loadingIndicator'); // Get loading indicator

    // --- Modals ---
    const resetConfirmationModal = new bootstrap.Modal(resetConfirmationModalEl);
    const resetTypeConfirmModal = new bootstrap.Modal(resetTypeConfirmModalEl);

    // --- Event Listeners ---

    // 1. Show First Confirmation Modal
    if (resetPlayersBtn) {
        resetPlayersBtn.addEventListener('click', () => {
            resetConfirmationModal.show();
        });
    }

    // 2. Proceed to Second Modal
    if (confirmResetStep1Btn) {
        confirmResetStep1Btn.addEventListener('click', () => {
            resetConfirmationModal.hide();
            // Clear previous input and disable button before showing
            resetConfirmTextInput.value = '';
            confirmResetStep2Btn.disabled = true;
            resetTypeConfirmModal.show();
        });
    }

    // 3. Enable Final Button on Typing "REMOVE"
    if (resetConfirmTextInput) {
        resetConfirmTextInput.addEventListener('input', () => {
            if (resetConfirmTextInput.value === 'REMOVE') {
                confirmResetStep2Btn.disabled = false;
            } else {
                confirmResetStep2Btn.disabled = true;
            }
        });
    }

    // 4. Execute Reset
    if (confirmResetStep2Btn) {
        confirmResetStep2Btn.addEventListener('click', () => {
            resetAllPlayers();
        });
    }

     // --- Functions ---

    // Function to reset all players
    async function resetAllPlayers() {
        try {
            // Use full URL for fetch
            const response = await fetch(`${API_BASE_URL}/players/reset`, {
                method: 'DELETE',
            });

            const result = await response.json();

            resetTypeConfirmModal.hide(); // Close the modal first

            if (response.ok && result.status === 'success') {
                console.log('Players reset successfully:', result);
                showToast(`Success: ${result.deleted_count} players deleted.`, 'success');
                fetchPlayers(); // Refresh the player list
                // Optionally scroll to top or collapse section
                // window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                console.error('Error resetting players:', result);
                showToast(`Error: ${result.message || 'Could not reset players.'}`, 'danger');
            }
        } catch (error) {
            resetTypeConfirmModal.hide();
            console.error('Network error during player reset:', error);
            showToast('Network error. Could not reach server.', 'danger');
        }
    }

    // Function to fetch players (you should have this already)
    async function fetchPlayers() {
        console.log('Fetching players...');
        if (loadingIndicator) loadingIndicator.style.display = 'flex'; // Show spinner
        if (playerList) {
             // Clear only player items, not the spinner initially
             Array.from(playerList.children).forEach(child => {
                 if (child.id !== 'loadingIndicator') {
                     playerList.removeChild(child);
                 }
             });
        }

        // Replace with your actual fetch logic:
        try {
            // Use full URL for fetch
            const response = await fetch(`${API_BASE_URL}/players`);
            if (!response.ok) {
                // Attempt to get more specific error info if possible
                let errorDetail = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorDetail += `, ${errorJson.detail || JSON.stringify(errorJson)}`;
                } catch (jsonError) {
                    // Ignore if response is not JSON or empty
                }
                throw new Error(errorDetail);
            }
            const players = await response.json();
            populatePlayerList(players);

        } catch (error) {
            console.error('Error fetching players:', error);
            if (playerList) {
                // Clear previous items if any, show error
                Array.from(playerList.children).forEach(child => {
                    if (child.id !== 'loadingIndicator') {
                        playerList.removeChild(child);
                    }
                });
                const errorLi = document.createElement('li');
                errorLi.className = 'list-group-item text-danger text-center';
                errorLi.textContent = 'Error loading players.';
                playerList.appendChild(errorLi);
            }
            showToast('Error fetching players.', 'danger');
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide spinner regardless of outcome
        }
    }

    // Function to populate the player list (you should have this already)
    function populatePlayerList(players) {
        if (!playerList) return;

        // Clear only previous player/error items, keep spinner structure if needed (though it's hidden now)
        Array.from(playerList.children).forEach(child => {
            if (child.id !== 'loadingIndicator') {
                playerList.removeChild(child);
            }
        });

        if (players.length === 0) {
            const noPlayersLi = document.createElement('li');
            noPlayersLi.className = 'list-group-item text-muted text-center';
            noPlayersLi.textContent = 'No players registered.';
            playerList.appendChild(noPlayersLi);
            return;
        }

        players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center'; // Add classes for layout
            li.innerHTML = `
                <span>
                    <strong class="player-name">${escapeHTML(player.name)}</strong>
                    ${player.jersey_number ? `<span class="text-muted ms-2">#${escapeHTML(player.jersey_number.toString())}</span>` : ''}
                </span>
                <button class="btn btn-sm btn-outline-secondary edit-player-btn" data-player-id="${player.id}" aria-label="Edit ${escapeHTML(player.name)}">
                    <i class="bi bi-pencil"></i>
                </button>
            `; // Example structure with edit button
            playerList.appendChild(li);
        });

        // Add event listeners for dynamically added edit buttons if needed
        // document.querySelectorAll('.edit-player-btn').forEach(button => { ... });
    }

    // Helper function to escape HTML (prevent XSS)
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Function to show toast messages (you likely have a preferred way)
    function showToast(message, type = 'info') {
        console.log(`Toast (${type}): ${message}`);
        // Example: Create a simple alert or integrate with a library like Toastify
        const toastContainer = document.getElementById('toastContainer'); // Assume you have a container
         if (toastContainer) {
             const toastEl = document.createElement('div');
             toastEl.className = `alert alert-${type} alert-dismissible fade show`;
             toastEl.role = 'alert';
             toastEl.innerHTML = `
                 ${message}
                 <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
             `;
             toastContainer.appendChild(toastEl);
             // Auto-dismiss after 5 seconds
             setTimeout(() => {
                const toast = new bootstrap.Alert(toastEl);
                toast.close();
             }, 5000);
         } else {
            alert(`(${type.toUpperCase()}) ${message}`); // Fallback
         }
    }

    // --- Initial Load ---
    fetchPlayers(); // Load players when the page loads

}); // End DOMContentLoaded 