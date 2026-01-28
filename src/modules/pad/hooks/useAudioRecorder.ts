/**
 * 오디오 녹음 훅
 * MediaRecorder API를 사용하여 브라우저에서 오디오 녹음
 */

import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 녹음 시작
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      chunksRef.current = [];

      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper 권장 샘플레이트
        },
      });

      streamRef.current = stream;

      // MediaRecorder 생성
      // iOS Safari는 webm을 지원하지 않으므로 mp4/aac 사용
      const getSupportedMimeType = (): string => {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg;codecs=opus',
          'audio/wav',
        ];
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log('[AudioRecorder] Using MIME type:', type);
            return type;
          }
        }
        console.warn('[AudioRecorder] No supported MIME type found, using default');
        return '';
      };

      const mimeType = getSupportedMimeType();

      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('녹음 중 오류가 발생했습니다.');
      };

      // 1초마다 데이터 저장 (중간에 끊겨도 데이터 보존)
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // 타이머 시작
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.error('녹음 시작 오류:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // iOS Safari는 HTTPS에서만 마이크 허용
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isHTTP = window.location.protocol === 'http:';
        if (isIOS && isHTTP) {
          setError('iOS에서는 HTTPS 연결이 필요합니다. 관리자에게 문의하세요.');
        } else {
          setError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
        }
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('마이크를 찾을 수 없습니다.');
      } else if (err instanceof DOMException && err.name === 'NotSupportedError') {
        setError('이 브라우저에서는 녹음이 지원되지 않습니다.');
      } else if (err instanceof TypeError) {
        setError('MediaRecorder가 지원되지 않습니다. 다른 브라우저를 사용해주세요.');
      } else {
        setError(`녹음을 시작할 수 없습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      }
      return false;
    }
  }, []);

  // 녹음 중지
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      // 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = () => {
        // 모든 청크를 하나의 Blob으로 합침
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        chunksRef.current = [];

        // 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  // 녹음 일시정지
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  // 녹음 재개
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
  };
}

export default useAudioRecorder;
