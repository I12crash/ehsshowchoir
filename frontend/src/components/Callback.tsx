import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle OAuth callback
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  }, [navigate]);

  return (
    <div className="callback">
      <h2>Completing sign in...</h2>
    </div>
  );
}
