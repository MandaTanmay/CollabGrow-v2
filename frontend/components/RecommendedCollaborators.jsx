import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function RecommendedCollaborators({ projectId }) {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCollaborators() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/recommend/collaborators?projectId=${projectId}`);
        setCollaborators(res.data.collaborators || []);
      } catch (err) {
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchCollaborators();
  }, [projectId]);

  if (loading) return <div>Loading collaborators...</div>;
  if (error) return <div>{error}</div>;
  if (!collaborators.length) return <div>No collaborator recommendations available.</div>;

  return (
    <div className="recommended-collaborators">
      {collaborators.map(c => (
        <div key={c.id} className="collaborator-card">
          <h3>{c.full_name || c.username}</h3>
          <div>Skills: {Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}</div>
          <div>Match: {(c.score * 100).toFixed(0)}%</div>
          <button>Connect</button>
        </div>
      ))}
    </div>
  );
}
