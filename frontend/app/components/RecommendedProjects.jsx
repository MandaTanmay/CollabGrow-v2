'use client';

import React, { useEffect, useState } from 'react';

function RecommendedProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/recommend/projects');
        if (!res.ok) throw new Error('Failed to fetch recommendations');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRecommendations();
  }, []);

  if (loading) return <div>Loading recommendations...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!projects.length) return <div>No recommendations found.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <div key={p.id} className="border rounded-lg p-4 shadow bg-white">
          <h3 className="font-bold text-lg mb-2">{p.title}</h3>
          <p className="mb-2 text-gray-700">{p.description}</p>
          <div className="mb-2">
            <span className="font-semibold">Skills:</span> {Array.isArray(p.skills) ? p.skills.join(', ') : p.skills}
          </div>
          <div className="font-semibold text-blue-600">Match: {(p.match * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

export default RecommendedProjects;
