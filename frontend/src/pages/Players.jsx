import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const Players = () => {
  const { user, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchPlayers = async () => {
      setLoading(true);
      setError('');
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/players/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch players: ${res.status}`);
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        setError(err.message || 'Failed to load players.');
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [user]);

  if (authLoading || loading) return <div className="empty-state">Loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;

  return (
    <>
      <h2>Registered Players</h2>
      <div className="players-list">
        {players.length === 0 ? (
          <div className="empty-state">No players registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age Group</th>
                <th>Email</th>
                <th>Composite Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.age_group}</td>
                  <td>{player.email || '-'}</td>
                  <td>{player.composite_score !== undefined ? player.composite_score : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default Players; 