
import { useState, useRef, useCallback } from 'react';

export const useScreenRecorder = (onRecordingStop: (blob: Blob) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    // Ensure we only try to stop the recorder if it's currently recording.
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    // Clean up the stream and tracks to remove the browser's screen sharing indicator.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Update the recording state.
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
        } as MediaTrackConstraints,
        audio: false,
      });

      streamRef.current = stream;
      // Add a listener to handle when the user stops sharing via the browser's native UI.
      stream.getTracks().forEach(track => track.onended = stopRecording);

      setIsRecording(true);
      recordedChunks.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        onRecordingStop(blob);
        recordedChunks.current = [];
        // No need to stop tracks here; `stopRecording` handles all cleanup.
      };

      recorder.start();
    } catch (err) {
      console.error('Error starting screen recording:', err);
      setIsRecording(false);
    }
  }, [onRecordingStop, stopRecording]);

  return { isRecording, startRecording, stopRecording };
};
