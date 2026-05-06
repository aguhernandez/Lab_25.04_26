import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AthleteSelector from '../components/AthleteSelector';
import StepByStepMeasurementInput from '../components/anthropometry/StepByStepMeasurementInput';
import KerrPresentationDashboard from '../components/anthropometry/KerrPresentationDashboard';
import ComparativeAssessment from '../components/anthropometry/ComparativeAssessment';
import AnthropometryComparison from '../components/AnthropometryComparison';
import IndicesAndProportionality from '../components/anthropometry/IndicesAndProportionality';
import AnatomicalBodyMap2D from '../components/anthropometry/AnatomicalBodyMap2D';
import RichTextEditor from '../components/RichTextEditor';
import { prepareKerrInputFromMeasurement } from '../utils/kerrBodyComposition';
import { calculateKerrResults } from '../utils/kerrCalculations';
import type { AnthropometryData, AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';
import { adaptDataForDatabase } from '../types/anthropometry.types';
import { FileText, Plus, History, ChartBar as BarChart3, Activity, RefreshCw, UserCheck, Pencil, Trash2 } from 'lucide-react';
import type { Athlete } from '../types';
import EditMeasurementModal from '../components/anthropometry/EditMeasurementModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface AnthropometryPageProps {
  onNavigateToReports?: (athlete: Athlete) => void;
}

export default function AnthropometryPage({ onNavigateToReports }: AnthropometryPageProps) {
  const { profile } = useAuth();
  const isAthlete = profile?.role === 'athlete';
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [showAthleteSelector, setShowAthleteSelector] = useState(!isAthlete);
  const [viewMode, setViewMode] = useState<'new' | 'history' | 'results' | 'comparison' | 'raw-data'>('new');
  const [measurements, setMeasurements] = useState<AnthropometryData>({
    measurement_method: 'manual',
    age_years: undefined,
    sex: undefined,
  });
  const [birthDate, setBirthDate] = useState<string>('');
  const [savedMeasurements, setSavedMeasurements] = useState<AnthropometryMeasurement[]>([]);
  const [selectedMeasurement, setSelectedMeasurement] = useState<AnthropometryMeasurement | null>(null);
  const [currentResults, setCurrentResults] = useState<KerrResults | null>(null);
  const [previousResults, setPreviousResults] = useState<KerrResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [coachNotes, setCoachNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<AnthropometryMeasurement | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMeasurement, setDeletingMeasurement] = useState<AnthropometryMeasurement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentAthleteId = selectedAthlete?.id || (isAthlete ? profile?.id : undefined);

  useEffect(() => {
    if (isAthlete && profile?.id && !selectedAthlete) {
      const fetchOwnAthleteRecord = async () => {
        const { data } = await supabase
          .from('athletes')
          .select('*')
          .eq('hub_user_id', profile.hub_user_id || '')
          .maybeSingle();
        if (data) {
          setSelectedAthlete(data as Athlete);
        }
      };
      fetchOwnAthleteRecord();
    }
  }, [isAthlete, profile]);

  useEffect(() => {
    if (currentAthleteId) {
      loadMeasurements();
    }
  }, [currentAthleteId]);

  useEffect(() => {
    if (selectedAthlete) {
      if (selectedAthlete.date_of_birth) {
        setBirthDate(selectedAthlete.date_of_birth);
      }
      if (selectedAthlete.sex && (selectedAthlete.sex === 'male' || selectedAthlete.sex === 'female')) {
        setMeasurements(prev => ({ ...prev, sex: selectedAthlete.sex as 'male' | 'female' }));
      }
    }
  }, [selectedAthlete?.id]);

  const loadMeasurements = async () => {
    if (!currentAthleteId) return;

    const { data, error } = await supabase
      .from('anthropometry_measurements')
      .select('*')
      .eq('athlete_id', currentAthleteId)
      .order('measurement_date', { ascending: false });

    if (error) {
      console.error('Error loading measurements:', error);
      return;
    }

    setSavedMeasurements(data || []);

    if (data && data.length > 0) {
      setSelectedMeasurement(data[0]);
      loadKerrResults(data[0].id);

      if (data.length > 1) {
        loadKerrResults(data[1].id, true);
      }
    }
  };

  const loadKerrResults = async (measurementId: string, isPrevious = false) => {
    const { data, error } = await supabase
      .from('anthropometry_kerr_results')
      .select('*')
      .eq('measurement_id', measurementId)
      .maybeSingle();

    if (error) {
      console.error('Error loading Kerr results:', error);
      return;
    }

    if (isPrevious) {
      setPreviousResults(data);
    } else {
      setCurrentResults(data);
    }
  };

  useEffect(() => {
    if (selectedMeasurement) {
      setCoachNotes(selectedMeasurement.coach_notes || '');
    }
  }, [selectedMeasurement?.id]);

  const handleSaveCoachNotes = async () => {
    if (!selectedMeasurement) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('anthropometry_measurements')
      .update({ coach_notes: coachNotes })
      .eq('id', selectedMeasurement.id);
    setSavingNotes(false);
    if (error) {
      setToast({ message: 'Error saving notes', type: 'error' });
    } else {
      setSelectedMeasurement({ ...selectedMeasurement, coach_notes: coachNotes });
      setToast({ message: 'Notes saved', type: 'success' });
    }
  };

  const calculateAge = (birth: string): number => {
    if (!birth) return 0;
    const today = new Date();
    const birthDateObj = new Date(birth);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  };

  const handleSaveMeasurement = async () => {
    if (!currentAthleteId) return;

    setLoading(true);

    try {
      const calculatedAge = calculateAge(birthDate);

      const dbData = adaptDataForDatabase(measurements);
      dbData.athlete_id = currentAthleteId;
      dbData.age_years = calculatedAge;
      dbData.sex = measurements.sex;
      dbData.measurement_date = new Date().toISOString();

      console.log('Data to insert:', JSON.stringify(dbData, null, 2));

      const { data: insertedMeasurement, error: insertError } = await supabase
        .from('anthropometry_measurements')
        .insert(dbData)
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        console.error('Error details:', JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      const kerrInput = prepareKerrInputFromMeasurement(insertedMeasurement);
      kerrInput.age_years = calculatedAge;
      kerrInput.sex = measurements.sex;
      const kerrCalc = calculateKerrResults(kerrInput);

      if (!kerrCalc) {
        throw new Error('Missing required measurements for Kerr body composition. Make sure body mass, stature, all 6 skinfolds, and the 4 girths (arm flexed, thigh mid, calf max, chest) are filled in.');
      }

      const { error: kerrInsertError } = await supabase
        .from('anthropometry_kerr_results')
        .insert({
          measurement_id: insertedMeasurement.id,
          athlete_id: currentAthleteId,
          skin_mass_kg: kerrCalc.skinMassReadjusted,
          skin_mass_pct: kerrCalc.skinMassReadjustedPct,
          skin_mass_z_score: kerrCalc.skinMassZScore,
          skin_mass_adjusted_kg: kerrCalc.skinMassAdjusted,
          skin_mass_adjustment: kerrCalc.skinMassAdjustment,
          adipose_mass_kg: kerrCalc.adiposeMassReadjusted,
          adipose_mass_pct: kerrCalc.adiposeMassReadjustedPct,
          adipose_mass_z_score: kerrCalc.adiposeMassZScore,
          adipose_mass_adjusted_kg: kerrCalc.adiposeMassAdjusted,
          adipose_mass_adjustment: kerrCalc.adiposeMassAdjustment,
          muscle_mass_kg: kerrCalc.muscleMassReadjusted,
          muscle_mass_pct: kerrCalc.muscleMassReadjustedPct,
          muscle_mass_z_score: kerrCalc.muscleMassZScore,
          muscle_mass_adjusted_kg: kerrCalc.muscleMassAdjusted,
          muscle_mass_adjustment: kerrCalc.muscleMassAdjustment,
          residual_mass_kg: kerrCalc.residualMassReadjusted,
          residual_mass_pct: kerrCalc.residualMassReadjustedPct,
          residual_mass_z_score: kerrCalc.residualMassZScore,
          residual_mass_adjusted_kg: kerrCalc.residualMassAdjusted,
          residual_mass_adjustment: kerrCalc.residualMassAdjustment,
          bone_mass_head_kg: kerrCalc.boneMassHead,
          bone_mass_head_pct: kerrCalc.boneMassHeadPct,
          bone_mass_head_z_score: kerrCalc.boneMassHeadZScore,
          bone_mass_head_adjustment: kerrCalc.boneMassHeadAdjustment,
          bone_mass_head_adjusted_kg: kerrCalc.boneMassHeadAdjusted,
          bone_mass_body_kg: kerrCalc.boneMassBody,
          bone_mass_body_pct: kerrCalc.boneMassBodyPct,
          bone_mass_body_z_score: kerrCalc.boneMassBodyZScore,
          bone_mass_body_adjustment: kerrCalc.boneMassBodyAdjustment,
          bone_mass_body_adjusted_kg: kerrCalc.boneMassBodyAdjusted,
          bone_mass_kg: kerrCalc.boneMassReadjusted,
          bone_mass_pct: kerrCalc.boneMassReadjustedPct,
          bone_mass_z_score: kerrCalc.boneMassZScore,
          bone_mass_adjusted_kg: kerrCalc.boneMassAdjusted,
          bone_mass_adjustment: kerrCalc.boneMassAdjustment,
          adipose_mass_readjusted_kg: kerrCalc.adiposeMassReadjusted,
          adipose_mass_readjusted_pct: kerrCalc.adiposeMassReadjustedPct,
          muscle_mass_readjusted_kg: kerrCalc.muscleMassReadjusted,
          muscle_mass_readjusted_pct: kerrCalc.muscleMassReadjustedPct,
          residual_mass_readjusted_kg: kerrCalc.residualMassReadjusted,
          residual_mass_readjusted_pct: kerrCalc.residualMassReadjustedPct,
          bone_mass_readjusted_kg: kerrCalc.boneMassReadjusted,
          bone_mass_readjusted_pct: kerrCalc.boneMassReadjustedPct,
          skin_mass_readjusted_kg: kerrCalc.skinMassReadjusted,
          skin_mass_readjusted_pct: kerrCalc.skinMassReadjustedPct,
          muscle_bone_ratio: kerrCalc.muscleBoneRatio,
          adipose_muscle_ratio: kerrCalc.adiposeMuscleRatio,
          ballast_index: kerrCalc.ballastIndex,
          bmi: kerrCalc.bmi,
          surface_area_m2: kerrCalc.surfaceArea,
          somatotype_endomorphy: kerrCalc.somatotype.endomorphy,
          somatotype_mesomorphy: kerrCalc.somatotype.mesomorphy,
          somatotype_ectomorphy: kerrCalc.somatotype.ectomorphy,
          structured_weight_kg: kerrCalc.structuredWeight,
          structured_weight_diff_kg: kerrCalc.structuredWeightDiff,
          structured_weight_diff_pct: kerrCalc.structuredWeightDiffPct,
          technician_error_pct: kerrCalc.technicianErrorPct,
          calculation_version: '3.0',
        });

      if (kerrInsertError) {
        console.error('Kerr results insert error:', kerrInsertError);
        throw new Error(kerrInsertError.message);
      }

      setToast({ message: 'Measurement saved successfully!', type: 'success' });
      await loadMeasurements();
      setViewMode('results');

      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error saving measurement:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      const errorMsg = error instanceof Error ? error.message : 'Failed to save measurement';
      setToast({ message: errorMsg, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async (measurement: AnthropometryMeasurement) => {
    if (!currentAthleteId) return;
    setLoading(true);
    try {
      const kerrInput = prepareKerrInputFromMeasurement(measurement);
      const kerrCalc = calculateKerrResults(kerrInput);

      if (!kerrCalc) {
        setToast({ message: 'Missing required measurements for recalculation.', type: 'error' });
        setTimeout(() => setToast(null), 4000);
        return;
      }

      const { error } = await supabase
        .from('anthropometry_kerr_results')
        .upsert({
          measurement_id: measurement.id,
          athlete_id: currentAthleteId,
          skin_mass_kg: kerrCalc.skinMassReadjusted,
          skin_mass_pct: kerrCalc.skinMassReadjustedPct,
          skin_mass_z_score: kerrCalc.skinMassZScore,
          skin_mass_adjusted_kg: kerrCalc.skinMassAdjusted,
          skin_mass_adjustment: kerrCalc.skinMassAdjustment,
          adipose_mass_kg: kerrCalc.adiposeMassReadjusted,
          adipose_mass_pct: kerrCalc.adiposeMassReadjustedPct,
          adipose_mass_z_score: kerrCalc.adiposeMassZScore,
          adipose_mass_adjusted_kg: kerrCalc.adiposeMassAdjusted,
          adipose_mass_adjustment: kerrCalc.adiposeMassAdjustment,
          muscle_mass_kg: kerrCalc.muscleMassReadjusted,
          muscle_mass_pct: kerrCalc.muscleMassReadjustedPct,
          muscle_mass_z_score: kerrCalc.muscleMassZScore,
          muscle_mass_adjusted_kg: kerrCalc.muscleMassAdjusted,
          muscle_mass_adjustment: kerrCalc.muscleMassAdjustment,
          residual_mass_kg: kerrCalc.residualMassReadjusted,
          residual_mass_pct: kerrCalc.residualMassReadjustedPct,
          residual_mass_z_score: kerrCalc.residualMassZScore,
          residual_mass_adjusted_kg: kerrCalc.residualMassAdjusted,
          residual_mass_adjustment: kerrCalc.residualMassAdjustment,
          bone_mass_head_kg: kerrCalc.boneMassHead,
          bone_mass_head_pct: kerrCalc.boneMassHeadPct,
          bone_mass_head_z_score: kerrCalc.boneMassHeadZScore,
          bone_mass_head_adjustment: kerrCalc.boneMassHeadAdjustment,
          bone_mass_head_adjusted_kg: kerrCalc.boneMassHeadAdjusted,
          bone_mass_body_kg: kerrCalc.boneMassBody,
          bone_mass_body_pct: kerrCalc.boneMassBodyPct,
          bone_mass_body_z_score: kerrCalc.boneMassBodyZScore,
          bone_mass_body_adjustment: kerrCalc.boneMassBodyAdjustment,
          bone_mass_body_adjusted_kg: kerrCalc.boneMassBodyAdjusted,
          bone_mass_kg: kerrCalc.boneMassReadjusted,
          bone_mass_pct: kerrCalc.boneMassReadjustedPct,
          bone_mass_z_score: kerrCalc.boneMassZScore,
          bone_mass_adjusted_kg: kerrCalc.boneMassAdjusted,
          bone_mass_adjustment: kerrCalc.boneMassAdjustment,
          adipose_mass_readjusted_kg: kerrCalc.adiposeMassReadjusted,
          adipose_mass_readjusted_pct: kerrCalc.adiposeMassReadjustedPct,
          muscle_mass_readjusted_kg: kerrCalc.muscleMassReadjusted,
          muscle_mass_readjusted_pct: kerrCalc.muscleMassReadjustedPct,
          residual_mass_readjusted_kg: kerrCalc.residualMassReadjusted,
          residual_mass_readjusted_pct: kerrCalc.residualMassReadjustedPct,
          bone_mass_readjusted_kg: kerrCalc.boneMassReadjusted,
          bone_mass_readjusted_pct: kerrCalc.boneMassReadjustedPct,
          skin_mass_readjusted_kg: kerrCalc.skinMassReadjusted,
          skin_mass_readjusted_pct: kerrCalc.skinMassReadjustedPct,
          muscle_bone_ratio: kerrCalc.muscleBoneRatio,
          adipose_muscle_ratio: kerrCalc.adiposeMuscleRatio,
          ballast_index: kerrCalc.ballastIndex,
          bmi: kerrCalc.bmi,
          surface_area_m2: kerrCalc.surfaceArea,
          somatotype_endomorphy: kerrCalc.somatotype.endomorphy,
          somatotype_mesomorphy: kerrCalc.somatotype.mesomorphy,
          somatotype_ectomorphy: kerrCalc.somatotype.ectomorphy,
          structured_weight_kg: kerrCalc.structuredWeight,
          structured_weight_diff_kg: kerrCalc.structuredWeightDiff,
          structured_weight_diff_pct: kerrCalc.structuredWeightDiffPct,
          technician_error_pct: kerrCalc.technicianErrorPct,
          calculation_version: '3.0',
        }, { onConflict: 'measurement_id' });

      if (error) throw error;

      const newResults: KerrResults = {
        ...(currentResults as KerrResults),
        measurement_id: measurement.id,
        skin_mass_kg: kerrCalc.skinMassReadjusted,
        skin_mass_pct: kerrCalc.skinMassReadjustedPct,
        skin_mass_z_score: kerrCalc.skinMassZScore,
        skin_mass_adjusted_kg: kerrCalc.skinMassAdjusted,
        skin_mass_adjustment: kerrCalc.skinMassAdjustment,
        adipose_mass_kg: kerrCalc.adiposeMassReadjusted,
        adipose_mass_pct: kerrCalc.adiposeMassReadjustedPct,
        adipose_mass_z_score: kerrCalc.adiposeMassZScore,
        adipose_mass_adjusted_kg: kerrCalc.adiposeMassAdjusted,
        adipose_mass_adjustment: kerrCalc.adiposeMassAdjustment,
        muscle_mass_kg: kerrCalc.muscleMassReadjusted,
        muscle_mass_pct: kerrCalc.muscleMassReadjustedPct,
        muscle_mass_z_score: kerrCalc.muscleMassZScore,
        muscle_mass_adjusted_kg: kerrCalc.muscleMassAdjusted,
        muscle_mass_adjustment: kerrCalc.muscleMassAdjustment,
        residual_mass_kg: kerrCalc.residualMassReadjusted,
        residual_mass_pct: kerrCalc.residualMassReadjustedPct,
        residual_mass_z_score: kerrCalc.residualMassZScore,
        residual_mass_adjusted_kg: kerrCalc.residualMassAdjusted,
        residual_mass_adjustment: kerrCalc.residualMassAdjustment,
        bone_mass_head_kg: kerrCalc.boneMassHead,
        bone_mass_head_pct: kerrCalc.boneMassHeadPct,
        bone_mass_head_z_score: kerrCalc.boneMassHeadZScore,
        bone_mass_head_adjustment: kerrCalc.boneMassHeadAdjustment,
        bone_mass_head_adjusted_kg: kerrCalc.boneMassHeadAdjusted,
        bone_mass_body_kg: kerrCalc.boneMassBody,
        bone_mass_body_pct: kerrCalc.boneMassBodyPct,
        bone_mass_body_z_score: kerrCalc.boneMassBodyZScore,
        bone_mass_body_adjustment: kerrCalc.boneMassBodyAdjustment,
        bone_mass_body_adjusted_kg: kerrCalc.boneMassBodyAdjusted,
        bone_mass_kg: kerrCalc.boneMassReadjusted,
        bone_mass_pct: kerrCalc.boneMassReadjustedPct,
        bone_mass_z_score: kerrCalc.boneMassZScore,
        bone_mass_adjusted_kg: kerrCalc.boneMassAdjusted,
        bone_mass_adjustment: kerrCalc.boneMassAdjustment,
        muscle_bone_ratio: kerrCalc.muscleBoneRatio,
        adipose_muscle_ratio: kerrCalc.adiposeMuscleRatio,
        ballast_index: kerrCalc.ballastIndex,
        bmi: kerrCalc.bmi,
        surface_area_m2: kerrCalc.surfaceArea,
        somatotype_endomorphy: kerrCalc.somatotype.endomorphy,
        somatotype_mesomorphy: kerrCalc.somatotype.mesomorphy,
        somatotype_ectomorphy: kerrCalc.somatotype.ectomorphy,
        structured_weight_kg: kerrCalc.structuredWeight,
        structured_weight_diff_kg: kerrCalc.structuredWeightDiff,
        structured_weight_diff_pct: kerrCalc.structuredWeightDiffPct,
        technician_error_pct: kerrCalc.technicianErrorPct,
      };
      setCurrentResults(newResults);
      setSelectedMeasurement(measurement);
      setViewMode('results');
      setToast({ message: 'Results recalculated successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recalculation failed';
      setToast({ message: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToAthleteProfile = async () => {
    if (!currentResults || !selectedAthlete || !selectedMeasurement) return;
    setApplyingProfile(true);
    try {
      const [{ error: profileError }, { error: athleteError }] = await Promise.all([
        supabase
          .from('athlete_anthropometry_profiles')
          .upsert({
            athlete_id: selectedAthlete.id,
            measurement_id: selectedMeasurement.id,
            body_fat_percent: currentResults.adipose_mass_pct,
            muscle_mass_kg: currentResults.muscle_mass_kg,
            bone_mass_kg: currentResults.bone_mass_kg,
            adipose_mass_kg: currentResults.adipose_mass_kg,
            skin_mass_kg: currentResults.skin_mass_kg,
            residual_mass_kg: currentResults.residual_mass_kg,
            somatotype_endomorphy: currentResults.somatotype_endomorphy,
            somatotype_mesomorphy: currentResults.somatotype_mesomorphy,
            somatotype_ectomorphy: currentResults.somatotype_ectomorphy,
            bmi: currentResults.bmi,
            weight_kg: selectedMeasurement.body_mass_kg,
            height_cm: selectedMeasurement.stature_cm,
            applied_at: new Date().toISOString(),
            applied_by: profile?.id,
          }, { onConflict: 'athlete_id' }),
        supabase
          .from('athletes')
          .update({
            body_fat_percent: currentResults.adipose_mass_pct,
            weight_kg: selectedMeasurement.body_mass_kg,
            height_cm: selectedMeasurement.stature_cm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedAthlete.id),
      ]);

      if (profileError) throw profileError;
      if (athleteError) throw athleteError;

      setToast({ message: `Anthropometry applied to ${selectedAthlete.name}'s profile successfully!`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to apply to athlete profile';
      setToast({ message: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setApplyingProfile(false);
    }
  };

  const handleEditSave = async (updated: AnthropometryMeasurement) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('anthropometry_measurements')
        .update(updated)
        .eq('id', updated.id);

      if (error) throw error;

      await loadMeasurements();
      setEditingMeasurement(null);
      setToast({ message: 'Measurement updated. Use Recalculate to refresh results.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      setToast({ message: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMeasurement = async () => {
    if (!deletingMeasurement) return;
    setDeleting(true);
    try {
      await supabase
        .from('anthropometry_kerr_results')
        .delete()
        .eq('measurement_id', deletingMeasurement.id);

      const { error } = await supabase
        .from('anthropometry_measurements')
        .delete()
        .eq('id', deletingMeasurement.id);

      if (error) throw error;

      setDeletingMeasurement(null);
      if (selectedMeasurement?.id === deletingMeasurement.id) {
        setSelectedMeasurement(null);
        setCurrentResults(null);
        setViewMode('history');
      }
      await loadMeasurements();
      setToast({ message: 'Measurement deleted.', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete measurement';
      setToast({ message: msg, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeleting(false);
    }
  };

  if (!isAthlete && showAthleteSelector) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => setShowAthleteSelector(false)}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition font-medium"
          >
            Back
          </button>
        </div>
        <AthleteSelector
          onSelectAthlete={(athlete) => {
            setSelectedAthlete(athlete);
            setShowAthleteSelector(false);
          }}
          onCreateNew={() => {
            setShowAthleteSelector(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ISAK Anthropometry</h1>
          {selectedAthlete && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Athlete: <span className="font-semibold">{selectedAthlete.name}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isAthlete && selectedAthlete && (
            <button
              onClick={() => setShowAthleteSelector(true)}
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              Change Athlete
            </button>
          )}
          {!isAthlete && currentResults && selectedAthlete && (
            <button
              onClick={handleApplyToAthleteProfile}
              disabled={applyingProfile}
              className="flex items-center btn btn-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {applyingProfile ? 'Applying...' : 'Apply to Athlete Profile'}
            </button>
          )}
          <button
            onClick={() => setViewMode('new')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === 'new'
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
            }`}
          >
            <Plus className="w-4 h-4 mr-2" />
            New
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === 'history'
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            History
          </button>
          <button
            onClick={() => setViewMode('results')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === 'results'
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Results
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === 'comparison'
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
            }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Compare
          </button>
          {currentResults && selectedAthlete && onNavigateToReports && (
            <button
              onClick={() => onNavigateToReports(selectedAthlete)}
              className="flex items-center btn btn-primary px-4 py-2 text-sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              Report
            </button>
          )}
        </div>
      </div>

      {viewMode === 'new' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Birth Date
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="input"
                />
                {birthDate && (
                  <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    Age: {calculateAge(birthDate)} years
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Sex
                </label>
                <select
                  value={measurements.sex ?? ''}
                  onChange={(e) => setMeasurements({ ...measurements, sex: (e.target.value || undefined) as 'male' | 'female' | undefined })}
                  className="input"
                >
                  <option value="">Select sex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </div>

          <StepByStepMeasurementInput
            data={measurements}
            onChange={setMeasurements}
            onSave={handleSaveMeasurement}
          />
        </div>
      )}

      {viewMode === 'history' && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Measurement History</h2>
          <div className="space-y-4">
            {savedMeasurements.map((measurement) => (
              <div
                key={measurement.id}
                className="card-content"
              >
                <div className="flex justify-between items-center">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setSelectedMeasurement(measurement);
                      loadKerrResults(measurement.id);
                      setViewMode('results');
                    }}
                  >
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {new Date(measurement.measurement_date).toLocaleDateString()}
                    </div>
                    <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Body Mass: {measurement.body_mass_kg?.toFixed(1)} kg | Stature: {measurement.stature_cm?.toFixed(1)} cm
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {measurement.measurement_method}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMeasurement(measurement);
                        handleRecalculate(measurement);
                      }}
                      disabled={loading}
                      title="Recalculate this measurement"
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                      style={{ background: 'rgba(253,218,54,0.15)', color: '#514163', border: '1px solid #fdda36' }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Recalculate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMeasurement(measurement);
                      }}
                      title="Edit measurement values"
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingMeasurement(measurement);
                      }}
                      title="Delete this measurement"
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'results' && currentResults && selectedMeasurement && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div />
            <div className="flex gap-2">
              {!isAthlete && selectedAthlete && (
                <button
                  onClick={handleApplyToAthleteProfile}
                  disabled={applyingProfile}
                  className="flex items-center gap-2 btn btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  {applyingProfile ? 'Applying...' : 'Apply to Athlete Profile'}
                </button>
              )}
              <button
                onClick={() => handleRecalculate(selectedMeasurement)}
                disabled={loading}
                className="flex items-center gap-2 btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Recalculate
              </button>
            </div>
          </div>
          <KerrPresentationDashboard
            results={currentResults}
            athleteName={profile?.full_name || undefined}
            stature={selectedMeasurement?.stature_cm ?? undefined}
            sum6Skinfolds={selectedMeasurement ? (() => {
              const m = selectedMeasurement;
              const t = m.triceps_sf_mm_median ?? m.triceps_sf_mm;
              const sub = m.subscapular_sf_mm_median ?? m.subscapular_sf_mm;
              const sup = m.supraspinale_sf_mm_median ?? m.supraspinale_sf_mm;
              const ab = m.abdominal_sf_mm_median ?? m.abdominal_sf_mm;
              const ft = m.front_thigh_sf_mm_median ?? m.front_thigh_sf_mm;
              const mc = m.medial_calf_sf_mm_median ?? m.medial_calf_sf_mm;
              if (t && sub && sup && ab && ft && mc) return t + sub + sup + ab + ft + mc;
              return undefined;
            })() : undefined}
          />
          {currentResults && (
            <AnthropometryComparison
              bodyFatPercent={currentResults.adipose_mass_pct}
              muscleMassPercent={currentResults.muscle_mass_pct}
              sex={(measurements.sex === 'male' || measurements.sex === 'female') ? measurements.sex : ((selectedAthlete as Athlete & { sex?: string })?.sex === 'male' || (selectedAthlete as Athlete & { sex?: string })?.sex === 'female' ? (selectedAthlete as Athlete & { sex?: string }).sex as 'male' | 'female' : 'male')}
            />
          )}
          {selectedMeasurement && (
            <>
              <IndicesAndProportionality measurement={selectedMeasurement} />
              <AnatomicalBodyMap2D
                measurements={selectedMeasurement}
                kerrResults={currentResults}
                sex={(selectedMeasurement as any)?.sex === 'male' || (selectedMeasurement as any)?.sex === 'female'
                  ? (selectedMeasurement as any).sex
                  : ((selectedAthlete as Athlete & { sex?: string })?.sex === 'male' || (selectedAthlete as Athlete & { sex?: string })?.sex === 'female'
                    ? (selectedAthlete as Athlete & { sex?: string }).sex as 'male' | 'female'
                    : 'female')}
              />
            </>
          )}
          {!isAthlete && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">
                Professional Conclusions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Format your notes with bold, italic, underline, and bullet points. These will appear in generated reports.
              </p>
              <div className="mb-4">
                <RichTextEditor
                  value={coachNotes}
                  onChange={setCoachNotes}
                  placeholder="Write your professional conclusions, recommendations, and observations here..."
                  disabled={savingNotes}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveCoachNotes}
                  disabled={savingNotes}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ background: '#fdda36', color: '#514163' }}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'comparison' && selectedMeasurement && (
        <ComparativeAssessment
          currentMeasurement={selectedMeasurement}
          previousMeasurement={savedMeasurements[1] || null}
          currentResults={currentResults}
          previousResults={previousResults}
        />
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#fdda36' }}></div>
            <p className="mt-4" style={{ color: 'var(--text-primary)' }}>Processing measurement...</p>
          </div>
        </div>
      )}

      {editingMeasurement && (
        <EditMeasurementModal
          measurement={editingMeasurement}
          onClose={() => setEditingMeasurement(null)}
          onSave={handleEditSave}
          saving={savingEdit}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingMeasurement}
        title="Delete Measurement"
        message={deletingMeasurement ? `Are you sure you want to delete the measurement from ${new Date(deletingMeasurement.measurement_date).toLocaleDateString()}? This cannot be undone.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        isDanger
        onConfirm={handleDeleteMeasurement}
        onCancel={() => setDeletingMeasurement(null)}
      />
    </div>
  );
}
