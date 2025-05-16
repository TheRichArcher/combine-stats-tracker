import React, { useEffect, useState, useMemo } from 'react';
import PageWrapper from '../layout/PageWrapper';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const DRILL_TYPES = [
  { key: 'forty_yard_dash', label: '40 Yard Dash' },
  { key: 'vertical_jump', label: 'Vertical Jump' },
  { key: 'agility', label: 'Agility' },
  { key: 'throwing', label: 'Throwing' },
  { key: 'catching', label: 'Catching' },
];
const DEFAULT_WEIGHTS = {
  forty_yard_dash: 1,
  vertical_jump: 1,
  agility: 1,
  throwing: 1,
  catching: 1,
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState([]);
  const [drillResults, setDrillResults] = useState({}); // { playerId: [results] }
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch players and their drill results
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = await user.getIdToken();
        // 1. Fetch all players
        const res = await fetch(`${API_BASE_URL}/players/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch players: ${res.status}`);
        const playersData = await res.json();
        setPlayers(playersData);
        // 2. Fetch drill results for each player
        const resultsMap = {};
        await Promise.all(
          playersData.map(async (player) => {
            const r = await fetch(`${API_BASE_URL}/players/${player.id}/results`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) {
              resultsMap[player.id] = await r.json();
            } else {
              resultsMap[player.id] = [];
            }
          })
        );
        setDrillResults(resultsMap);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Calculate composite scores and rankings
  const rankedPlayers = useMemo(() => {
    if (!players.length) return [];
    return players.map(player => {
      const results = drillResults[player.id] || [];
      // For each drill type, get best score (assume higher is better for all for now)
      const bestScores = {};
      results.forEach(r => {
        if (!bestScores[r.drill_type] || r.score > bestScores[r.drill_type]) {
          bestScores[r.drill_type] = r.score;
        }
      });
      // Weighted sum
      let total = 0;
      let weightSum = 0;
      DRILL_TYPES.forEach(dt => {
        const w = weights[dt.key] || 0;
        total += (bestScores[dt.key] || 0) * w;
        weightSum += w;
      });
      const composite = weightSum ? (total / weightSum) : 0;
      return {
        ...player,
        composite,
        bestScores,
      };
    }).sort((a, b) => b.composite - a.composite);
  }, [players, drillResults, weights]);

  const handleWeightChange = (key, value) => {
    setWeights(w => ({ ...w, [key]: parseFloat(value) }));
  };

  const exportCSV = () => {
    const csv = [
      ['Name', 'Age Group', ...DRILL_TYPES.map(dt => dt.label), 'Composite Score'],
      ...rankedPlayers.map(p => [
        p.name,
        p.age_group,
        ...DRILL_TYPES.map(dt => p.bestScores[dt.key] ?? ''),
        p.composite.toFixed(2),
      ]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_rankings.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) return <PageWrapper><Header /><main className="dashboard-main"><div className="empty-state">Loading...</div></main><Footer /></PageWrapper>;
  if (error) return <PageWrapper><Header /><main className="dashboard-main"><div className="empty-state">{error}</div></main><Footer /></PageWrapper>;

  return (
    <PageWrapper>
      <Header />
      <main className="dashboard-main">
        <h2>Rankings by Age Group</h2>
        <div className="drill-weights">
          {DRILL_TYPES.map(dt => (
            <div key={dt.key} className="drill-slider">
              <span>{dt.label}</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={weights[dt.key]}
                onChange={e => handleWeightChange(dt.key, e.target.value)}
              />
              <span>{weights[dt.key]}</span>
            </div>
          ))}
        </div>
        <div className="drill-results-table desktop-only">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age Group</th>
                {DRILL_TYPES.map(dt => <th key={dt.key}>{dt.label}</th>)}
                <th>Composite</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map(player => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.age_group}</td>
                  {DRILL_TYPES.map(dt => <td key={dt.key}>{player.bestScores[dt.key] ?? '-'}</td>)}
                  <td>{player.composite.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="drill-results-cards mobile-only">
          {rankedPlayers.map(player => (
            <div key={player.id} className="drill-card">
              <h3>{player.name}</h3>
              <div>Age Group: {player.age_group}</div>
              {DRILL_TYPES.map(dt => (
                <div key={dt.key}>{dt.label}: {player.bestScores[dt.key] ?? '-'}</div>
              ))}
              <div>Composite: {player.composite.toFixed(2)}</div>
            </div>
          ))}
        </div>
        <PrimaryButton onClick={exportCSV}>Export CSV</PrimaryButton>
      </main>
      <Footer />
    </PageWrapper>
  );
};

export default Dashboard; 