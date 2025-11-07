import { GoogleGenAI, Type } from '@google/genai';
import { Step } from './types';

interface ProcessingProgress {
  stage: 'extracting' | 'analyzing' | 'summarizing';
  message: string;
}

// Helper to convert a blob to a base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to read blob as base64 string.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const extractFramesFromVideo = async (videoBlob: Blob, setProgress: (progress: ProcessingProgress) => void): Promise<{ data: string, timestamp: number }[]> => {
    setProgress({ stage: 'extracting', message: "Inicializando análisis de video..."});
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        video.src = URL.createObjectURL(videoBlob);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const frames: { data: string, timestamp: number }[] = [];
        let time = 0;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;

            if (!context) {
                return reject(new Error("No se pudo obtener el contexto del canvas."));
            }
            
            video.onseeked = async () => {
                setProgress({ stage: 'extracting', message: `Analizando video: segundo ${time.toFixed(0)} de ${duration.toFixed(0)}...`});

                // Dibuja el fotograma actual en el canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob | null>(resolveBlob => canvas.toBlob(resolveBlob, 'image/jpeg', 0.8));

                if (blob) {
                    const base64Data = await blobToBase64(blob);
                    frames.push({ data: base64Data, timestamp: time });
                }
                
                time++;

                if (time <= duration) {
                    video.currentTime = time;
                } else {
                    resolve(frames);
                }
            };
            
            // Inicia el proceso buscando el primer fotograma (tiempo 0).
            video.currentTime = 0;
        };

        video.onerror = (e) => reject(new Error("Error al cargar el video para la extracción de fotogramas."));
        video.onstalled = (e) => reject(new Error("Se detuvo la carga del video. Revisa tu conexión o el archivo de video."));
    });
};


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const analyzeVideo = async (videoBlob: Blob, setProgress: (progress: ProcessingProgress) => void): Promise<Step[]> => {
  const frames = await extractFramesFromVideo(videoBlob, setProgress); 

  if (frames.length === 0) {
    throw new Error("No se pudieron extraer fotogramas del video. Intenta grabar un proceso con más acciones en pantalla.");
  }
  
  setProgress({ stage: 'analyzing', message: `Se extrajeron ${frames.length} fotogramas. Analizando con IA... Esto puede tardar un momento.`});

  const prompt = `Eres un experto asistente de documentación de procesos. Se te proporcionará una serie de fotogramas, uno por cada segundo de una grabación de pantalla. Tu tarea es analizar estos fotogramas y crear una lista paso a paso de las acciones del usuario, en español.

Instrucciones:
- Analiza la secuencia de fotogramas para entender el flujo de trabajo completo.
- Describe cada acción con el mayor detalle posible. Por ejemplo, en lugar de 'Hizo clic en un botón', di 'Hizo clic en el botón "Guardar" en la esquina superior derecha del formulario'. Si el usuario escribe, indica qué escribió, por ejemplo: 'Escribió "/tabla" para abrir el menú de inserción de tablas'.
- Para cada paso, proporciona la marca de tiempo ('timestamp') en segundos del fotograma que mejor ilustra la acción. Asegúrate de que esta marca de tiempo coincida exactamente con uno de los fotogramas proporcionados.
- Ignora los simples movimientos del ratón si no resultan en una acción.
- El resultado debe ser un objeto JSON que siga estrictamente el esquema proporcionado, con la descripción en español.`;
  
  const imageParts = frames.map(frame => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: frame.data
    },
  }));

  const schema = {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        description: "Una lista de los pasos que siguió el usuario.",
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: {
              type: Type.NUMBER,
              description: "La marca de tiempo en segundos cuando ocurrió la acción."
            },
            description: {
              type: Type.STRING,
              description: "Una descripción clara de la acción del usuario en español."
            }
          },
          required: ["timestamp", "description"]
        }
      }
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: { 
        parts: [{ text: prompt }, ...imageParts] 
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  
  setProgress({ stage: 'analyzing', message: "Finalizando tu guía de proceso..."});
  const text = response.text;
  try {
    const result = JSON.parse(text);
    const analyzedSteps = result.steps as { timestamp: number, description: string }[];
    
    const frameMap = new Map<number, string>();
    frames.forEach(frame => {
        frameMap.set(Math.round(frame.timestamp), frame.data);
    });

    const stepsWithScreenshots: Step[] = analyzedSteps.map(step => {
        const screenshotData = frameMap.get(Math.round(step.timestamp));
        return {
            ...step,
            screenshot: screenshotData,
        };
    });

    return stepsWithScreenshots;

  } catch(e) {
    console.error("Fallo al analizar la respuesta de Gemini:", text);
    throw new Error("La IA devolvió un formato de análisis no válido. Por favor, inténtalo de nuevo.");
  }
};

export const generateSummary = async (steps: Step[]): Promise<string> => {
    if (steps.length === 0) {
      return "No se proporcionaron pasos para generar un resumen.";
    }
  
    const stepsText = steps.map((step, index) => `${index + 1}. ${step.description}`).join('\n');
    const prompt = `Basado en la siguiente lista de pasos de un proceso, genera un resumen conciso y de alto nivel en español. El resumen debe capturar el objetivo general y los principales logros del flujo de trabajo. El resultado debe ser un párrafo corto.
  
Pasos:
${stepsText}
  
Resumen:`;
  
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
  
    return response.text;
  };


export const generateSpeech = async (text: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lee este paso del proceso: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if(!base64Audio) {
        throw new Error("No se pudo generar el audio.");
      }
      return base64Audio;
};