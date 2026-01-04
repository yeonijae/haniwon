import React, { useState, useEffect, useMemo } from 'react';
import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

// 진료 카테고리 정의
const TREATMENT_CATEGORIES = [
  { id: 'pediatric', name: '소아청소년', keywords: ['ADHD', '틱', 'TIC', '성장', '비염', '아토피', '소아', '청소년'] },
  { id: 'gynecology', name: '부인과', keywords: ['생리', '월경', '임신', '산후', '갱년기', '자궁', '난소', '부인'] },
  { id: 'digestive', name: '소화기', keywords: ['소화', '위', '장', '변비', '설사', '복통', '담적', '역류'] },
  { id: 'respiratory', name: '호흡기', keywords: ['기침', '천식', '비염', '코', '감기', '폐', '호흡'] },
  { id: 'skin', name: '피부', keywords: ['아토피', '습진', '두드러기', '피부', '가려움', '여드름'] },
  { id: 'mental', name: '신경정신', keywords: ['불면', '우울', '불안', '스트레스', '두통', '어지러움'] },
  { id: 'musculoskeletal', name: '근골격', keywords: ['허리', '목', '어깨', '관절', '통증', '디스크', '척추'] },
  { id: 'metabolic', name: '대사/비만', keywords: ['비만', '다이어트', '당뇨', '고혈압', '갑상선'] },
  { id: 'fatigue', name: '피로/보약', keywords: ['피로', '보약', '면역', '기력', '체력'] },
  { id: 'other', name: '기타', keywords: [] }
];

interface CompletedPatient {
  id: number;
  prescription_id: number;
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  formula: string;
  chief_complaint?: string;
  issued_at: string;
  completed_at: string;
  days: number;
  category?: string;
  last_call_date?: string;
  call_count: number;
}

interface AfterCareCall {
  id: number;
  patient_id: number;
  prescription_id: number;
  call_date: string;
  call_result: 'connected' | 'no_answer' | 'callback' | 'completed';
  notes?: string;
  next_action?: string;
  created_at: string;
}

const AfterCareManagement: React.FC = () => {
  const [completedPatients, setCompletedPatients] = useState<CompletedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<CompletedPatient | null>(null);

  // 통화 기록 모달 상태
  const [showCallModal, setShowCallModal] = useState(false);
  const [callForm, setCallForm] = useState({
    call_result: 'connected' as 'connected' | 'no_answer' | 'callback' | 'completed',
    notes: '',
    next_action: ''
  });

  // 메시지 발송 모달 상태
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({
    type: 'sms' as 'sms' | 'kakao',
    message: ''
  });

  // 통화 이력
  const [callHistory, setCallHistory] = useState<AfterCareCall[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadCompletedPatients();
  }, []);

  // 복용 완료 환자 로드
  const loadCompletedPatients = async () => {
    try {
      setLoading(true);

      // 복용 완료된 처방전 가져오기 (발급일 + 복용일수가 지난 처방)
      const prescriptions = await query<any>(
        `SELECT * FROM prescriptions WHERE status = 'issued' ORDER BY issued_at DESC`
      );

      // 복용 완료된 환자 필터링 및 주소증 가져오기
      const now = new Date();
      const completedList: CompletedPatient[] = [];

      for (const prescription of prescriptions || []) {
        const issuedDate = new Date(prescription.issued_at);
        const completedDate = new Date(issuedDate);
        completedDate.setDate(completedDate.getDate() + (prescription.days || 15));

        // 복용 완료된 경우만 포함
        if (completedDate < now) {
          let chiefComplaint = '';

          // 주소증 가져오기
          if (prescription.source_type === 'initial_chart' && prescription.source_id) {
            const chartData = await queryOne<{ notes: string }>(
              `SELECT notes FROM initial_charts WHERE id = ${prescription.source_id}`
            );

            if (chartData?.notes) {
              const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
              if (match) {
                chiefComplaint = match[1].trim();
              }
            }
          } else if (prescription.source_type === 'progress_note' && prescription.source_id) {
            const noteData = await queryOne<{ subjective: string }>(
              `SELECT subjective FROM progress_notes WHERE id = ${prescription.source_id}`
            );

            if (noteData?.subjective) {
              chiefComplaint = noteData.subjective;
            }
          }

          // 환자 정보 가져오기
          let phone = '';
          if (prescription.patient_id) {
            try {
              const patientData = await queryOne<{ phone: string }>(
                `SELECT phone FROM patients WHERE id = ${prescription.patient_id}`
              );
              phone = patientData?.phone || '';
            } catch {
              // patients 테이블이 없을 수 있음
            }
          }

          // 카테고리 분류
          const category = categorizeByChiefComplaint(chiefComplaint);

          // 사후관리 통화 기록 카운트
          let callCount = 0;
          try {
            const countResult = await queryOne<{ cnt: number }>(
              `SELECT COUNT(*) as cnt FROM aftercare_calls WHERE prescription_id = ${prescription.id}`
            );
            callCount = countResult?.cnt || 0;
          } catch {
            // aftercare_calls 테이블이 없을 수 있음
          }

          completedList.push({
            id: prescription.id,
            prescription_id: prescription.id,
            patient_id: prescription.patient_id,
            patient_name: prescription.patient_name || '이름없음',
            chart_number: prescription.chart_number,
            phone,
            formula: prescription.formula,
            chief_complaint: chiefComplaint,
            issued_at: prescription.issued_at,
            completed_at: completedDate.toISOString(),
            days: prescription.days || 15,
            category,
            call_count: callCount
          });
        }
      }

      setCompletedPatients(completedList);
    } catch (error) {
      console.error('복용 완료 환자 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 주소증 기반 카테고리 분류
  const categorizeByChiefComplaint = (chiefComplaint: string): string => {
    if (!chiefComplaint) return 'other';

    const lowerComplaint = chiefComplaint.toLowerCase();

    for (const category of TREATMENT_CATEGORIES) {
      if (category.keywords.some(keyword =>
        lowerComplaint.includes(keyword.toLowerCase())
      )) {
        return category.id;
      }
    }

    return 'other';
  };

  // 카테고리별 환자 수 계산
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: completedPatients.length };
    TREATMENT_CATEGORIES.forEach(cat => {
      counts[cat.id] = completedPatients.filter(p => p.category === cat.id).length;
    });
    return counts;
  }, [completedPatients]);

  // 필터링된 환자 목록
  const filteredPatients = useMemo(() => {
    return completedPatients.filter(patient => {
      // 카테고리 필터
      if (selectedCategory !== 'all' && patient.category !== selectedCategory) {
        return false;
      }

      // 검색어 필터
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          patient.patient_name?.toLowerCase().includes(term) ||
          patient.chart_number?.toLowerCase().includes(term) ||
          patient.formula?.toLowerCase().includes(term) ||
          patient.chief_complaint?.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [completedPatients, selectedCategory, searchTerm]);

  // 통화 기록 로드
  const loadCallHistory = async (prescriptionId: number) => {
    try {
      setLoadingHistory(true);
      const data = await query<AfterCareCall>(
        `SELECT * FROM aftercare_calls WHERE prescription_id = ${prescriptionId} ORDER BY call_date DESC`
      );
      setCallHistory(data || []);
    } catch (error) {
      console.error('통화 기록 로드 실패:', error);
      setCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 환자 선택 시
  const handleSelectPatient = (patient: CompletedPatient) => {
    setSelectedPatient(patient);
    loadCallHistory(patient.prescription_id);
  };

  // 통화 기록 저장
  const saveCallRecord = async () => {
    if (!selectedPatient) return;

    try {
      const now = getCurrentTimestamp();
      await insert(`
        INSERT INTO aftercare_calls (patient_id, prescription_id, call_date, call_result, notes, next_action, created_at)
        VALUES (
          ${selectedPatient.patient_id},
          ${selectedPatient.prescription_id},
          ${escapeString(new Date().toISOString())},
          ${escapeString(callForm.call_result)},
          ${callForm.notes ? escapeString(callForm.notes) : 'NULL'},
          ${callForm.next_action ? escapeString(callForm.next_action) : 'NULL'},
          ${escapeString(now)}
        )
      `);

      alert('통화 기록이 저장되었습니다.');
      setShowCallModal(false);
      setCallForm({ call_result: 'connected', notes: '', next_action: '' });
      loadCallHistory(selectedPatient.prescription_id);
      loadCompletedPatients(); // 카운트 업데이트
    } catch (error) {
      console.error('통화 기록 저장 실패:', error);
      alert('통화 기록 저장에 실패했습니다.\naftercare_calls 테이블이 없을 수 있습니다.');
    }
  };

  // 메시지 발송 (미리 작성된 템플릿)
  const sendMessage = () => {
    if (!selectedPatient) return;

    // 실제로는 SMS/카카오 API 연동 필요
    alert(`[메시지 발송 예정]\n\n수신: ${selectedPatient.patient_name}\n전화: ${selectedPatient.phone || '번호 없음'}\n타입: ${messageForm.type === 'sms' ? 'SMS' : '카카오톡'}\n\n${messageForm.message}\n\n* 실제 발송은 SMS/카카오 API 연동 후 가능합니다.`);
    setShowMessageModal(false);
    setMessageForm({ type: 'sms', message: '' });
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 완료일로부터 경과일 계산
  const getDaysSinceCompletion = (completedAt: string) => {
    const days = Math.floor((Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-clinic-text-primary">
            <i className="fas fa-user-check mr-3 text-clinic-primary"></i>
            사후관리
          </h1>
          <div className="text-sm text-clinic-text-secondary">
            복용 완료 환자: <span className="font-bold text-clinic-primary">{completedPatients.length}</span>명
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-clinic-primary text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              전체 ({categoryCounts.all || 0})
            </button>
            {TREATMENT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-clinic-primary text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {cat.name} ({categoryCounts[cat.id] || 0})
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="환자명, 차트번호, 처방, 주소증으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
          />
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* 환자 목록 */}
          <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
              <h2 className="font-semibold text-clinic-text-primary">
                복용 완료 환자 목록
                <span className="text-sm font-normal text-clinic-text-secondary ml-2">
                  ({filteredPatients.length}명)
                </span>
              </h2>
            </div>
            <div className="overflow-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin"></div>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                  <i className="fas fa-user-check text-4xl mb-4 opacity-30"></i>
                  <p>복용 완료 환자가 없습니다</p>
                </div>
              ) : (
                filteredPatients.map(patient => (
                  <div
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'bg-clinic-primary bg-opacity-10 border-l-4 border-l-clinic-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{patient.patient_name}</span>
                          {patient.chart_number && (
                            <span className="text-xs text-clinic-text-secondary">
                              ({patient.chart_number})
                            </span>
                          )}
                          {patient.call_count > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              통화 {patient.call_count}회
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-clinic-text-secondary mt-1 truncate">
                          {patient.formula}
                        </p>
                        {patient.chief_complaint && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            주소증: {patient.chief_complaint}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-xs text-clinic-text-secondary">
                          완료 {getDaysSinceCompletion(patient.completed_at)}일 전
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          getDaysSinceCompletion(patient.completed_at) <= 7
                            ? 'bg-green-100 text-green-700'
                            : getDaysSinceCompletion(patient.completed_at) <= 30
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {TREATMENT_CATEGORIES.find(c => c.id === patient.category)?.name || '기타'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 상세 정보 및 관리 */}
          <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0 flex items-center justify-between">
              <h2 className="font-semibold text-clinic-text-primary">환자 상세 정보</h2>
              {selectedPatient && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCallForm({ call_result: 'connected', notes: '', next_action: '' });
                      setShowCallModal(true);
                    }}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    <i className="fas fa-phone mr-1"></i>
                    통화기록
                  </button>
                  <button
                    onClick={() => {
                      setMessageForm({
                        type: 'sms',
                        message: `${selectedPatient.patient_name}님 안녕하세요. 연이재한의원입니다.\n\n복용하셨던 한약의 효과는 어떠신가요?\n궁금하신 점이 있으시면 언제든 문의해주세요.\n\n연이재한의원 041-576-7582`
                      });
                      setShowMessageModal(true);
                    }}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    <i className="fas fa-comment mr-1"></i>
                    메시지
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-auto flex-1 p-4">
              {selectedPatient ? (
                <div className="space-y-4">
                  {/* 환자 정보 */}
                  <div className="pb-4 border-b">
                    <h3 className="text-lg font-bold text-clinic-text-primary">
                      {selectedPatient.patient_name}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm">
                      {selectedPatient.chart_number && (
                        <p><span className="text-clinic-text-secondary">차트번호:</span> {selectedPatient.chart_number}</p>
                      )}
                      {selectedPatient.phone && (
                        <p><span className="text-clinic-text-secondary">연락처:</span> {selectedPatient.phone}</p>
                      )}
                      <p><span className="text-clinic-text-secondary">처방:</span> {selectedPatient.formula}</p>
                      <p><span className="text-clinic-text-secondary">복용기간:</span> {selectedPatient.days}일</p>
                      <p><span className="text-clinic-text-secondary">발급일:</span> {formatDate(selectedPatient.issued_at)}</p>
                      <p><span className="text-clinic-text-secondary">완료일:</span> {formatDate(selectedPatient.completed_at)}</p>
                    </div>
                  </div>

                  {/* 주소증 */}
                  {selectedPatient.chief_complaint && (
                    <div className="pb-4 border-b">
                      <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm mr-2">주소증</span>
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                        {selectedPatient.chief_complaint}
                      </div>
                    </div>
                  )}

                  {/* 통화 이력 */}
                  <div>
                    <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm mr-2">통화 이력</span>
                      <span className="text-xs text-clinic-text-secondary">({callHistory.length}건)</span>
                    </h4>
                    {loadingHistory ? (
                      <div className="text-center py-4 text-clinic-text-secondary">
                        <div className="border-2 border-clinic-background border-t-clinic-primary rounded-full w-6 h-6 animate-spin inline-block"></div>
                      </div>
                    ) : callHistory.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-clinic-text-secondary text-sm">
                        통화 기록이 없습니다
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {callHistory.map(call => (
                          <div key={call.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-clinic-text-secondary">
                                {formatDate(call.call_date)}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                call.call_result === 'connected' ? 'bg-green-100 text-green-700' :
                                call.call_result === 'completed' ? 'bg-blue-100 text-blue-700' :
                                call.call_result === 'no_answer' ? 'bg-gray-200 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {call.call_result === 'connected' ? '연결됨' :
                                 call.call_result === 'completed' ? '상담완료' :
                                 call.call_result === 'no_answer' ? '부재중' : '재통화'}
                              </span>
                            </div>
                            {call.notes && <p className="text-gray-600">{call.notes}</p>}
                            {call.next_action && (
                              <p className="text-xs text-blue-600 mt-1">
                                <i className="fas fa-arrow-right mr-1"></i>
                                {call.next_action}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                  <i className="fas fa-user-check text-4xl mb-4 opacity-30"></i>
                  <p>왼쪽 목록에서 환자를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 통화 기록 모달 */}
      {showCallModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-phone mr-2 text-green-600"></i>
                통화 기록
              </h2>
              <button onClick={() => setShowCallModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b">
              <p className="font-medium">{selectedPatient.patient_name}</p>
              <p className="text-sm text-clinic-text-secondary">{selectedPatient.phone || '연락처 없음'}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">통화 결과</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'connected', label: '연결됨', color: 'green' },
                    { value: 'no_answer', label: '부재중', color: 'gray' },
                    { value: 'callback', label: '재통화 필요', color: 'yellow' },
                    { value: 'completed', label: '상담완료', color: 'blue' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCallForm(prev => ({ ...prev, call_result: opt.value as any }))}
                      className={`py-2 text-sm rounded-lg transition-colors ${
                        callForm.call_result === opt.value
                          ? `bg-${opt.color}-500 text-white`
                          : `bg-${opt.color}-50 text-${opt.color}-600 hover:bg-${opt.color}-100`
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">통화 내용</label>
                <textarea
                  value={callForm.notes}
                  onChange={(e) => setCallForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="통화 내용을 기록하세요..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">다음 조치</label>
                <input
                  type="text"
                  value={callForm.next_action}
                  onChange={(e) => setCallForm(prev => ({ ...prev, next_action: e.target.value }))}
                  placeholder="예: 1주 후 재통화, 내원 예약 등"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCallModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-clinic-text-secondary hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={saveCallRecord}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <i className="fas fa-save mr-2"></i>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 발송 모달 */}
      {showMessageModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-comment mr-2 text-blue-600"></i>
                메시지 발송
              </h2>
              <button onClick={() => setShowMessageModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b">
              <p className="font-medium">{selectedPatient.patient_name}</p>
              <p className="text-sm text-clinic-text-secondary">{selectedPatient.phone || '연락처 없음'}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">발송 방법</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMessageForm(prev => ({ ...prev, type: 'sms' }))}
                    className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                      messageForm.type === 'sms'
                        ? 'bg-clinic-primary text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <i className="fas fa-sms mr-1"></i>
                    SMS
                  </button>
                  <button
                    onClick={() => setMessageForm(prev => ({ ...prev, type: 'kakao' }))}
                    className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                      messageForm.type === 'kakao'
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <i className="fas fa-comment mr-1"></i>
                    카카오톡
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">메시지 내용</label>
                <textarea
                  value={messageForm.message}
                  onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="메시지 내용을 입력하세요..."
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                />
                <p className="text-xs text-clinic-text-secondary mt-1">
                  {messageForm.message.length}자
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-clinic-text-secondary hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={sendMessage}
                disabled={!selectedPatient.phone}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-paper-plane mr-2"></i>
                발송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AfterCareManagement;
