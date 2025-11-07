import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useScreenRecorder } from './hooks/useScreenRecorder';
import { analyzeVideo, generateSpeech, generateSummary } from './services/geminiService';
import { AppState, Step } from './types';

// Helper Icons defined outside the main component to prevent re-creation on re-renders
const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
);

const RecordingIcon = () => (
    <svg className="h-6 w-6 mr-2 text-red-500 animate-pulse" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" />
    </svg>
);

const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
);

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586l-1-1.414A2 2 0 0011.586 3H8.414A2 2 0 007.586 3.586L6.586 5H4zm6 10a5 5 0 100-10 5 5 0 000 10z" clipRule="evenodd" />
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const ClipboardCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);


const Header = () => (
    <header className="bg-gray-900 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold text-center">Process Doc AI</h1>
        <p className="text-center text-gray-400 mt-1">Record your workflow, get an instant step-by-step guide.</p>
    </header>
);

const Loader: React.FC<{ progress: { stage: string; message: string } }> = ({ progress }) => {
    const stages = [
        { key: 'extracting', text: 'Extrayendo Fotogramas del Video' },
        { key: 'analyzing', text: 'Analizando Acciones con IA' },
        { key: 'summarizing', text: 'Generando Resumen del Proceso' },
    ];
    const currentStageIndex = stages.findIndex(s => s.key === progress.stage);

    return (
        <div className="flex flex-col items-center justify-center text-white h-full p-4">
            <div className="w-full max-w-md">
                <ul className="space-y-4 mb-6">
                    {stages.map((stage, index) => {
                        const isCompleted = index < currentStageIndex;
                        const isActive = index === currentStageIndex;
                        return (
                            <li key={stage.key} className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    {isCompleted ? (
                                        <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    ) : isActive ? (
                                        <svg className="h-6 w-6 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /></svg>
                                    )}
                                </div>
                                <span className={`text-lg ${isActive ? 'text-blue-400' : isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>{stage.text}</span>
                            </li>
                        );
                    })}
                </ul>
                <p className="mt-4 text-lg text-center h-8">{progress.message}</p>
            </div>
        </div>
    );
};

// TTS audio decoding helpers
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};
async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / 1;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}


export default function App() {
    const [appState, setAppState] = useState<AppState>('idle');
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [summary, setSummary] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState({ stage: '', message: '' });
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const stepsListRef = useRef<HTMLUListElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);


    const handleRecordingStop = useCallback(async (blob: Blob) => {
        setVideoBlob(blob);
        setAppState('processing');
        try {
            const analysisResults = await analyzeVideo(blob, setProcessingProgress);
            setSteps(analysisResults);

            setProcessingProgress({ stage: 'summarizing', message: 'Generando un resumen del proceso...'});
            const summaryText = await generateSummary(analysisResults);
            setSummary(summaryText);

            setAppState('results');
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during analysis.');
            setAppState('error');
        }
    }, []);

    const { isRecording, startRecording, stopRecording } = useScreenRecorder(handleRecordingStop);
    
    useEffect(() => {
        if (isRecording) {
            setAppState('recording');
        }
    }, [isRecording]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || appState !== 'results') return;

        const handleTimeUpdate = () => {
            const currentTime = video.currentTime;
            let currentStepIndex = -1;
            for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].timestamp <= currentTime) {
                    currentStepIndex = i;
                    break;
                }
            }
            if (currentStepIndex !== activeStepIndex) {
               setActiveStepIndex(currentStepIndex);
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [steps, appState, activeStepIndex]);
    
    useEffect(() => {
        if (activeStepIndex !== null && stepsListRef.current) {
            const activeElement = stepsListRef.current.children[activeStepIndex] as HTMLLIElement;
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeStepIndex]);


    const handleStartClick = () => {
        setError(null);
        startRecording();
    };

    const handleStopClick = () => {
        stopRecording();
    };

    const handleRestart = () => {
        setAppState('idle');
        setVideoBlob(null);
        setSteps([]);
        setError(null);
        setProcessingProgress({ stage: '', message: '' });
        setActiveStepIndex(null);
        setSummary('');
    };
    
    const handleStepChange = (index: number, newDescription: string) => {
        const newSteps = [...steps];
        newSteps[index].description = newDescription;
        setSteps(newSteps);
    };

    const handleDeleteStep = (indexToDelete: number) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este paso?')) {
            setSteps(prevSteps => prevSteps.filter((_, index) => index !== indexToDelete));
        }
    };

    const handleCopyGuide = useCallback(() => {
        const guideText = `Resumen del Proceso:\n${summary}\n\nPasos Detallados:\n${steps.map((step, index) => `${index + 1}. ${step.description}`).join('\n')}`;
        navigator.clipboard.writeText(guideText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    }, [summary, steps]);

    const playAudio = useCallback(async (base64Audio: string) => {
        if (typeof window === 'undefined') return;
    
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
    
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        try {
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
        } catch (err) {
            console.error("Error playing audio:", err);
        }
    }, []);
    
    const handlePlayStepAudio = useCallback(async (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        try {
            const audioData = await generateSpeech(text);
            await playAudio(audioData);
        } catch (err) {
            console.error("Failed to play audio for step:", err);
        }
    }, [playAudio]);

    const handleCaptureFrame = useCallback((index: number) => {
        if (!videoRef.current) return;
        const video = videoRef.current;
    
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        setSteps(prevSteps => {
            const newSteps = [...prevSteps];
            const screenshotData = dataUrl.split(',')[1];
            newSteps[index] = { ...newSteps[index], screenshot: screenshotData };
            return newSteps;
        });
    }, []);

    const seekVideoAndPlay = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play();
        }
    };

    const renderContent = () => {
        switch (appState) {
            case 'recording':
                return (
                    <div className="flex flex-col items-center justify-center text-white h-full">
                        <div className="flex items-center text-2xl mb-4">
                            <RecordingIcon />
                            <span>Grabando en progreso...</span>
                        </div>
                        <p className="text-gray-400 mb-8">Realiza las acciones que quieres documentar.</p>
                        <button onClick={handleStopClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg flex items-center transition-transform transform hover:scale-105">
                            <StopIcon /> Detener Grabación
                        </button>
                    </div>
                );
            case 'processing':
                return <Loader progress={processingProgress} />;
            case 'results':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 md:p-8 h-[calc(100vh-150px)]">
                        <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                            <video ref={videoRef} src={videoBlob ? URL.createObjectURL(videoBlob) : ''} controls className="w-full h-auto"></video>
                            <div className="p-4 flex-grow flex items-center justify-center">
                                <button onClick={handleRestart} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">
                                    Iniciar Nueva Grabación
                                </button>
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
                            <div className="flex justify-between items-center p-4 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white">Guía del Proceso</h2>
                                <button onClick={handleCopyGuide} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                    {copied ? <ClipboardCheckIcon /> : <CopyIcon />}
                                    <span>{copied ? '¡Copiado!' : 'Copiar Guía'}</span>
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-grow p-4">
                                {summary && (
                                    <details className="mb-4 bg-gray-700/50 rounded-lg open:ring-1 open:ring-gray-600" open>
                                        <summary className="p-4 font-semibold text-white cursor-pointer list-none flex justify-between items-center">
                                            <span>Resumen del Proceso</span>
                                            <svg className="w-5 h-5 transition-transform transform details-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </summary>
                                        <p className="p-4 pt-0 text-gray-300 whitespace-pre-wrap">{summary}</p>
                                    </details>
                                )}
                                <ul ref={stepsListRef} className="space-y-4">
                                    {steps.map((step, index) => (
                                        <li 
                                            key={index} 
                                            onClick={() => seekVideoAndPlay(step.timestamp)}
                                            className={`p-3 rounded-md flex items-start group cursor-pointer transition-all duration-300 ${index === activeStepIndex ? 'bg-blue-900/50 ring-2 ring-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        >
                                            <div className="flex-grow flex items-start space-x-4">
                                                {step.screenshot && (
                                                    <div className="flex-shrink-0 w-32 h-20 bg-gray-600 rounded-md overflow-hidden border-2 border-gray-500">
                                                        <img src={`data:image/jpeg;base64,${step.screenshot}`} alt={`Screenshot for step ${index + 1}`} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-grow">
                                                    <span className="text-blue-400 text-sm mb-1 font-mono block">
                                                        @{step.timestamp.toFixed(1)}s
                                                    </span>
                                                    <textarea
                                                        value={step.description}
                                                        onChange={(e) => handleStepChange(index, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full bg-transparent text-white border-none focus:ring-1 focus:ring-blue-500 rounded-sm p-1 -m-1 resize-none cursor-text"
                                                        rows={Math.max(2, Math.ceil(step.description.length / 40))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="ml-4 flex flex-col space-y-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handlePlayStepAudio(e, step.description)} className="p-2 text-gray-300 hover:text-white bg-gray-600 hover:bg-blue-500 rounded-full" aria-label={`Reproducir audio para el paso ${index + 1}`}><SpeakerIcon /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleCaptureFrame(index); }} className="p-2 text-gray-300 hover:text-white bg-gray-600 hover:bg-blue-500 rounded-full" aria-label={`Capturar fotograma para el paso ${index + 1}`}><CameraIcon /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteStep(index); }} className="p-2 text-gray-300 hover:text-white bg-gray-600 hover:bg-red-500 rounded-full" aria-label={`Eliminar paso ${index + 1}`}><TrashIcon /></button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <div className="flex flex-col items-center justify-center text-white h-full p-4">
                        <h2 className="text-2xl text-red-500 font-bold mb-4">Ocurrió un Error</h2>
                        <p className="text-gray-300 bg-gray-800 p-4 rounded-md mb-8 max-w-lg text-center">{error}</p>
                        <button onClick={handleRestart} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105">
                            Intentar de Nuevo
                        </button>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="flex flex-col items-center justify-center text-white h-full p-4 text-center">
                        <h2 className="text-4xl font-bold mb-4">Captura tu Proceso, sin Esfuerzo.</h2>
                        <p className="text-lg text-gray-400 max-w-2xl mb-8">
                            Haz clic en 'Iniciar Grabación' para comenzar a capturar tu pantalla. Cuando termines, usaremos IA para analizar tus acciones y generar una guía completa paso a paso para ti.
                        </p>
                        <button onClick={handleStartClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl flex items-center transition-transform transform hover:scale-105 shadow-lg">
                            <PlayIcon /> Iniciar Grabación
                        </button>
                    </div>
                );
        }
    };
    

    return (
        <div className="bg-gray-900 min-h-screen flex flex-col">
            <style>{`
                details > summary { list-style: none; }
                details > summary::-webkit-details-marker { display: none; }
                details[open] .details-arrow { transform: rotate(180deg); }
            `}</style>
            <Header />
            <main className="flex-grow">
                {renderContent()}
            </main>
        </div>
    );
}