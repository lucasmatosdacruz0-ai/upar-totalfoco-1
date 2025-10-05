
import { GoogleGenAI, Type } from "@google/genai";
import { GenerateWorkoutParams, GenerateWeeklyWorkoutParams, GetAutoSwapExerciseParams, GetSimilarExercisesParams, WorkoutPlan, Exercise, AiGeneratedWeeklyPlan, DayOfWeek } from '../types';
import { EXERCISE_NAMES } from './videoMapping';

// The API key is polyfilled in index.html for static deployments.
// We initialize with an empty string if the key is not available,
// and the ensureApiKey function will throw a user-friendly error before any API call.
const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' && process.env.API_KEY) || "" });

const ensureApiKey = () => {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    if (!apiKey || apiKey.startsWith('%%')) {
        throw new Error("A chave de API não foi configurada. Por favor, configure a variável de ambiente API_KEY nas configurações de deploy para usar as funcionalidades de IA.");
    }
};


const singleExerciseSchema = {
    type: Type.OBJECT,
    properties: {
        name: { 
            type: Type.STRING, 
            description: "Nome do exercício em português (Brasil)." 
        },
        sets: { 
            type: Type.STRING, 
            description: "Número de séries (ex: '3' ou '4')." 
        },
        reps: { 
            type: Type.STRING, 
            description: "Faixa de repetições ou tempo (ex: '8-12', '15', '45s')." 
        },
        description: { 
            type: Type.STRING, 
            description: "Uma breve descrição da execução correta e uma dica de postura. Em português."
        },
    },
    required: ['name', 'sets', 'reps', 'description'],
};

const customExerciseSchema = {
    type: Type.OBJECT,
    properties: {
        name: { 
            type: Type.STRING, 
            description: "Nome do exercício em português (Brasil)."
        },
        sets: { 
            type: Type.STRING, 
            description: "Número de séries (ex: '3' ou '4')."
        },
        reps: { 
            type: Type.STRING, 
            description: "Faixa de repetições ou tempo (ex: '8-12', '15', '45s')."
        },
    },
    required: ['name', 'sets', 'reps'],
};

const workoutSchema = {
    type: Type.OBJECT,
    properties: {
        title: { 
            type: Type.STRING, 
            description: "Um título criativo e motivador para o treino em português." 
        },
        duration: { 
            type: Type.INTEGER, 
            description: "A duração total do treino em minutos, conforme solicitado." 
        },
        focus: {
            type: Type.STRING,
            description: "O foco principal do treino (ex: Força, Hipertrofia, Resistência, Corpo Inteiro)."
        },
        exercises: {
            type: Type.ARRAY,
            description: "Uma lista de exercícios para o treino.",
            items: singleExerciseSchema
        },
    },
    required: ['title', 'duration', 'focus', 'exercises'],
};

const similarExercisesSchema = {
    type: Type.OBJECT,
    properties: {
        alternatives: {
            type: Type.ARRAY,
            description: "Uma lista de 2 a 3 exercícios alternativos.",
            items: singleExerciseSchema
        }
    },
    required: ['alternatives']
};

const weeklyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        plans: {
            type: Type.ARRAY,
            description: "Uma lista de planos de treino únicos para a semana. Inclua planos de 'Descanso'.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { 
                        type: Type.STRING,
                        description: "Nome do plano de treino (ex: 'Peito e Tríceps', 'Pernas', 'Descanso')."
                    },
                    exercises: {
                        type: Type.ARRAY,
                        description: "Lista de exercícios para este plano. Vazio para dias de descanso.",
                        items: customExerciseSchema
                    }
                },
                required: ['name', 'exercises']
            }
        },
        schedule: {
            type: Type.OBJECT,
            description: "A agenda para os 7 dias da semana, associando cada dia ao NOME de um plano da lista acima.",
            properties: {
                monday: { type: Type.STRING, description: "Nome do plano para Segunda-feira." },
                tuesday: { type: Type.STRING, description: "Nome do plano para Terça-feira." },
                wednesday: { type: Type.STRING, description: "Nome do plano para Quarta-feira." },
                thursday: { type: Type.STRING, description: "Nome do plano para Quinta-feira." },
                friday: { type: Type.STRING, description: "Nome do plano para Sexta-feira." },
                saturday: { type: Type.STRING, description: "Nome do plano para Sábado." },
                sunday: { type: Type.STRING, description: "Nome do plano para Domingo." }
            },
            required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
    },
    required: ['plans', 'schedule']
};


export const generateWorkoutPlan = async (params: GenerateWorkoutParams): Promise<Omit<WorkoutPlan, 'exercises'> & { exercises: Omit<Exercise, 'id'>[] }> => {
  ensureApiKey();
  const { level, location, equipment, duration, focus } = params;

  const equipmentList = equipment.length > 0 ? equipment.join(', ') : 'Nenhum equipamento específico, usar peso corporal ou itens comuns.';
  const validExerciseNames = EXERCISE_NAMES.join('", "');

  const prompt = `
    Você é um personal trainer de elite especializado na realidade brasileira, criando treinos para a plataforma FocoTotal Fitness.
    Sua tarefa é gerar um plano de treino completo para uma única sessão, baseado nas especificações do usuário.

    Especificações do Usuário:
    - Nível de Experiência: ${level}
    - Local de Treino: ${location}
    - Equipamentos Disponíveis: ${equipmentList}
    - Duração Desejada: ${duration} minutos
    - Foco do Treino: ${focus}

    Instruções CRÍTICAS:
    1. O nome de cada exercício no campo "name" DEVE ser escolhido EXATAMENTE desta lista de nomes válidos: ["${validExerciseNames}"]. Não invente novos nomes, abreviações ou variações. Esta é a regra mais importante.
    2. Crie um treino coeso e eficaz que se ajuste à duração e ao FOCO solicitados. Se o foco for 'Corpo Inteiro', inclua exercícios para o corpo todo. Se for 'Superiores', foque em peito, costas, ombros e braços. Se for 'Pernas e Glúteos', foque em pernas e glúteos. Se for uma combinação específica (ex: 'Peito e Tríceps'), priorize esses músculos.
    3. Inclua uma mistura de exercícios que façam sentido para o objetivo e equipamentos.
    4. Forneça um título criativo e motivador para o treino.
    
    Responda APENAS com o objeto JSON que segue estritamente o schema fornecido. Não inclua texto introdutório, explicações ou markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: workoutSchema,
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const workoutData = JSON.parse(jsonText);
    return workoutData;

  } catch (error) {
    console.error("Error generating workout plan from Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the workout plan.");
  }
};

export const generateWeeklyWorkoutPlan = async (params: GenerateWeeklyWorkoutParams): Promise<AiGeneratedWeeklyPlan> => {
    ensureApiKey();
    const { level } = params;
    const validExerciseNames = EXERCISE_NAMES.join('", "');

    const prompt = `
        Você é um personal trainer de elite especializado na realidade brasileira, planejando uma semana de treinos para um usuário do app FocoTotal Fitness.

        Especificações do Usuário:
        - Nível de Experiência: ${level}

        Tarefa:
        Crie um plano de treino SEMANAL completo e balanceado.

        Instruções CRÍTICAS:
        1.  **Estrutura Semanal:** O plano deve cobrir 7 dias (segunda a domingo). Inclua de 2 a 3 dias de 'Descanso'.
        2.  **Variedade:** Distribua diferentes grupos musculares ao longo da semana para permitir a recuperação adequada (ex: Peito/Tríceps, Costas/Bíceps, Pernas, Ombros, Corpo Inteiro). Evite treinar o mesmo grupo muscular em dias consecutivos.
        3.  **Planos de Treino:** Crie uma lista de planos de treino (ex: um plano chamado 'Foco em Peito', outro 'Foco em Pernas', etc.). Um plano pode ser usado em mais de um dia se fizer sentido. Inclua um plano chamado 'Descanso' com uma lista de exercícios vazia.
        4.  **Agenda:** Preencha a agenda semanal ('schedule') associando cada dia da semana (monday, tuesday, etc.) ao NOME de um dos planos que você criou.
        5.  **Exercícios:** O nome de cada exercício ('name') DEVE ser escolhido EXATAMENTE da lista de nomes válidos: ["${validExerciseNames}"]. Esta é a regra mais importante. Não invente nomes.
        6.  **Séries e Reps:** Defina séries e repetições apropriadas para o nível de experiência do usuário.

        Responda APENAS com o objeto JSON que segue estritamente o schema fornecido. Não inclua texto introdutório, explicações ou markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: weeklyPlanSchema,
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating weekly plan from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the weekly plan.");
    }
};

export const getAutoSwapExercise = async (params: GetAutoSwapExerciseParams): Promise<Omit<Exercise, 'id'>> => {
    ensureApiKey();
    const { level, location, equipment, currentPlan, exerciseToReplace } = params;

    const equipmentList = equipment.length > 0 ? equipment.join(', ') : 'Nenhum equipamento específico, usar peso corporal ou itens comuns.';
    const existingExercises = currentPlan.exercises.map(e => e.name).join(', ');
    const validExerciseNames = EXERCISE_NAMES.join('", "');

    const prompt = `
        Você é um assistente de personal trainer para o app FocoTotal Fitness.
        O usuário está executando um treino e quer substituir UM exercício por outro.

        Contexto do Treino:
        - Nível de Experiência: ${level}
        - Local de Treino: ${location}
        - Equipamentos Disponíveis: ${equipmentList}
        - Foco do Treino Atual: ${currentPlan.focus}
        - Exercícios já no plano: ${existingExercises}
    
        Tarefa: Substitua o exercício "${exerciseToReplace.name}" por outra opção.

        Instruções CRÍTICAS:
        - O nome do novo exercício DEVE ser escolhido EXATAMENTE da seguinte lista de nomes válidos: ["${validExerciseNames}"].
        - O novo exercício deve se encaixar bem no foco geral do treino: "${currentPlan.focus}".
        - A alternativa NÃO PODE SER um dos exercícios já existentes no plano.
        - Use apenas os equipamentos disponíveis e mantenha séries/repetições adequadas.

      Responda APENAS com o objeto JSON do novo exercício, seguindo o schema fornecido.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: singleExerciseSchema,
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error getting auto-swap exercise from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while getting a replacement exercise.");
    }
};

export const getSimilarExerciseChoices = async (params: GetSimilarExercisesParams): Promise<Omit<Exercise, 'id'>[]> => {
    ensureApiKey();
    const { level, location, equipment, currentPlan, exerciseToReplace } = params;

    const equipmentList = equipment.length > 0 ? equipment.join(', ') : 'Nenhum equipamento específico, usar peso corporal ou itens comuns.';
    const existingExercises = currentPlan.exercises.map(e => e.name).join(', ');
    const validExerciseNames = EXERCISE_NAMES.join('", "');

    const prompt = `
        Você é um assistente de personal trainer para o app FocoTotal Fitness.
        O usuário quer ver alternativas para um exercício específico.

        Contexto do Treino:
        - Nível de Experiência: ${level}
        - Local de Treino: ${location}
        - Equipamentos Disponíveis: ${equipmentList}
        - Foco do Treino Atual: ${currentPlan.focus}
        - Exercícios já no plano: ${existingExercises}

        Tarefa: Forneça uma lista com 2 ou 3 alternativas DIRETAS para o exercício: "${exerciseToReplace.name}".

        Instruções CRÍTICAS:
        - O nome de CADA alternativa DEVE ser escolhido EXATAMENTE da seguinte lista de nomes válidos: ["${validExerciseNames}"].
        - As alternativas DEVEM focar exatamente no mesmo grupo muscular primário.
        - As alternativas NÃO PODEM SER um dos exercícios já existentes no plano.
        - Use apenas os equipamentos disponíveis e mantenha séries/repetições adequadas.

        Responda APENAS com o objeto JSON que segue estritamente o schema fornecido, contendo a lista de alternativas.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: similarExercisesSchema,
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.alternatives || [];

    } catch (error) {
        console.error("Error getting similar exercise choices from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while getting similar exercises.");
    }
};