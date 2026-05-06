import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PushToHubButtonProps {
  athleteId: string;
  athleteName: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function PushToHubButton({ athleteId, athleteName, onToast }: PushToHubButtonProps) {
  const [pushing, setPushing] = useState(false);
  const [lastPushed, setLastPushed] = useState<string | null>(null);

  const handlePush = async () => {
    setPushing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/push-to-hub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
          'Apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ athlete_id: athleteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error ?? 'Push failed';
        const hubDetail = data?.hub_response
          ? ` | Hub: ${JSON.stringify(data.hub_response)}`
          : '';
        if (msg.includes('Planner token not configured')) {
          onToast('Planner token not configured. Go to Settings > Hub Integration to add it.', 'error');
        } else {
          onToast(`Push failed: ${msg}${hubDetail}`, 'error');
        }
        console.error('Push to Hub failed:', data);
        return;
      }

      const now = new Date().toLocaleTimeString();
      setLastPushed(now);
      onToast(`Passport of ${athleteName} sent to Hub successfully.`, 'success');
    } catch (err) {
      onToast('Network error. Could not reach the Hub.', 'error');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-6 py-4 flex items-center gap-3">
        <div className="bg-white/10 rounded-lg p-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Hub Integration</h3>
          <p className="text-xs text-white/60">Send biological passport to the athlete's Hub profile</p>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Push the latest physiological and anthropometric data to the Hub so the athlete can view their updated passport.
          </p>
          {lastPushed && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Last sent at {lastPushed}
            </p>
          )}
        </div>
        <button
          onClick={handlePush}
          disabled={pushing}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {pushing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Send to Hub
            </>
          )}
        </button>
      </div>
    </div>
  );
}
