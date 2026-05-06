import { useState, useEffect } from 'react';

const HUB_SUPABASE_URL = import.meta.env.VITE_HUB_SUPABASE_URL || 'https://ngkcbygyoobqhlmlnuvl.supabase.co';

export default function DebugAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [urlToken, setUrlToken] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('hub_session_token');
    setToken(storedToken);

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('session_token');
    setUrlToken(tokenFromUrl);
  }, []);

  const testToken = async () => {
    if (!token) return;

    setTesting(true);
    try {
      const response = await fetch(`${HUB_SUPABASE_URL}/functions/v1/auth-me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setTestResult({
        status: response.status,
        ok: response.ok,
        data: data,
      });
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-2xl rounded-lg p-4 max-w-md max-h-96 overflow-auto border-2 border-blue-500 z-50">
      <h3 className="font-bold text-lg mb-2 text-blue-900">🔍 Auth Debug</h3>

      <div className="space-y-2 text-xs">
        <div>
          <strong>Token in URL:</strong>
          <div className="bg-gray-100 p-1 rounded mt-1 font-mono break-all">
            {urlToken ? `${urlToken.substring(0, 30)}...` : 'None'}
          </div>
        </div>

        <div>
          <strong>Token in localStorage:</strong>
          <div className="bg-gray-100 p-1 rounded mt-1 font-mono break-all">
            {token ? `${token.substring(0, 30)}...` : 'None'}
          </div>
        </div>

        <button
          onClick={testToken}
          disabled={!token || testing}
          className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing...' : 'Test Token'}
        </button>

        {testResult && (
          <div className="mt-2">
            <strong>Test Result:</strong>
            <pre className="bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs overflow-auto max-h-40">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}

        <button
          onClick={() => {
            localStorage.removeItem('hub_session_token');
            setToken(null);
            setTestResult(null);
          }}
          className="w-full bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-xs"
        >
          Clear Token
        </button>
      </div>
    </div>
  );
}
