import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function RecommendedProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/recommend/projects');
        setProjects(res.data.projects || []);
      } catch (err) {
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) return <div>Loading recommendations...</div>;
  if (error) return <div>{error}</div>;
  if (!projects.length) return <div>No recommendations available.</div>;

  return (
    <div className="recommended-projects">
      {projects.map(p => (
        <div key={p.id} className="project-card">
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <div>Skills: {Array.isArray(p.skills) ? p.skills.join(', ') : p.skills}</div>
          <div>Match: {(p.score * 100).toFixed(0)}%</div>
          <button>Collaborate</button>
        </div>
      ))}
    </div>
  );
}
