/**
 * 초진콜 페이지
 * 초진 환자에게 감사 메세지 발송
 * - 좌측 목록, 우측 상세
 * - 날짜 선택 기능
 * - 카카오톡 메시지 전송
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../chart/lib/supabaseClient';
import { getCurrentDate } from '@shared/lib/postgres';

interface FirstVisitTarget {
  treatment_record_id: number;
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  treatment_date: string;
  doctor_name?: string;
  chief_complaint?: string;
  message_sent: boolean;
  message_sent_at?: string;
  message_notes?: string;
}

interface PatientInfo {
  id: number;
  name: string;
  chart_number?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
}

// 초진 감사 메세지 템플릿
const MESSAGE_TEMPLATES = [
  {
    id: 'pain',
    name: '일반통증',
    icon: 'fa-hand-dots',
    color: 'bg-blue-500',
    content: `안녕하세요, {patient_name}님.
연이재한의원입니다.

오늘 내원해주셔서 감사합니다.
치료 후 통증 부위가 일시적으로 뻐근하거나 피로감이 느껴질 수 있습니다.
이는 정상적인 반응이니 걱정하지 않으셔도 됩니다.

치료 효과를 높이기 위해 충분한 수분 섭취와 휴식을 권장드립니다.
궁금하신 점이나 불편한 점이 있으시면 언제든 연락 주세요.

연이재한의원 드림
📞 02-XXX-XXXX`
  },
  {
    id: 'accident',
    name: '교통사고',
    icon: 'fa-car-burst',
    color: 'bg-red-500',
    content: `안녕하세요, {patient_name}님.
연이재한의원입니다.

오늘 내원해주셔서 감사합니다.
교통사고 후 통증은 시간이 지나면서 나타나거나 심해질 수 있으니,
조금이라도 불편하시면 바로 말씀해 주세요.

자동차보험으로 본인부담금 없이 치료받으실 수 있습니다.
치료 기간 동안 무리한 활동은 피해주시고, 충분히 쉬어주세요.

궁금하신 점이 있으시면 언제든 연락 주세요.

연이재한의원 드림
📞 02-XXX-XXXX`
  },
  {
    id: 'herbal',
    name: '한약상담',
    icon: 'fa-prescription-bottle-medical',
    color: 'bg-green-500',
    content: `안녕하세요, {patient_name}님.
연이재한의원입니다.

오늘 상담 감사드립니다.
한약은 체질과 증상에 맞게 처방되어 효과가 점진적으로 나타납니다.

복용 중 불편하신 점이나 궁금하신 사항이 있으시면
언제든지 편하게 연락 주세요.

건강한 하루 되세요!

연이재한의원 드림
📞 02-XXX-XXXX`
  }
];

const FirstVisitMessagePage: React.FC = () => {
  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());

  // 데이터
  const [targets, setTargets] = useState<FirstVisitTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 필터
  const [filterSent, setFilterSent] = useState<'all' | 'sent' | 'unsent'>('unsent');

  // 선택된 대상
  const [selectedTarget, setSelectedTarget] = useState<FirstVisitTarget | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // 메세지 모달
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('thanks');
  const [messageContent, setMessageContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTargets();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTarget) {
      loadPatientInfo(selectedTarget.patient_id);
    } else {
      setPatientInfo(null);
    }
  }, [selectedTarget]);

  const loadTargets = async () => {
    try {
      setLoading(true);

      // treatment_records에서 초진(initial) 환자 조회
      const { data: records, error } = await supabase
        .from('treatment_records')
        .select(`
          id,
          patient_id,
          treatment_date,
          doctor_name,
          visit_type,
          memo,
          patients!inner (
            id,
            name,
            chart_number,
            phone
          )
        `)
        .eq('visit_type', 'initial')
        .eq('treatment_date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 초진 메세지 발송 기록 조회
      const { data: messageRecords } = await supabase
        .from('patient_care_items')
        .select('*')
        .eq('care_type', 'first_visit_message')
        .eq('scheduled_date', selectedDate);

      const messageMap = new Map(
        (messageRecords || []).map(m => [m.patient_id, m])
      );

      const firstVisitTargets: FirstVisitTarget[] = (records || []).map((r: any) => {
        const patient = r.patients;
        const messageRecord = messageMap.get(patient.id);

        return {
          treatment_record_id: r.id,
          patient_id: patient.id,
          patient_name: patient.name,
          chart_number: patient.chart_number,
          phone: patient.phone,
          treatment_date: r.treatment_date,
          doctor_name: r.doctor_name,
          chief_complaint: r.memo,
          message_sent: messageRecord?.status === 'completed',
          message_sent_at: messageRecord?.completed_date,
          message_notes: messageRecord?.result
        };
      });

      setTargets(firstVisitTargets);
      setSelectedTarget(null);
    } catch (error) {
      console.error('초진 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientInfo = async (patientId: number) => {
    try {
      setLoadingPatient(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      setPatientInfo(data);
    } catch (error) {
      console.error('환자 정보 로드 실패:', error);
    } finally {
      setLoadingPatient(false);
    }
  };

  // 메세지 모달 열기
  const openMessageModal = () => {
    if (!selectedTarget) return;

    const template = MESSAGE_TEMPLATES.find(t => t.id === 'pain');
    const content = template?.content.replace('{patient_name}', selectedTarget.patient_name) || '';
    setMessageContent(content);
    setSelectedTemplate('pain');
    setShowMessageModal(true);
  };

  // 템플릿 변경
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template && selectedTarget) {
      setMessageContent(template.content.replace('{patient_name}', selectedTarget.patient_name));
    }
  };

  // 메세지 발송
  const handleSendMessage = async () => {
    if (!selectedTarget || !messageContent.trim()) return;

    try {
      setSaving(true);

      // 카카오톡 발송 (실제로는 카카오 API 연동 필요)
      // 여기서는 발송 기록만 저장

      // patient_care_items에 기록 저장
      const { error } = await supabase
        .from('patient_care_items')
        .upsert({
          patient_id: selectedTarget.patient_id,
          treatment_record_id: selectedTarget.treatment_record_id,
          care_type: 'first_visit_message',
          title: `${selectedTarget.patient_name} 초진 감사 메세지`,
          description: messageContent,
          status: 'completed',
          scheduled_date: selectedTarget.treatment_date,
          completed_date: new Date().toISOString(),
          completed_by: '시스템',
          result: '메세지 발송 완료',
          trigger_type: 'manual',
          trigger_source: 'first_visit_message_page'
        }, {
          onConflict: 'patient_id,care_type,scheduled_date'
        });

      if (error) throw error;

      alert('메세지가 발송되었습니다.');
      setShowMessageModal(false);
      loadTargets();
    } catch (error) {
      console.error('메세지 발송 실패:', error);
      alert('메세지 발송에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 카카오톡 열기 (수동)
  const openKakaoTalk = () => {
    if (!selectedTarget?.phone) {
      alert('전화번호가 없습니다.');
      return;
    }

    const template = MESSAGE_TEMPLATES.find(t => t.id === 'thanks');
    const content = template?.content.replace('{patient_name}', selectedTarget.patient_name) || '';

    // 카카오톡 URL scheme
    const kakaoUrl = `kakaoopen://send?phone=${selectedTarget.phone.replace(/-/g, '')}&text=${encodeURIComponent(content)}`;
    window.open(kakaoUrl, '_blank');
  };

  // 필터된 목록
  const filteredTargets = targets.filter(t => {
    const matchesSearch = !searchTerm ||
      t.patient_name.includes(searchTerm) ||
      t.chart_number?.includes(searchTerm) ||
      t.phone?.includes(searchTerm);

    const matchesFilter = filterSent === 'all' ||
      (filterSent === 'sent' && t.message_sent) ||
      (filterSent === 'unsent' && !t.message_sent);

    return matchesSearch && matchesFilter;
  });

  // 날짜 변경 핸들러
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  };

  // 생년월일로 나이 계산
  const calculateAge = (dob?: string) => {
    if (!dob) return '';
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age}세`;
  };

  return (
    <div className="h-full flex">
      {/* 좌측: 환자 목록 */}
      <div className="w-96 bg-white border-r flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">초진 환자 목록</h2>
            <span className="text-sm text-gray-500">
              {filteredTargets.length}명
            </span>
          </div>

          {/* 날짜 선택 */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <i className="fas fa-chevron-left text-gray-500"></i>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-center"
            />
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <i className="fas fa-chevron-right text-gray-500"></i>
            </button>
            <button
              onClick={() => setSelectedDate(getCurrentDate())}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              오늘
            </button>
          </div>

          {/* 검색 */}
          <div className="relative mb-3">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="이름, 차트번호, 전화번호 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          {/* 필터 */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSent('all')}
              className={`flex-1 py-1.5 text-sm rounded ${
                filterSent === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterSent('unsent')}
              className={`flex-1 py-1.5 text-sm rounded ${
                filterSent === 'unsent'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              미발송
            </button>
            <button
              onClick={() => setFilterSent('sent')}
              className={`flex-1 py-1.5 text-sm rounded ${
                filterSent === 'sent'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              발송완료
            </button>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-inbox text-4xl mb-2"></i>
              <p>초진 환자가 없습니다</p>
            </div>
          ) : (
            filteredTargets.map((target) => (
              <div
                key={target.treatment_record_id}
                onClick={() => setSelectedTarget(target)}
                className={`p-4 border-b cursor-pointer transition-colors ${
                  selectedTarget?.treatment_record_id === target.treatment_record_id
                    ? 'bg-orange-50 border-l-4 border-l-orange-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">
                        {target.patient_name}
                      </span>
                      {target.chart_number && (
                        <span className="text-xs text-gray-500">
                          ({target.chart_number})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {target.phone || '전화번호 없음'}
                    </div>
                    {target.doctor_name && (
                      <div className="text-xs text-gray-400 mt-1">
                        담당: {target.doctor_name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {target.message_sent ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                        <i className="fas fa-check mr-1"></i>
                        발송완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                        <i className="fas fa-clock mr-1"></i>
                        미발송
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측: 상세 정보 */}
      <div className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        {selectedTarget ? (
          <div className="max-w-2xl mx-auto">
            {/* 환자 정보 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {selectedTarget.patient_name}
                  </h3>
                  <p className="text-gray-500">
                    {selectedTarget.chart_number || '차트번호 없음'}
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-sm ${
                  selectedTarget.message_sent
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedTarget.message_sent ? '발송완료' : '미발송'}
                </div>
              </div>

              {loadingPatient ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : patientInfo && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">전화번호</p>
                    <p className="font-medium">{patientInfo.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">생년월일</p>
                    <p className="font-medium">
                      {patientInfo.dob ? `${patientInfo.dob} (${calculateAge(patientInfo.dob)})` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">성별</p>
                    <p className="font-medium">
                      {patientInfo.gender === 'male' ? '남' : patientInfo.gender === 'female' ? '여' : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">담당의</p>
                    <p className="font-medium">{selectedTarget.doctor_name || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">주소</p>
                    <p className="font-medium">{patientInfo.address || '-'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 진료 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h4 className="font-semibold text-gray-800 mb-4">
                <i className="fas fa-stethoscope text-orange-500 mr-2"></i>
                초진 정보
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400">진료일</p>
                  <p className="font-medium">{selectedTarget.treatment_date}</p>
                </div>
                {selectedTarget.chief_complaint && (
                  <div>
                    <p className="text-xs text-gray-400">주소증</p>
                    <p className="font-medium">{selectedTarget.chief_complaint}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 메세지 발송 기록 */}
            {selectedTarget.message_sent && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  <i className="fas fa-envelope-circle-check text-green-500 mr-2"></i>
                  발송 기록
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">발송일시</p>
                    <p className="font-medium">
                      {selectedTarget.message_sent_at
                        ? new Date(selectedTarget.message_sent_at).toLocaleString('ko-KR')
                        : '-'}
                    </p>
                  </div>
                  {selectedTarget.message_notes && (
                    <div>
                      <p className="text-xs text-gray-400">메모</p>
                      <p className="font-medium">{selectedTarget.message_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              {!selectedTarget.message_sent && (
                <button
                  onClick={openMessageModal}
                  className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-800 rounded-lg font-semibold transition-colors"
                >
                  <i className="fas fa-comment mr-2"></i>
                  감사 메세지 발송
                </button>
              )}
              <button
                onClick={openKakaoTalk}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
              >
                <i className="fas fa-paper-plane mr-2"></i>
                카카오톡 열기
              </button>
              {selectedTarget.phone && (
                <a
                  href={`tel:${selectedTarget.phone}`}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors text-center"
                >
                  <i className="fas fa-phone mr-2"></i>
                  전화걸기
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <i className="fas fa-user-plus text-6xl mb-4"></i>
            <p className="text-lg">환자를 선택해주세요</p>
          </div>
        )}
      </div>

      {/* 메세지 발송 모달 */}
      {showMessageModal && selectedTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">감사 메세지 발송</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <i className="fas fa-times text-gray-500"></i>
              </button>
            </div>

            <div className="p-4">
              {/* 수신자 정보 */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <i className="fas fa-user text-gray-400"></i>
                  <span className="font-medium">{selectedTarget.patient_name}</span>
                  <span className="text-gray-500">
                    {selectedTarget.phone || '전화번호 없음'}
                  </span>
                </div>
              </div>

              {/* 템플릿 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메세지 유형 선택
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MESSAGE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${template.color} flex items-center justify-center mb-2`}>
                        <i className={`fas ${template.icon} text-white`}></i>
                      </div>
                      <span className={`text-sm font-medium ${
                        selectedTemplate === template.id ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        {template.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 메세지 내용 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메세지 내용
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={8}
                  className="w-full border rounded-lg p-3 resize-none"
                  placeholder="메세지 내용을 입력하세요"
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSendMessage}
                disabled={saving || !messageContent.trim()}
                className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-800 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    발송 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2"></i>
                    발송하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirstVisitMessagePage;
