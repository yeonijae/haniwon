/**
 * 녹취 서비스
 * - 오디오 파일 업로드
 * - Whisper API로 텍스트 변환
 * - SQLite에 녹취록 저장
 */

const SQLITE_API_URL = 'http://192.168.0.173:3200';

interface TranscriptionResult {
  success: boolean;
  transcript: string;
  duration: number;
  language: string;
  error?: string;
}

interface SaveTranscriptParams {
  actingId: number;
  patientId: number;
  doctorId: number;
  doctorName: string;
  actingType: string;
  audioPath?: string;
  transcript: string;
  durationSec: number;
}

/**
 * 오디오 파일을 Whisper API로 변환
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options?: {
    language?: string;
    prompt?: string;
  }
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('language', options?.language || 'ko');
  if (options?.prompt) {
    formData.append('prompt', options.prompt);
  }

  const response = await fetch(`${SQLITE_API_URL}/api/whisper/transcribe`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      success: false,
      transcript: '',
      duration: 0,
      language: 'ko',
      error: data.error || 'Transcription failed',
    };
  }

  return {
    success: true,
    transcript: data.transcript,
    duration: data.duration,
    language: data.language,
  };
}

/**
 * 오디오 파일 업로드 (선택적)
 */
export async function uploadAudioFile(
  audioBlob: Blob,
  patientId: number,
  actingId: number
): Promise<string | null> {
  try {
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `acting_${actingId}_${timestamp}.webm`;

    formData.append('file', audioBlob, fileName);
    formData.append('folder', `recordings/patient_${patientId}`);

    const response = await fetch(`${SQLITE_API_URL}/api/files/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.path) {
      return data.path;
    }
    return null;
  } catch (error) {
    console.error('오디오 업로드 실패:', error);
    return null;
  }
}

/**
 * 녹취록 저장
 */
export async function saveTranscript(params: SaveTranscriptParams): Promise<boolean> {
  const escapeSql = (str: string | null | undefined): string => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sql = `
    INSERT INTO acting_transcripts (
      acting_id, patient_id, doctor_id, doctor_name,
      acting_type, audio_path, transcript, duration_sec
    ) VALUES (
      ${params.actingId},
      ${params.patientId},
      ${params.doctorId},
      ${escapeSql(params.doctorName)},
      ${escapeSql(params.actingType)},
      ${escapeSql(params.audioPath)},
      ${escapeSql(params.transcript)},
      ${params.durationSec}
    )
  `;

  try {
    const response = await fetch(`${SQLITE_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();
    return data.success || data.lastrowid > 0;
  } catch (error) {
    console.error('녹취록 저장 실패:', error);
    return false;
  }
}

/**
 * 환자의 녹취록 조회
 */
export async function getPatientTranscripts(patientId: number, limit = 10): Promise<any[]> {
  const sql = `
    SELECT * FROM acting_transcripts
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  try {
    const response = await fetch(`${SQLITE_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();
    if (!data.columns || !data.rows) return [];

    return data.rows.map((row: any[]) => {
      const obj: any = {};
      data.columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (error) {
    console.error('녹취록 조회 실패:', error);
    return [];
  }
}

/**
 * 녹음 + 변환 + 저장을 한 번에 처리
 */
export async function processRecording(
  audioBlob: Blob,
  params: {
    actingId: number;
    patientId: number;
    doctorId: number;
    doctorName: string;
    actingType: string;
    saveAudio?: boolean; // 오디오 파일도 저장할지
  }
): Promise<{
  success: boolean;
  transcript: string;
  error?: string;
}> {
  try {
    // 1. 음성→텍스트 변환
    const result = await transcribeAudio(audioBlob, {
      prompt: `한의원 진료 상담. ${params.actingType} 치료. 의료 용어 포함.`,
    });

    if (!result.success) {
      return {
        success: false,
        transcript: '',
        error: result.error,
      };
    }

    // 2. 오디오 파일 업로드 (선택적)
    let audioPath: string | undefined;
    if (params.saveAudio) {
      audioPath = (await uploadAudioFile(audioBlob, params.patientId, params.actingId)) || undefined;
    }

    // 3. 녹취록 저장
    await saveTranscript({
      actingId: params.actingId,
      patientId: params.patientId,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      actingType: params.actingType,
      audioPath,
      transcript: result.transcript,
      durationSec: Math.floor(result.duration),
    });

    return {
      success: true,
      transcript: result.transcript,
    };
  } catch (error) {
    console.error('녹음 처리 실패:', error);
    return {
      success: false,
      transcript: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
