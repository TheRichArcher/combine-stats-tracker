document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const resetPlayersBtn = document.getElementById('resetPlayersBtn');
    const resetConfirmationModalEl = document.getElementById('resetConfirmationModal');
    const resetTypeConfirmModalEl = document.getElementById('resetTypeConfirmModal');
    const confirmResetStep1Btn = document.getElementById('confirmResetStep1');
    const confirmResetStep2Btn = document.getElementById('confirmResetStep2');
    const resetConfirmTextInput = document.getElementById('resetConfirmText');
    const playerList = document.getElementById('playerList'); // Assuming this exists for fetchPlayers

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
            const response = await fetch('/players/reset', {
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

    // --- Placeholder Functions (Replace or integrate with your existing code) ---

    // Function to fetch players (you should have this already)
    async function fetchPlayers() {
        console.log('Fetching players...');
        // Example placeholder: Clear list and maybe show a loading state
        if (playerList) playerList.innerHTML = '<li>Loading players...</li>';
        // Replace with your actual fetch logic:
        // try {
        //     const response = await fetch('/players');
        //     const players = await response.json();
        //     populatePlayerList(players);
        // } catch (error) {
        //     console.error('Error fetching players:', error);
        //     if (playerList) playerList.innerHTML = '<li>Error loading players.</li>';
        //      showToast('Error fetching players.', 'danger');
        // }
        // --- Mock refreshing list after reset for now ---
        setTimeout(() => {
             if (playerList) playerList.innerHTML = '<li>Player list refreshed (mock).</li>';
        }, 500);
         // --- End Mock ---
    }

    // Function to populate the player list (you should have this already)
    function populatePlayerList(players) {
        if (!playerList) return;
        playerList.innerHTML = ''; // Clear existing list
        if (players.length === 0) {
            playerList.innerHTML = '<li>No players registered.</li>';
            return;
        }
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name} (Jersey: ${player.jersey_number})`; // Adjust as needed
            playerList.appendChild(li);
        });
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