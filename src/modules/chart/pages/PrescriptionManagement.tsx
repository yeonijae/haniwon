import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PrescriptionInput, { PrescriptionData } from '../components/PrescriptionInput';
import type { Prescription } from '../types';

type ViewMode = 'list' | 'new' | 'edit';
type PrintLayoutType = 'landscape' | 'portrait1' | 'portrait2';

const PrescriptionManagement: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [printLayoutModal, setPrintLayoutModal] = useState<Prescription | null>(null);

  // 처방 목록 로드
  useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 처방전에 연결된 차트에서 주소증 가져오기
      const prescriptionsWithChiefComplaint = await Promise.all(
        (data || []).map(async (prescription) => {
          let chiefComplaint = '';

          if (prescription.source_type && prescription.source_id) {
            if (prescription.source_type === 'initial_chart') {
              const { data: chartData } = await supabase
                .from('initial_charts')
                .select('notes')
                .eq('id', prescription.source_id)
                .single();
              // notes에서 [주소증] 섹션 추출
              if (chartData?.notes) {
                const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
                if (match) {
                  chiefComplaint = match[1].trim();
                }
              }
            } else if (prescription.source_type === 'progress_note') {
              const { data: noteData } = await supabase
                .from('progress_notes')
                .select('subjective')
                .eq('id', prescription.source_id)
                .single();
              chiefComplaint = noteData?.subjective || '';
            }
          }

          return { ...prescription, chief_complaint: chiefComplaint };
        })
      );

      setPrescriptions(prescriptionsWithChiefComplaint);
    } catch (error) {
      console.error('처방 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 새 처방 저장
  const handleSaveNew = async (data: PrescriptionData) => {
    try {
      // 처방번호 생성
      const now = new Date();
      const prescriptionNumber = `RX-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const prescription = {
        prescription_number: prescriptionNumber,
        prescription_date: now.toISOString().split('T')[0],
        patient_name: data.patientName || '',
        formula: data.formula,
        merged_herbs: data.mergedHerbs,
        final_herbs: data.finalHerbs,
        total_doses: data.totalDoses,
        days: data.days,
        doses_per_day: data.dosesPerDay,
        total_packs: data.totalPacks,
        pack_volume: data.packVolume,
        water_amount: data.waterAmount,
        herb_adjustment: data.herbAdjustment || null,
        total_dosage: data.totalDosage,
        final_total_amount: data.finalTotalAmount,
        notes: data.notes || null,
        status: 'issued',
        issued_at: now.toISOString(),
      };

      const { error } = await supabase
        .from('prescriptions')
        .insert([prescription]);

      if (error) throw error;

      alert('처방전이 저장되었습니다.');
      setViewMode('list');
      loadPrescriptions();
    } catch (error) {
      console.error('처방 저장 실패:', error);
      alert('처방 저장에 실패했습니다.');
    }
  };

  // 처방 수정
  const handleSaveEdit = async (data: PrescriptionData) => {
    if (!editingPrescription) return;

    try {
      const updates = {
        patient_name: data.patientName || '',
        formula: data.formula,
        merged_herbs: data.mergedHerbs,
        final_herbs: data.finalHerbs,
        total_doses: data.totalDoses,
        days: data.days,
        doses_per_day: data.dosesPerDay,
        total_packs: data.totalPacks,
        pack_volume: data.packVolume,
        water_amount: data.waterAmount,
        herb_adjustment: data.herbAdjustment || null,
        total_dosage: data.totalDosage,
        final_total_amount: data.finalTotalAmount,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('prescriptions')
        .update(updates)
        .eq('id', editingPrescription.id);

      if (error) throw error;

      alert('처방전이 수정되었습니다.');
      setViewMode('list');
      setEditingPrescription(null);
      loadPrescriptions();
    } catch (error) {
      console.error('처방 수정 실패:', error);
      alert('처방 수정에 실패했습니다.');
    }
  };

  // 처방 삭제
  const handleDelete = async (id: number) => {
    try {
      // 먼저 삭제할 처방의 source 정보 조회
      const prescriptionToDelete = prescriptions.find(p => p.id === id);

      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // source_type과 source_id가 있으면 해당 차트의 처방발급 상태 초기화
      if (prescriptionToDelete?.source_type && prescriptionToDelete?.source_id) {
        const tableName = prescriptionToDelete.source_type === 'initial_chart'
          ? 'initial_charts'
          : 'progress_notes';

        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            prescription_issued: false,
            prescription_issued_at: null
          })
          .eq('id', prescriptionToDelete.source_id);

        if (updateError) {
          console.error('차트 상태 업데이트 실패:', updateError);
        }
      }

      alert('처방전이 삭제되었습니다.');
      setDeleteConfirm(null);
      loadPrescriptions();
    } catch (error) {
      console.error('처방 삭제 실패:', error);
      alert('처방 삭제에 실패했습니다.');
    }
  };

  // 처방 인쇄 - 레이아웃별 함수
  const handlePrint = (prescription: Prescription, layoutType: PrintLayoutType) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      return;
    }

    const chartNumber = prescription.chart_number || '';
    const patientAge = prescription.patient_age;
    const patientGender = prescription.patient_gender === 'male' ? '남' :
                          prescription.patient_gender === 'female' ? '여' :
                          prescription.patient_gender || '';
    const packVol = prescription.pack_volume || 120;
    const waterAmt = prescription.water_amount ||
      Math.round(prescription.final_total_amount * 1.2 + packVol * (prescription.total_packs + 1) + 300);
    const issuedDate = prescription.issued_at
      ? new Date(prescription.issued_at).toLocaleString('ko-KR')
      : '-';

    // 환자 정보 문자열 (이름/차트번호/나이)
    const patientInfoStr = [
      prescription.patient_name || '-',
      chartNumber ? `(${chartNumber})` : '',
      patientAge ? `${patientAge}세` : ''
    ].filter(Boolean).join(' ');

    // 약재를 DB ID 순서로 정렬 (herb_id가 있는 경우)
    const sortedHerbs = [...prescription.final_herbs].sort((a, b) => {
      const idA = (a as any).herb_id || 99999;
      const idB = (b as any).herb_id || 99999;
      return idA - idB;
    });

    let htmlContent = '';

    if (layoutType === 'landscape') {
      // A4 가로형
      const herbsHtml = sortedHerbs
        .map(h => `<div class="herb-item"><span class="herb-name">${h.name}</span><span class="herb-amount">${Math.round(h.amount)}g</span></div>`)
        .join('');

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>처방전 - ${prescription.patient_name || '환자'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Malgun Gothic', sans-serif;
              padding: 10mm;
              font-size: 11px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .header h1 { font-size: 24px; letter-spacing: 6px; }
            .header .clinic { font-size: 12px; color: #555; }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #999;
              font-size: 13px;
            }
            .info-row .left, .info-row .right { display: flex; gap: 25px; }
            .info-item { display: flex; gap: 5px; }
            .info-item .label { font-weight: bold; }
            .summary-row {
              display: flex;
              justify-content: center;
              gap: 40px;
              padding: 10px;
              background: #f0f0f0;
              margin: 10px 0;
              font-weight: bold;
              font-size: 14px;
            }
            .herbs-container {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 0;
              border: 2px solid #333;
            }
            .herb-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 8px;
              background: white;
              font-size: 11px;
              border: 1px solid #ccc;
            }
            .herb-amount { font-weight: bold; min-width: 40px; text-align: right; }
            .total-row {
              display: flex;
              justify-content: flex-end;
              padding: 10px;
              font-weight: bold;
              font-size: 14px;
              background: #f5f5f5;
              border: 2px solid #333;
              border-top: none;
            }
            .water-row {
              display: flex;
              justify-content: center;
              gap: 15px;
              padding: 12px;
              margin-top: 10px;
              background: #e3f2fd;
              border: 2px solid #1976d2;
              border-radius: 6px;
            }
            .water-label { font-size: 16px; font-weight: bold; color: #1565c0; }
            .water-amount { font-size: 20px; font-weight: bold; color: #0d47a1; }
            @media print {
              body { padding: 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; size: A4 landscape; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>처 방 전</h1>
            <div class="clinic">연이재한의원</div>
          </div>
          <div class="info-row">
            <div class="left">
              <div class="info-item"><span class="label">환자:</span><span>${patientInfoStr}</span></div>
            </div>
            <div class="right">
              <div class="info-item"><span class="label">발급일:</span><span>${issuedDate}</span></div>
            </div>
          </div>
          <div class="summary-row">
            <span>총 ${prescription.total_packs}팩</span>
            <span>총 ${Math.round(prescription.final_total_amount).toLocaleString()}g</span>
          </div>
          <div class="herbs-container">${herbsHtml}</div>
          <div class="total-row"><span>합계: ${Math.round(prescription.final_total_amount).toLocaleString()}g</span></div>
          <div class="water-row">
            <span class="water-label">탕전 물양:</span>
            <span class="water-amount">${waterAmt.toLocaleString()}ml</span>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `;
    } else if (layoutType === 'portrait1') {
      // A4 세로형1 (4열 그리드)
      const herbsHtml = sortedHerbs
        .map(h => `<div class="herb-item"><span class="herb-name">${h.name}</span><span class="herb-amount">${Math.round(h.amount)}g</span></div>`)
        .join('');

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>처방전 - ${prescription.patient_name || '환자'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Malgun Gothic', sans-serif;
              padding: 15mm;
              font-size: 12px;
              width: 210mm;
              min-height: 297mm;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #333;
              padding-bottom: 12px;
              margin-bottom: 15px;
            }
            .header h1 { font-size: 28px; font-weight: bold; letter-spacing: 8px; margin-bottom: 6px; }
            .header .clinic { font-size: 14px; color: #555; }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #999;
              font-size: 14px;
            }
            .info-row .left, .info-row .right { display: flex; gap: 30px; }
            .info-item { display: flex; gap: 6px; }
            .info-item .label { font-weight: bold; }
            .summary-row {
              display: flex;
              justify-content: center;
              gap: 50px;
              padding: 12px;
              background: #f0f0f0;
              margin: 12px 0;
              font-weight: bold;
              font-size: 16px;
              border: 1px solid #ccc;
            }
            .herbs-container {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 0;
              border: 2px solid #333;
              margin-top: 10px;
            }
            .herb-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 10px;
              background: white;
              font-size: 13px;
              border: 1px solid #ccc;
            }
            .herb-name { font-weight: 500; }
            .herb-amount { font-weight: bold; color: #333; min-width: 50px; text-align: right; }
            .total-row {
              display: flex;
              justify-content: flex-end;
              padding: 12px 15px;
              font-weight: bold;
              font-size: 16px;
              background: #f5f5f5;
              border: 2px solid #333;
              border-top: none;
            }
            .water-row {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 15px;
              padding: 15px;
              margin-top: 15px;
              background: #e3f2fd;
              border: 3px solid #1976d2;
              border-radius: 8px;
            }
            .water-label { font-size: 18px; font-weight: bold; color: #1565c0; }
            .water-amount { font-size: 24px; font-weight: bold; color: #0d47a1; }
            @media print {
              body { padding: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>처 방 전</h1>
            <div class="clinic">연이재한의원</div>
          </div>
          <div class="info-row">
            <div class="left">
              <div class="info-item"><span class="label">환자:</span><span>${patientInfoStr}</span></div>
            </div>
            <div class="right">
              <div class="info-item"><span class="label">발급일:</span><span>${issuedDate}</span></div>
            </div>
          </div>
          <div class="summary-row">
            <span>총 ${prescription.total_packs}팩</span>
            <span>총 ${Math.round(prescription.final_total_amount).toLocaleString()}g</span>
          </div>
          <div class="herbs-container">${herbsHtml}</div>
          <div class="total-row"><span>합계: ${Math.round(prescription.final_total_amount).toLocaleString()}g</span></div>
          <div class="water-row">
            <span class="water-label">탕전 물양:</span>
            <span class="water-amount">${waterAmt.toLocaleString()}ml</span>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `;
    } else {
      // A4 세로형2 (심플 테이블) - 30개 초과 시 2열로 분할
      const MAX_HERBS_LEFT = 30;
      const needsTwoColumns = sortedHerbs.length > MAX_HERBS_LEFT;

      let leftHerbs, rightHerbs;
      if (needsTwoColumns) {
        leftHerbs = sortedHerbs.slice(0, MAX_HERBS_LEFT);
        rightHerbs = sortedHerbs.slice(MAX_HERBS_LEFT);
      } else {
        leftHerbs = sortedHerbs;
        rightHerbs = [];
      }

      const leftHerbsHtml = leftHerbs
        .map(h => `<tr><td class="row">${h.name}</td><td class="row">${Math.round(h.amount)}g</td></tr>`)
        .join('');

      const rightHerbsHtml = rightHerbs
        .map(h => `<tr><td class="row">${h.name}</td><td class="row">${Math.round(h.amount)}g</td></tr>`)
        .join('');

      // 요약 정보 HTML
      const summaryHtml = `
        <tr>
          <td class="row summary-row">총 ${sortedHerbs.length}개</td>
          <td class="row summary-row" style="text-align:right">총 ${Math.round(prescription.final_total_amount).toLocaleString()}g</td>
        </tr>
        <tr>
          <td class="row">${packVol}ml</td>
          <td class="row" style="text-align:right">${prescription.total_packs}팩</td>
        </tr>
        <tr>
          <td class="row water-row">${waterAmt.toLocaleString()}ml</td>
          <td class="row"><button class="print-btn" onclick="window.print()">인쇄하기</button></td>
        </tr>
      `;

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>처방전 - ${prescription.patient_name || '환자'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Malgun Gothic', sans-serif;
              padding: 5mm 15mm 15mm 15mm;
            }
            .container {
              display: flex;
              gap: 20px;
              align-items: flex-start;
            }
            table {
              border-collapse: collapse;
              width: 200px;
            }
            .row {
              border: 1px solid #999;
              padding: 5px 10px;
              height: 28px;
              font-size: 14px;
            }
            .header-row {
              font-weight: bold;
              font-size: 16px;
              background: #f5f5f5;
            }
            .summary-row {
              font-weight: bold;
              background: #e8e8e8;
            }
            .water-row {
              font-weight: bold;
              background: #e3f2fd;
              color: #1565c0;
            }
            .print-btn {
              padding: 8px 16px;
              font-size: 14px;
              cursor: pointer;
              background: #1976d2;
              color: white;
              border: none;
              border-radius: 4px;
            }
            .print-btn:hover { background: #1565c0; }
            @media print {
              .print-btn { display: none; }
              @page { margin: 10mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <table>
              <tr><td class="row header-row" colspan="2">${patientInfoStr}</td></tr>
              <tr><td class="row" colspan="2">${issuedDate}</td></tr>
              ${leftHerbsHtml}
              ${!needsTwoColumns ? summaryHtml : ''}
            </table>
            ${needsTwoColumns ? `
            <table>
              ${rightHerbsHtml}
              ${summaryHtml}
            </table>
            ` : ''}
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setPrintLayoutModal(null);
  };

  // 수정 모드로 전환
  const startEdit = (prescription: Prescription) => {
    setEditingPrescription(prescription);
    setViewMode('edit');
  };

  // 목록으로 돌아가기
  const goToList = () => {
    setViewMode('list');
    setEditingPrescription(null);
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 복용법 작성 페이지로 이동
  const goToDosageInstruction = (prescription: Prescription) => {
    navigate('/chart/dosage-instructions/create', {
      state: {
        prescriptionId: prescription.id,
        patientName: prescription.patient_name,
        patientAge: prescription.patient_age,
        patientGender: prescription.patient_gender,
        formula: prescription.formula,
        chiefComplaint: prescription.chief_complaint
      }
    });
  };

  // 복용법 작성 상태 업데이트
  const updateDosageInstructionStatus = async (prescriptionId: number, created: boolean) => {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          dosage_instruction_created: created,
          dosage_instruction_created_at: created ? new Date().toISOString() : null
        })
        .eq('id', prescriptionId);

      if (error) throw error;
      loadPrescriptions();
    } catch (error) {
      console.error('복용법 상태 업데이트 실패:', error);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-clinic-text-primary">
            <i className="fas fa-prescription mr-3 text-clinic-primary"></i>
            처방전 관리
          </h1>
          {viewMode === 'list' ? (
            <button
              onClick={() => setViewMode('new')}
              className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              새 처방 작성
            </button>
          ) : (
            <button
              onClick={goToList}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              목록으로
            </button>
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'list' ? (
            // 처방 목록
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-clinic-text-secondary">
                    <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4 mx-auto"></div>
                    <p>처방 목록을 불러오는 중...</p>
                  </div>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <i className="fas fa-file-medical text-6xl mb-4"></i>
                    <p>발급된 처방전이 없습니다</p>
                    <button
                      onClick={() => setViewMode('new')}
                      className="mt-4 px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900"
                    >
                      첫 처방 작성하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">발급일</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">환자명</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">처방공식</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">첩수</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">복용</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">총량</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {prescriptions.map((prescription) => (
                        <tr key={prescription.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-clinic-text-secondary">
                            {prescription.issued_at ? formatDate(prescription.issued_at) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-clinic-text-primary">
                            {prescription.patient_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-clinic-text-secondary font-mono">
                            {prescription.formula.length > 30
                              ? prescription.formula.substring(0, 30) + '...'
                              : prescription.formula}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-clinic-text-secondary">
                            {prescription.total_doses}첩
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-clinic-text-secondary">
                            {prescription.days}일 × {prescription.doses_per_day}팩
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-clinic-primary">
                            {Math.round(prescription.final_total_amount)}g
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => goToDosageInstruction(prescription)}
                                className={`p-2 rounded transition-colors relative ${
                                  prescription.dosage_instruction_created
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                }`}
                                title={prescription.dosage_instruction_created ? '복용법 작성완료 (클릭하여 수정)' : '복용법 작성'}
                              >
                                <i className="fas fa-file-medical"></i>
                                {prescription.dosage_instruction_created && (
                                  <i className="fas fa-check text-[10px] absolute top-1 right-1 text-emerald-600 bg-white rounded-full"></i>
                                )}
                              </button>
                              <button
                                onClick={() => startEdit(prescription)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="수정"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() => setPrintLayoutModal(prescription)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="인쇄"
                              >
                                <i className="fas fa-print"></i>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(prescription.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="삭제"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : viewMode === 'new' ? (
            // 새 처방 작성
            <PrescriptionInput
              onSave={handleSaveNew}
              showPatientInput={true}
              showNotesInput={true}
              showSaveButton={true}
              saveButtonText="처방전 발급"
            />
          ) : viewMode === 'edit' && editingPrescription ? (
            // 처방 수정
            <PrescriptionInput
              onSave={handleSaveEdit}
              showPatientInput={true}
              showNotesInput={true}
              showSaveButton={true}
              saveButtonText="처방전 수정"
              patientName={editingPrescription.patient_name}
              initialFormula={editingPrescription.formula}
              initialNotes={editingPrescription.notes || ''}
              initialTotalDoses={editingPrescription.total_doses}
              initialDays={editingPrescription.days}
              initialDosesPerDay={editingPrescription.doses_per_day}
            />
          ) : null}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
              처방전 삭제
            </h3>
            <p className="text-clinic-text-secondary mb-6">
              이 처방전을 삭제하시겠습니까?<br/>
              삭제된 처방전은 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 레이아웃 선택 모달 */}
      {printLayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">
              <i className="fas fa-print text-green-600 mr-2"></i>
              인쇄 레이아웃 선택
            </h3>
            <p className="text-clinic-text-secondary mb-4 text-sm">
              {printLayoutModal.patient_name || '환자'} - {printLayoutModal.formula}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handlePrint(printLayoutModal, 'landscape')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-clinic-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
                    <i className="fas fa-file-alt text-gray-500 transform rotate-90"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-clinic-text-primary">A4 가로형</div>
                    <div className="text-xs text-gray-500">6열 그리드, 넓은 레이아웃</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handlePrint(printLayoutModal, 'portrait1')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-clinic-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-12 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
                    <i className="fas fa-file-alt text-gray-500"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-clinic-text-primary">A4 세로형 1</div>
                    <div className="text-xs text-gray-500">4열 그리드, 정리된 레이아웃</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handlePrint(printLayoutModal, 'portrait2')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-clinic-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-12 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
                    <i className="fas fa-list text-gray-500"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-clinic-text-primary">A4 세로형 2</div>
                    <div className="text-xs text-gray-500">심플 테이블, 처방공식 포함</div>
                  </div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setPrintLayoutModal(null)}
              className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionManagement;
