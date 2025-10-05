

import React, { useState, useMemo } from 'react';
import { getWorkoutHistory, calculateAllExercisesProgress } from '../services/storageService';
import { HistoricalWorkout, ExerciseProgress, Exercise } from '../types';
import ExerciseProgressCard from '../components/ExerciseProgressCard';
import { LineChartIcon } from '../components/icons';
import ExerciseDetailModal from '../components/ExerciseDetailModal';

const HistoryPage: React.FC = () => {
  const [history] = useState<HistoricalWorkout[]>(getWorkoutHistory());
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const exerciseProgress: ExerciseProgress[] = useMemo(() => {
    return calculateAllExercisesProgress(history);
  }, [history]);
  
  const handleExerciseClick = (exerciseName: string) => {
      // Find a representative exercise object to pass to the modal
      for (const workout of [...history].reverse()) {
          const ex = workout.exercises.find(e => e.name === exerciseName);
          if (ex) {
              setSelectedExercise(ex);
              return;
          }
      }
  };

  if (history.length === 0) {
    return (
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Seu histórico está vazio</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Complete seu primeiro treino para começar a acompanhar seu progresso!</p>
      </div>
    );
  }

  if (exerciseProgress.length === 0) {
    return (
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl animate-fade-in">
         <LineChartIcon className="w-16 h-16 mx-auto text-blue-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Ainda não há progresso para mostrar</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Registre os pesos durante seus treinos para que seu progresso de força apareça aqui.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
        {selectedExercise && <ExerciseDetailModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
        <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Progresso por Exercício</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Sua evolução, ordenada dos exercícios que você mais progrediu para os que menos progrediu.</p>
        </div>

        <div className="space-y-4">
            {exerciseProgress.map(progress => (
                <ExerciseProgressCard key={progress.name} progress={progress} onExerciseNameClick={handleExerciseClick} />
            ))}
        </div>
    </div>
  );
};

export default HistoryPage;