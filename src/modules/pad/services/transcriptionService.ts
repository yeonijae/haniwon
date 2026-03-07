/**
 * 녹취 서비스
 * - 오디오 파일 업로드
 * - Whisper API로 텍스트 변환
 * - GPT로 SOAP 변환
 * - PostgreSQL에 진료녹취 저장
 */

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';

interface TranscriptionResult {
  success: boolean;
  transcript: string;
  duration: number;
  language: string;
  error?: string;
}

interface SoapResult {
  success: boolean;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  error?: string;
}

interface DiarizedUtterance {
  speaker: 'doctor' | 'patient';
  text: string;
}

interface DiarizationResult {
  success: boolean;
  utterances: DiarizedUtterance[];
  formatted: string; // "[의사] ... \n[환자] ..." 형식
  error?: string;
}

interface MedicalTranscript {
  id: number;
  acting_id: number;
  patient_id: number;
  doctor_id: number;
  doctor_name: string;
  acting_type: string;
  audio_path: string | null;
  transcript: string;
  diarized_transcript: string | null; // 화자 분리된 녹취록
  duration_sec: number;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  soap_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface SaveTranscriptParams {
  actingId: number;
  patientId: number;
  doctorId: number;
  doctorName: string;
  actingType: string;
  audioPath?: string;
  transcript: string;
  diarizedTranscript?: string;
  durationSec: number;
  recordingDate?: string;
  patientName?: string;
  chartNumber?: string;
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

  const response = await fetch(`${API_URL}/api/whisper/transcribe`, {
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
 * 녹취록을 SOAP 형식으로 변환
 */
export async function convertToSoap(
  transcript: string,
  actingType: string,
  patientInfo?: string
): Promise<SoapResult> {
  try {
    const response = await fetch(`${API_URL}/api/gpt/soap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        acting_type: actingType,
        patient_info: patientInfo || '',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        error: data.error || 'SOAP conversion failed',
      };
    }

    return {
      success: true,
      subjective: data.subjective || '',
      objective: data.objective || '',
      assessment: data.assessment || '',
      plan: data.plan || '',
    };
  } catch (error) {
    console.error('SOAP 변환 실패:', error);
    return {
      success: false,
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 녹취록을 화자별로 분리 (GPT 후처리)
 */
export async function diarizeTranscript(
  transcript: string,
  actingType: string
): Promise<DiarizationResult> {
  try {
    const response = await fetch(`${API_URL}/api/gpt/diarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        acting_type: actingType,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        utterances: [],
        formatted: transcript,
        error: data.error || 'Diarization failed',
      };
    }

    return {
      success: true,
      utterances: data.utterances || [],
      formatted: data.formatted || transcript,
    };
  } catch (error) {
    console.error('화자 분리 실패:', error);
    return {
      success: false,
      utterances: [],
      formatted: transcript,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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

    const response = await fetch(`${API_URL}/api/files/upload-recording`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`업로드 실패 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.path) {
      return data.path;
    }
    throw new Error('서버 응답에 path가 없습니다');
  } catch (error) {
    console.error('오디오 업로드 실패:', error);
    throw error;  // 에러를 상위로 전파 (null 반환 대신)
  }
}

/**
 * 진료녹취 저장 (medical_transcripts 테이블)
 */
export async function saveMedicalTranscript(params: SaveTranscriptParams & {
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  soapStatus?: string;
}): Promise<number | null> {
  const escapeSql = (str: string | null | undefined): string => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sql = `
    INSERT INTO medical_transcripts (
      acting_id, patient_id, doctor_id, doctor_name,
      acting_type, audio_path, transcript, diarized_transcript, duration_sec,
      recording_date,
      soap_subjective, soap_objective, soap_assessment, soap_plan, soap_status,
      patient_name, chart_number
    ) VALUES (
      ${params.actingId},
      ${params.patientId},
      ${params.doctorId},
      ${escapeSql(params.doctorName)},
      ${escapeSql(params.actingType)},
      ${escapeSql(params.audioPath)},
      ${escapeSql(params.transcript)},
      ${escapeSql(params.diarizedTranscript)},
      ${params.durationSec},
      ${escapeSql(params.recordingDate || new Date().toISOString())},
      ${escapeSql(params.soapSubjective)},
      ${escapeSql(params.soapObjective)},
      ${escapeSql(params.soapAssessment)},
      ${escapeSql(params.soapPlan)},
      ${escapeSql(params.soapStatus || 'pending')},
      ${escapeSql(params.patientName)},
      ${escapeSql(params.chartNumber)}
    )
  `;

  try {
    // RETURNING id를 추가해서 삽입된 ID를 가져옴
    const sqlWithReturning = sql.trim().replace(/;?\s*$/, ' RETURNING id');

    const response = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlWithReturning }),
    });

    const data = await response.json();

    // PostgreSQL RETURNING 결과에서 id 추출
    if (data.rows && data.rows.length > 0) {
      const firstRow = data.rows[0];
      // rows가 객체 배열인 경우
      if (typeof firstRow === 'object' && !Array.isArray(firstRow)) {
        return firstRow.id || null;
      }
      // rows가 배열인 경우 (columns + rows 형태)
      if (data.columns && Array.isArray(firstRow)) {
        const idIndex = data.columns.indexOf('id');
        if (idIndex >= 0) {
          return firstRow[idIndex];
        }
      }
    }

    // 호환성: lastrowid도 확인
    if (data.lastrowid > 0) {
      return data.lastrowid;
    }

    console.log('진료녹취 저장 완료 (ID 없음):', data);
    return null;
  } catch (error) {
    console.error('진료녹취 저장 실패:', error);
    return null;
  }
}

/**
 * SOAP 상태 업데이트
 */
export async function updateSoapStatus(
  transcriptId: number,
  soap: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    status: string;
  }
): Promise<boolean> {
  const escapeSql = (str: string | null | undefined): string => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sql = `
    UPDATE medical_transcripts SET
      soap_subjective = ${escapeSql(soap.subjective)},
      soap_objective = ${escapeSql(soap.objective)},
      soap_assessment = ${escapeSql(soap.assessment)},
      soap_plan = ${escapeSql(soap.plan)},
      soap_status = ${escapeSql(soap.status)},
      updated_at = NOW()
    WHERE id = ${transcriptId}
  `;

  try {
    const response = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();
    return data.success || data.rowcount > 0;
  } catch (error) {
    console.error('SOAP 상태 업데이트 실패:', error);
    return false;
  }
}

/**
 * 화자 분리된 녹취록 업데이트
 */
export async function updateDiarizedTranscript(
  transcriptId: number,
  diarizedTranscript: string
): Promise<boolean> {
  const escapeSql = (str: string | null | undefined): string => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sql = `
    UPDATE medical_transcripts SET
      diarized_transcript = ${escapeSql(diarizedTranscript)},
      updated_at = NOW()
    WHERE id = ${transcriptId}
  `;

  try {
    const response = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();
    return data.success || data.rowcount > 0;
  } catch (error) {
    console.error('화자 분리 녹취록 업데이트 실패:', error);
    return false;
  }
}

/**
 * 환자의 진료녹취 조회
 */
export async function getPatientTranscripts(patientId: number, limit = 20): Promise<MedicalTranscript[]> {
  const sql = `
    SELECT * FROM medical_transcripts
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  try {
    const response = await fetch(`${API_URL}/api/execute`, {
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
      return obj as MedicalTranscript;
    });
  } catch (error) {
    console.error('진료녹취 조회 실패:', error);
    return [];
  }
}

/**
 * 날짜별 진료녹취 조회
 */
export async function getTranscriptsByDate(date: string, limit = 100): Promise<MedicalTranscript[]> {
  const sql = `
    SELECT * FROM medical_transcripts
    WHERE date(created_at) = '${date}'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  try {
    const response = await fetch(`${API_URL}/api/execute`, {
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
      return obj as MedicalTranscript;
    });
  } catch (error) {
    console.error('날짜별 진료녹취 조회 실패:', error);
    return [];
  }
}

/**
 * 녹음 + 변환 + SOAP + 저장을 한 번에 처리
 */
export async function processRecording(
  audioBlob: Blob,
  params: {
    actingId: number;
    patientId: number;
    doctorId: number;
    doctorName: string;
    actingType: string;
    patientInfo?: string;
    saveAudio?: boolean;
    autoPipeline?: boolean; // 저장 후 자동 파이프라인 실행 (기본: true)
  }
): Promise<{
  success: boolean;
  transcript: string;
  transcriptId?: number;
  error?: string;
}> {
  const autoPipeline = params.autoPipeline !== false; // 기본값 true

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

    // 3. 녹취록 저장 (SOAP는 pending 상태로)
    const transcriptId = await saveMedicalTranscript({
      actingId: params.actingId,
      patientId: params.patientId,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      actingType: params.actingType,
      audioPath,
      transcript: result.transcript,
      durationSec: Math.floor(result.duration),
      soapStatus: autoPipeline ? 'processing' : 'pending',
    });

    if (!transcriptId) {
      return {
        success: true,
        transcript: result.transcript,
        error: 'Saved but failed to get ID',
      };
    }

    // 4. 자동 파이프라인: fire-and-forget (화자 분리 → SOAP)
    if (autoPipeline) {
      runTranscriptPipeline(
        transcriptId,
        result.transcript,
        params.actingType,
        { patientInfo: params.patientInfo }
      ).catch(err => {
        console.error(`[Pipeline] fire-and-forget 오류 (transcriptId=${transcriptId}):`, err);
      });
    }

    return {
      success: true,
      transcript: result.transcript,
      transcriptId,
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

// ============ 자동 파이프라인 엔진 ============

/**
 * processing_status / processing_message 업데이트
 */
export async function updateProcessingStatus(
  transcriptId: number,
  status: 'uploading' | 'transcribing' | 'processing' | 'completed' | 'failed',
  message?: string
): Promise<boolean> {
  const escapeSql = (str: string | null | undefined): string => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sql = `
    UPDATE medical_transcripts SET
      processing_status = ${escapeSql(status)},
      processing_message = ${escapeSql(message)},
      updated_at = NOW()
    WHERE id = ${transcriptId}
  `;

  try {
    const response = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const data = await response.json();
    return data.success || data.rowcount > 0;
  } catch (error) {
    console.error('processing_status 업데이트 실패:', error);
    return false;
  }
}

// 동시 실행 방지용 Set
const _runningPipelines = new Set<number>();

/**
 * 지수 백오프 재시도 헬퍼
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * 녹취 자동 파이프라인: 화자 분리 → SOAP 생성
 * - 중복 실행 방지 (transcriptId 기반)
 * - 각 단계 실패 시 3회 재시도 (1s, 2s, 4s 백오프)
 * - 상태를 processing_status / soap_status / processing_message에 기록
 */
export async function runTranscriptPipeline(
  transcriptId: number,
  transcript: string,
  actingType: string,
  options?: { patientInfo?: string }
): Promise<void> {
  // 중복 실행 방지
  if (_runningPipelines.has(transcriptId)) {
    console.warn(`[Pipeline] transcriptId=${transcriptId} 이미 실행 중 — 스킵`);
    return;
  }

  // transcript 누락 시 안전하게 실패 처리
  if (!transcript || transcript.trim() === '') {
    console.warn(`[Pipeline] transcriptId=${transcriptId} transcript 텍스트 없음 — 스킵`);
    await updateProcessingStatus(transcriptId, 'failed', '녹취 텍스트가 비어있어 파이프라인을 실행할 수 없습니다');
    await updateSoapStatus(transcriptId, { status: 'failed' });
    return;
  }

  _runningPipelines.add(transcriptId);

  try {
    // Step 1: 화자 분리 (diarization)
    await updateProcessingStatus(transcriptId, 'processing', '화자 분리 진행 중...');

    try {
      const diarResult = await withRetry(async () => {
        const r = await diarizeTranscript(transcript, actingType);
        if (!r.success) throw new Error(r.error || 'Diarization failed');
        return r;
      });

      if (diarResult.formatted) {
        await updateDiarizedTranscript(transcriptId, diarResult.formatted);
      }
    } catch (diarError) {
      const msg = diarError instanceof Error ? diarError.message : 'Unknown diarization error';
      console.error(`[Pipeline] 화자 분리 3회 실패 (transcriptId=${transcriptId}):`, msg);
      // 화자 분리 실패는 치명적이지 않음 — SOAP 진행
      await updateProcessingStatus(transcriptId, 'processing', `화자 분리 실패(${msg}), SOAP 진행 중...`);
    }

    // Step 2: SOAP 생성
    await updateSoapStatus(transcriptId, { status: 'processing' });

    try {
      const soapResult = await withRetry(async () => {
        const r = await convertToSoap(transcript, actingType, options?.patientInfo);
        if (!r.success) throw new Error(r.error || 'SOAP conversion failed');
        return r;
      });

      await updateSoapStatus(transcriptId, {
        subjective: soapResult.subjective,
        objective: soapResult.objective,
        assessment: soapResult.assessment,
        plan: soapResult.plan,
        status: 'completed',
      });
    } catch (soapError) {
      const msg = soapError instanceof Error ? soapError.message : 'Unknown SOAP error';
      console.error(`[Pipeline] SOAP 3회 실패 (transcriptId=${transcriptId}):`, msg);
      await updateSoapStatus(transcriptId, { status: 'failed' });
      await updateProcessingStatus(transcriptId, 'failed', `SOAP 변환 실패: ${msg}`);
      return;
    }

    // 모든 단계 성공
    await updateProcessingStatus(transcriptId, 'completed', null);
    console.log(`[Pipeline] 완료 (transcriptId=${transcriptId})`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown pipeline error';
    console.error(`[Pipeline] 예기치 않은 오류 (transcriptId=${transcriptId}):`, msg);
    await updateProcessingStatus(transcriptId, 'failed', msg);
  } finally {
    _runningPipelines.delete(transcriptId);
  }
}

// ============ Legacy 함수 (하위호환) ============

/**
 * @deprecated Use saveMedicalTranscript instead
 */
export async function saveTranscript(params: SaveTranscriptParams): Promise<boolean> {
  const result = await saveMedicalTranscript(params);
  return result !== null;
}
