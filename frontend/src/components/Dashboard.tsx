import { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { get } from 'aws-amplify/api';

interface ApiHealthResponse {
  status: string;
  timestamp: string;
  region: string;
}

interface UploadFile {
  Key: string;
  Size: number;
  LastModified?: string;
}

interface UploadsResponse {
  files: UploadFile[];
}

export default function Dashboard() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [apiHealth, setApiHealth] = useState<string>('Checking...');
  const [uploads, setUploads] = useState<UploadFile[]>([]);

  useEffect(() => {
    checkApiHealth();
    fetchUploads();
  }, []);

  const checkApiHealth = async () => {
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: '/health',
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text) as ApiHealthResponse;
      setApiHealth(data.status || 'Connected');
    } catch (error) {
      console.error('API Health check failed:', error);
      setApiHealth('Error');
    }
  };

  const fetchUploads = async () => {
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: '/uploads',
      });
      const response = await restOperation.response;
      const text = await response.body.text();
      const data = JSON.parse(text) as UploadsResponse;
      setUploads(data.files || []);
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Foster.dev Dashboard</h1>
        <button onClick={signOut}>Sign Out</button>
      </header>
      
      <main>
        <section className="user-info">
          <h2>Welcome!</h2>
          <p>Email: {user?.signInDetails?.loginId}</p>
        </section>

        <section className="api-status">
          <h2>API Status</h2>
          <p>Health: <span className={`status ${apiHealth.toLowerCase()}`}>{apiHealth}</span></p>
        </section>

        <section className="uploads">
          <h2>Recent Uploads</h2>
          {uploads.length > 0 ? (
            <ul>
              {uploads.map((file, index) => (
                <li key={index}>{file.Key} - {file.Size} bytes</li>
              ))}
            </ul>
          ) : (
            <p>No uploads yet</p>
          )}
        </section>
      </main>
    </div>
  );
}
