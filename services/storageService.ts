

import { HistoricalWorkout, UserProfile, CompletedSet, Exercise, WorkoutSummaryData, ExerciseComparison, ExercisePerformance, PersonalRecords, CustomWorkoutPlan, WeeklySchedule, AiPreferences, AiGeneratedWeeklyPlan, DayOfWeek, CustomExercise, ExerciseProgress, ExerciseDataPoint, ProfileGalleryImage } from './types';
import { processWorkoutCompletion, GamificationResult } from './gamificationService';

const HISTORY_KEY = 'focototal-history';
const PROFILE_KEY = 'focototal-profile';
const PRS_KEY = 'focototal-prs';
const CUSTOM_WORKOUTS_KEY = 'focototal-custom-workouts';
const WEEKLY_SCHEDULE_KEY = 'focototal-weekly-schedule';
const AI_PREFERENCES_KEY = 'focototal-ai-prefs';


// --- Helper Functions ---
const parseReps = (repsString: string): number => {
    if (!repsString) return 0;
    const repsMatch = repsString.match(/\d+/);
    return repsMatch ? parseInt(repsMatch[0], 10) : 0;
};

const calculateExerciseVolume = (exercise: Exercise): number => {
    if (!exercise.completedSets) return 0;
    
    return exercise.completedSets.reduce((setTotal, set) => {
        // MUDANÇA PRINCIPAL: Não depende mais do `set.checked`.
        // O volume é contabilizado se o usuário inserir um peso.
        const weightString = set.weight ? String(set.weight).replace(',', '.') : '0';
        const weight = parseFloat(weightString) || 0;

        // Se nenhum peso for inserido, a série não contribui com volume.
        if (weight === 0) {
            return setTotal;
        }

        let reps = 0;
        // Prioriza as repetições inseridas pelo usuário para a série específica.
        if (set.reps) {
            const parsedSetReps = parseInt(set.reps, 10);
            if (!isNaN(parsedSetReps)) {
                reps = parsedSetReps;
            }
        }

        // Se nenhuma repetição válida for inserida na série, usa as do plano como fallback.
        if (reps === 0) {
            reps = parseReps(exercise.reps);
        }

        return setTotal + (weight * reps);
    }, 0);
};

// Helper function to get max weight from a completed exercise
const calculateMaxWeight = (exercise: Exercise): number => {
    if (!exercise.completedSets || exercise.completedSets.length === 0) return 0;
    
    return Math.max(0, ...exercise.completedSets.map(s => {
        const weightString = s.weight ? String(s.weight).replace(',', '.') : '0';
        return parseFloat(weightString) || 0;
    }));
};


// --- AI Preferences ---
export const getAiPreferences = (): AiPreferences => {
    const defaultPrefs: AiPreferences = {
        level: null,
        location: null,
        equipment: [],
        duration: null,
        focus: null,
    };
    try {
        const prefsJson = localStorage.getItem(AI_PREFERENCES_KEY);
        return prefsJson ? { ...defaultPrefs, ...JSON.parse(prefsJson) } : defaultPrefs;
    } catch (error) {
        console.error("Failed to parse AI preferences:", error);
        return defaultPrefs;
    }
}

export const saveAiPreferences = (prefs: AiPreferences): void => {
    localStorage.setItem(AI_PREFERENCES_KEY, JSON.stringify(prefs));
}

// --- Custom Workouts & Schedule ---

export const getCustomWorkouts = (): CustomWorkoutPlan[] => {
    try {
        const workoutsJson = localStorage.getItem(CUSTOM_WORKOUTS_KEY);
        return workoutsJson ? JSON.parse(workoutsJson) : [];
    } catch (error) {
        console.error("Failed to parse custom workouts:", error);
        return [];
    }
}

export const saveCustomWorkouts = (workouts: CustomWorkoutPlan[]): void => {
    localStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(workouts));
}

export const getWeeklySchedule = (): WeeklySchedule => {
    try {
        const scheduleJson = localStorage.getItem(WEEKLY_SCHEDULE_KEY);
        return scheduleJson ? JSON.parse(scheduleJson) : {};
    } catch (error) {
        console.error("Failed to parse weekly schedule:", error);
        return {};
    }
}

export const saveWeeklySchedule = (schedule: WeeklySchedule): void => {
    localStorage.setItem(WEEKLY_SCHEDULE_KEY, JSON.stringify(schedule));
}

export const saveGeneratedWeeklyPlan = (data: AiGeneratedWeeklyPlan): void => {
    // Note: This will overwrite existing custom plans and schedule.
    // A more robust implementation might merge them.
    const planNameToIdMap = new Map<string, string>();

    const newPlans: CustomWorkoutPlan[] = data.plans.map(plan => {
        const newId = crypto.randomUUID();
        planNameToIdMap.set(plan.name, newId);
        return {
            ...plan,
            id: newId,
            exercises: plan.exercises.map(ex => ({ ...ex, id: crypto.randomUUID() }))
        };
    });

    const newSchedule: WeeklySchedule = {};
    for (const day in data.schedule) {
        const dayKey = day as DayOfWeek;
        const planName = data.schedule[dayKey];
        if (planName && planNameToIdMap.has(planName)) {
            newSchedule[dayKey] = planNameToIdMap.get(planName);
        }
    }
    
    // For simplicity, we are replacing all custom workouts and the schedule.
    // A future improvement could be to merge with existing ones.
    saveCustomWorkouts(newPlans);
    saveWeeklySchedule(newSchedule);
};


// --- Personal Records ---

export const getPersonalRecords = (): PersonalRecords => {
    try {
        const prsJson = localStorage.getItem(PRS_KEY);
        return prsJson ? JSON.parse(prsJson) : {};
    } catch (error) {
        console.error("Failed to parse personal records:", error);
        return {};
    }
}

export const savePersonalRecords = (prs: PersonalRecords): void => {
    localStorage.setItem(PRS_KEY, JSON.stringify(prs));
}

// --- Workout History ---

export const getWorkoutHistory = (): HistoricalWorkout[] => {
  try {
    const historyJson = localStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("Failed to parse workout history:", error);
    return [];
  }
};

export const addWorkoutToHistory = (workout: HistoricalWorkout): { summary: WorkoutSummaryData, gamificationResult: GamificationResult } => {
  const history = getWorkoutHistory();
  history.unshift(workout); // Add new workout to the beginning
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  const summary = generateWorkoutSummary(workout, history);
  
  // Process gamification after workout is saved
  const prs = getPersonalRecords();
  const profile = getUserProfile();
  const newStats = calculateUserStats(history);
  const gamificationResult = processWorkoutCompletion(workout, summary, profile, history, prs, newStats);

  // Save updated profile and PRs
  saveUserProfile(gamificationResult.updatedProfile);
  savePersonalRecords(gamificationResult.newPRs);

  return { summary, gamificationResult };
};

export const findLastPerformanceForExercise = (exerciseName: string, history: HistoricalWorkout[]): { sets: CompletedSet[] } | null => {
    // Skip the most recent workout (the one just completed)
    for (let i = 0; i < history.length; i++) {
        const workout = history[i];
        const foundExercise = workout.exercises.find(ex => ex.name === exerciseName);
        if (foundExercise && foundExercise.completedSets && foundExercise.completedSets.length > 0) {
            return { sets: foundExercise.completedSets };
        }
    }
    return null;
};

// --- User Profile ---

export const getUserProfile = (): UserProfile => {
  const defaultProfile: UserProfile = {
    name: "Atleta FocoTotal",
    avatar: "🤖",
    instagram: "",
    gallery: [],
    level: 1,
    xp: 0,
    xpToNextLevel: 200,
    stats: {
      totalWorkouts: 0,
      currentStreak: 0,
      totalVolume: 0,
      timeSpent: 0,
    },
  };
  try {
    const profileJson = localStorage.getItem(PROFILE_KEY);
    if (!profileJson) return defaultProfile;

    const parsedProfile = JSON.parse(profileJson);
    // Ensure new fields exist to prevent app crashes for users with old data
    return {
      ...defaultProfile,
      ...parsedProfile,
      instagram: parsedProfile.instagram || '',
      gallery: parsedProfile.gallery || [],
    };

  } catch (error) {
    console.error("Failed to parse user profile:", error);
    return defaultProfile;
  }
};

export const saveUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};


// --- Stats and Summary Calculation ---

export const calculateUserStats = (history: HistoricalWorkout[]): UserProfile['stats'] => {
  if (history.length === 0) {
    return { totalWorkouts: 0, currentStreak: 0, totalVolume: 0, timeSpent: 0 };
  }

  const totalWorkouts = history.length;
  const timeSpent = history.reduce((acc, workout) => acc + workout.duration, 0);

  const totalVolume = history.reduce((total, workout) => {
    const workoutVolume = workout.exercises.reduce((exTotal, ex) => exTotal + calculateExerciseVolume(ex), 0);
    return total + workoutVolume;
  }, 0);

  // Current Streak Calculation
  const sortedDates = history.map(w => new Date(w.completedAt).setHours(0,0,0,0)).sort((a, b) => b - a);
  const uniqueDates = [...new Set(sortedDates)];
  let currentStreak = 0;
  if (uniqueDates.length > 0) {
      const today = new Date().setHours(0,0,0,0);
      const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          currentStreak = 1;
          for (let i = 1; i < uniqueDates.length; i++) {
              const day = uniqueDates[i-1];
              const prevDay = uniqueDates[i];
              const diffDays = (day - prevDay) / (1000 * 3600 * 24);
              if (diffDays === 1) {
                  currentStreak++;
              } else {
                  break;
              }
          }
      }
  }

  return {
    totalWorkouts,
    currentStreak,
    totalVolume: Math.round(totalVolume),
    timeSpent
  };
};

export const generateWorkoutSummary = (completedWorkout: HistoricalWorkout, allHistory: HistoricalWorkout[]): WorkoutSummaryData => {
    const summary: WorkoutSummaryData = {
        title: completedWorkout.title,
        duration: completedWorkout.duration,
        totalVolume: 0,
        exercises: []
    };

    let totalWorkoutVolume = 0;
    const historyForComparison = allHistory.slice(1);

    for (const exercise of completedWorkout.exercises) {
        const currentVolume = calculateExerciseVolume(exercise);
        const currentMaxWeight = Math.max(0, ...(exercise.completedSets?.map(s => {
            const weightString = s.weight ? s.weight.replace(',', '.') : '0';
            return parseFloat(weightString) || 0;
        }) || []));
        const currentPerformance: ExercisePerformance = { maxWeight: currentMaxWeight, totalVolume: currentVolume };
        totalWorkoutVolume += currentVolume;
        
        const lastPerformanceData = findLastPerformanceForExercise(exercise.name, historyForComparison);
        let lastPerformance: ExercisePerformance | null = null;
        if (lastPerformanceData) {
             const lastMaxWeight = Math.max(0, ...lastPerformanceData.sets.map(s => {
                const weightString = s.weight ? s.weight.replace(',', '.') : '0';
                return parseFloat(weightString) || 0;
            }));
            lastPerformance = { maxWeight: lastMaxWeight, totalVolume: 0 }; // last volume not needed for summary
        }
        
        const isNewPR = (lastPerformance === null && currentPerformance.maxWeight > 0) || (lastPerformance !== null && currentPerformance.maxWeight > lastPerformance.maxWeight);

        summary.exercises.push({
            name: exercise.name,
            current: currentPerformance,
            last: lastPerformance,
            isNewPR: isNewPR
        });
    }

    summary.totalVolume = Math.round(totalWorkoutVolume);
    return summary;
};

export const calculateAllExercisesProgress = (history: HistoricalWorkout[]): ExerciseProgress[] => {
    const progressMap = new Map<string, ExerciseDataPoint[]>();

    // Iterate from oldest to newest to build the timeline correctly
    const sortedHistory = [...history].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    sortedHistory.forEach(workout => {
        workout.exercises.forEach(exercise => {
            const maxWeight = calculateMaxWeight(exercise);
            
            // We now track every exercise from a completed workout, even if weight is 0.
            // This ensures a starting point is always recorded.
            if (!progressMap.has(exercise.name)) {
                progressMap.set(exercise.name, []);
            }
            const dataPoints = progressMap.get(exercise.name)!;
            dataPoints.push({
                date: workout.completedAt,
                maxWeight,
            });
        });
    });

    const allProgress: ExerciseProgress[] = [];

    progressMap.forEach((data, name) => {
        // We want to show exercises even if they've only been done once.
        if (data.length >= 1) {
            const initialWeight = data[0].maxWeight;
            const currentWeight = data[data.length - 1].maxWeight;
            const evolution = currentWeight - initialWeight;

            allProgress.push({
                name,
                data,
                initialWeight,
                currentWeight,
                evolution,
                workoutCount: data.length,
            });
        }
    });

    // Sort by evolution, descending
    allProgress.sort((a, b) => b.evolution - a.evolution);

    return allProgress;
};