import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast';
import RichTextEditor from './RichTextEditor';

interface CoachNotesProps {
  testId: string;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function CoachNotes({ testId }: CoachNotesProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    loadNotes();
  }, [testId]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('test_results')
        .select('coach_notes')
        .eq('test_id', testId)
        .maybeSingle();

      if (error) throw error;

      if (data?.coach_notes) {
        setNotes(data.coach_notes);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('test_results')
        .update({
          coach_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('test_id', testId);

      if (error) throw error;
      setLastSaved(new Date());
      setToast({ message: 'Notes saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to save notes:', err);
      setToast({ message: 'Failed to save notes. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
          Coach Notes
        </h3>
        {lastSaved && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            Saved at {lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Add your interpretation, context, and recommendations. These notes will be included in the athlete's report.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <RichTextEditor
          value={notes}
          onChange={setNotes}
          placeholder="Example: Test shows excellent aerobic capacity with well-defined thresholds. Recommend focusing on Z2 base building for the next 4 weeks..."
          disabled={saving}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          These notes are only visible to coaches until explicitly shared with the athlete.
        </p>
        <button
          className="btn btn-primary"
          onClick={saveNotes}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
    </>
  );
}
