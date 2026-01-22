import React, { useState, useEffect } from 'react';
import {
  type TreatmentPackage,
  type HerbalPackage,
  type NokryongPackage,
  type Membership,
  type HerbalPickup,
  type DeliveryMethod,
  type ReceiptMemo,
  type YakchimUsageRecord,
  HERBAL_PACKAGE_ROUNDS,
} from '../types';
import { type HerbalDiseaseTag } from '../lib/api';
import {
  getPackageDiseaseTags,
  getHerbalPurposes,
  getHerbalDiseaseTags,
  getNokryongTypes,
  getMembershipTypes,
  setPackageDiseaseTags,
  findOrCreateDiseaseTag,
  updateHerbalPackage,
  deleteHerbalPackage,
  updateTreatmentPackage,
  deleteTreatmentPackage,
  updateNokryongPackage,
  deleteNokryongPackage,
  updateMembership,
  deleteMembership,
  getHerbalPackageById,
  getActiveNokryongPackages,
  updateHerbalPickup,
  deleteHerbalPickup,
  getActiveHerbalPackages,
  createHerbalPickup,
  updateYakchimUsageRecord,
  deleteYakchimUsageRecord,
} from '../lib/api';

// 인라인 메모 편집 컴포넌트
export const InlineMemoEdit: React.FC<{
  memo: ReceiptMemo | undefined;
  onSave: (memoId: number, newText: string) => void;
  onDelete: (memoId: number) => void;
  onClose: () => void;
}> = React.memo(({ memo, onSave, onDelete, onClose }) => {
  const [localText, setLocalText] = useState(memo?.memo || '');

  return (
    <div className="timeline-edit-inline">
      <div className="timeline-edit-memo">
        <input
          type="text"
          className="memo-edit-input-inline"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && memo?.id) {
              onSave(memo.id, localText);
            }
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          autoFocus
          placeholder="메모 내용"
        />
      </div>
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={() => memo?.id && onDelete(memo.id)}
        >
          삭제
        </button>
        <button
          className="btn-save-inline"
          onClick={() => memo?.id && onSave(memo.id, localText)}
        >
          저장
        </button>
        <button className="btn-close-inline" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
});

InlineMemoEdit.displayName = 'InlineMemoEdit';

// 인라인 한약 선결제 수정 컴포넌트
export const InlineHerbalPackageEdit: React.FC<{
  pkg: HerbalPackage;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ pkg, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 폼 상태
  const [herbalPurposes, setHerbalPurposes] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState(pkg.herbal_name || '');
  const [packageType, setPackageType] = useState<'1month' | '2month' | '3month' | '6month'>(
    (pkg.package_type as '1month' | '2month' | '3month' | '6month') || '1month'
  );
  const [memo, setMemo] = useState(pkg.memo || '');

  // 질환명 태그 상태
  const [availableDiseaseTags, setAvailableDiseaseTags] = useState<HerbalDiseaseTag[]>([]);
  const [selectedDiseaseTags, setSelectedDiseaseTags] = useState<{ id?: number; name: string }[]>([]);
  const [diseaseInput, setDiseaseInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      const [purposes, tags] = await Promise.all([
        getHerbalPurposes(),
        getHerbalDiseaseTags(),
      ]);
      setHerbalPurposes(purposes);
      setAvailableDiseaseTags(tags);

      // 기존 질환명 태그 로드
      if (pkg.id) {
        const existingTags = await getPackageDiseaseTags(pkg.id);
        setSelectedDiseaseTags(existingTags.map(t => ({ id: t.id, name: t.name })));
      }
    };
    loadData();
  }, [pkg.id]);

  // 질환명 태그 필터링
  const filteredTags = availableDiseaseTags.filter(
    tag => tag.name.toLowerCase().includes(diseaseInput.toLowerCase()) &&
           !selectedDiseaseTags.some(s => s.name === tag.name)
  );

  // 태그 추가
  const handleAddTag = (tag: { id?: number; name: string }) => {
    setSelectedDiseaseTags([...selectedDiseaseTags, tag]);
    setDiseaseInput('');
    setShowSuggestions(false);
  };

  // 태그 제거
  const handleRemoveTag = (name: string) => {
    setSelectedDiseaseTags(selectedDiseaseTags.filter(t => t.name !== name));
  };

  // 저장
  const handleSave = async () => {
    if (!pkg.id) return;

    setIsSaving(true);
    try {
      const totalCount = HERBAL_PACKAGE_ROUNDS[packageType] || 2;
      const usedCount = pkg.used_count || 0;

      await updateHerbalPackage(pkg.id, {
        herbal_name: selectedPurpose,
        package_type: packageType,
        total_count: totalCount,
        remaining_count: Math.max(0, totalCount - usedCount),
        memo: memo.trim() || null,
      });

      // 질환명 태그 연결
      if (selectedDiseaseTags.length > 0) {
        const tagIds: number[] = [];
        for (const tag of selectedDiseaseTags) {
          const tagId = tag.id ?? await findOrCreateDiseaseTag(tag.name);
          tagIds.push(tagId);
        }
        await setPackageDiseaseTags(pkg.id, tagIds);
      } else {
        await setPackageDiseaseTags(pkg.id, []);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('한약 패키지 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!pkg.id) return;
    if (!confirm('이 한약 선결제를 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await deleteHerbalPackage(pkg.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('한약 패키지 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalCount = HERBAL_PACKAGE_ROUNDS[packageType] || 2;
  const usedCount = pkg.used_count || 0;

  return (
    <div className="timeline-edit-inline herbal-edit">
      {/* 상단 정보 */}
      <div className="herbal-edit-info">
        <span className="info-item">
          <i className="fa-solid fa-calendar"></i>
          {pkg.start_date}
        </span>
        <span className="info-item">
          총 {totalCount}회 / 사용 {usedCount}회 / 남은 {Math.max(0, totalCount - usedCount)}회
        </span>
      </div>

      {/* 치료목적 */}
      <div className="herbal-edit-row">
        <label>치료목적</label>
        <select
          value={selectedPurpose}
          onChange={(e) => setSelectedPurpose(e.target.value)}
        >
          {herbalPurposes.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* 패키지 종류 */}
      <div className="herbal-edit-row">
        <label>종류</label>
        <div className="package-type-buttons">
          {(['1month', '2month', '3month', '6month'] as const).map(type => (
            <button
              key={type}
              className={`type-btn ${packageType === type ? 'active' : ''}`}
              onClick={() => setPackageType(type)}
            >
              {type.replace('month', 'M')}
              <span className="count">({HERBAL_PACKAGE_ROUNDS[type]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 질환명 태그 */}
      <div className="herbal-edit-row">
        <label>질환명</label>
        <div className="disease-tags-inline">
          <div className="tags-list">
            {selectedDiseaseTags.map(tag => (
              <span key={tag.name} className="disease-tag-item">
                {tag.name}
                <button onClick={() => handleRemoveTag(tag.name)}>×</button>
              </span>
            ))}
          </div>
          <div className="tag-input-wrapper">
            <input
              type="text"
              value={diseaseInput}
              onChange={(e) => {
                setDiseaseInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && diseaseInput.trim()) {
                  e.preventDefault();
                  if (!selectedDiseaseTags.some(t => t.name === diseaseInput.trim())) {
                    handleAddTag({ name: diseaseInput.trim() });
                  }
                }
              }}
              placeholder="질환명 입력"
            />
            {showSuggestions && filteredTags.length > 0 && (
              <div className="tag-suggestions">
                {filteredTags.slice(0, 5).map(tag => (
                  <div
                    key={tag.id}
                    className="suggestion-item"
                    onMouseDown={() => handleAddTag(tag)}
                  >
                    {tag.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="herbal-edit-row">
        <label>메모</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
        />
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineHerbalPackageEdit.displayName = 'InlineHerbalPackageEdit';

// 통증마일리지 인라인 수정 컴포넌트
export const InlineTreatmentPackageEdit: React.FC<{
  pkg: TreatmentPackage;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ pkg, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 폼 상태
  const [packageName, setPackageName] = useState(pkg.package_name || '');
  const [totalCount, setTotalCount] = useState(pkg.total_count || 10);
  const [includes, setIncludes] = useState(pkg.includes || '');
  const [memo, setMemo] = useState(pkg.memo || '');

  const usedCount = pkg.used_count || 0;

  // 저장
  const handleSave = async () => {
    if (!pkg.id) return;

    setIsSaving(true);
    try {
      await updateTreatmentPackage(pkg.id, {
        package_name: packageName,
        total_count: totalCount,
        remaining_count: Math.max(0, totalCount - usedCount),
        includes: includes.trim() || null,
        memo: memo.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('통마 패키지 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!pkg.id) return;
    if (!confirm('이 통증마일리지를 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await deleteTreatmentPackage(pkg.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('통마 패키지 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="timeline-edit-inline treatment-edit">
      {/* 상단 정보 */}
      <div className="herbal-edit-info">
        <span className="info-item">
          <i className="fa-solid fa-calendar"></i>
          {pkg.start_date}
        </span>
        <span className="info-item">
          총 {totalCount}회 / 사용 {usedCount}회 / 남은 {Math.max(0, totalCount - usedCount)}회
        </span>
      </div>

      {/* 패키지명 */}
      <div className="herbal-edit-row">
        <label>패키지명</label>
        <input
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="통마, 약침 등"
        />
      </div>

      {/* 총 횟수 */}
      <div className="herbal-edit-row">
        <label>총 횟수</label>
        <div className="count-input-group">
          <button
            type="button"
            className="count-btn"
            onClick={() => setTotalCount(Math.max(usedCount, totalCount - 1))}
          >
            -
          </button>
          <input
            type="number"
            value={totalCount}
            onChange={(e) => setTotalCount(Math.max(usedCount, Number(e.target.value)))}
            min={usedCount}
          />
          <button
            type="button"
            className="count-btn"
            onClick={() => setTotalCount(totalCount + 1)}
          >
            +
          </button>
        </div>
      </div>

      {/* 포함 항목 */}
      <div className="herbal-edit-row">
        <label>포함 항목</label>
        <input
          type="text"
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
          placeholder="경근1, 비추 등"
        />
      </div>

      {/* 메모 */}
      <div className="herbal-edit-row">
        <label>메모</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
        />
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineTreatmentPackageEdit.displayName = 'InlineTreatmentPackageEdit';

// 녹용 선결제 인라인 수정 컴포넌트
export const InlineNokryongPackageEdit: React.FC<{
  pkg: NokryongPackage;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ pkg, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 녹용 종류 옵션
  const [nokryongTypes, setNokryongTypes] = useState<string[]>([]);

  // package_name에서 녹용 종류 추출 (예: "녹용(베이직) 6회분" -> "베이직")
  const extractNokryongType = (name: string): string => {
    const match = name.match(/녹용\(([^)]+)\)/);
    return match ? match[1] : '';
  };

  // 폼 상태
  const [selectedType, setSelectedType] = useState(extractNokryongType(pkg.package_name || ''));
  const [totalMonths, setTotalMonths] = useState(pkg.total_months || 6);
  const [memo, setMemo] = useState(pkg.memo || '');

  const usedMonths = (pkg.total_months || 0) - (pkg.remaining_months || 0);

  // 녹용 종류 로드
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await getNokryongTypes();
        setNokryongTypes(types);
        // 현재 선택된 종류가 목록에 없으면 첫 번째로 설정
        if (types.length > 0 && !selectedType) {
          setSelectedType(types[0]);
        }
      } catch (err) {
        console.error('녹용 종류 로드 실패:', err);
      }
    };
    loadTypes();
  }, []);

  // 저장
  const handleSave = async () => {
    if (!pkg.id) return;
    if (!selectedType) {
      alert('녹용 종류를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const newPackageName = `녹용(${selectedType}) ${totalMonths}회분`;
      await updateNokryongPackage(pkg.id, {
        package_name: newPackageName,
        total_months: totalMonths,
        remaining_months: Math.max(0, totalMonths - usedMonths),
        memo: memo.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('녹용 패키지 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!pkg.id) return;
    if (!confirm('이 녹용 선결제를 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await deleteNokryongPackage(pkg.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('녹용 패키지 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="timeline-edit-inline nokryong-edit">
      {/* 상단 정보 */}
      <div className="herbal-edit-info">
        <span className="info-item">
          <i className="fa-solid fa-calendar"></i>
          {pkg.start_date}
        </span>
        <span className="info-item">
          총 {totalMonths}회분 / 사용 {usedMonths}회분 / 남은 {Math.max(0, totalMonths - usedMonths)}회분
        </span>
      </div>

      {/* 녹용 종류 */}
      <div className="herbal-edit-row">
        <label>녹용 종류</label>
        <div className="nokryong-type-buttons">
          {nokryongTypes.map(type => (
            <button
              key={type}
              type="button"
              className={`nokryong-type-btn ${selectedType === type ? 'active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 총 회분수 */}
      <div className="herbal-edit-row">
        <label>총 회분수</label>
        <div className="count-input-group">
          <button
            type="button"
            className="count-btn"
            onClick={() => setTotalMonths(Math.max(usedMonths, totalMonths - 1))}
          >
            -
          </button>
          <input
            type="number"
            value={totalMonths}
            onChange={(e) => setTotalMonths(Math.max(usedMonths, Number(e.target.value)))}
            min={usedMonths}
          />
          <button
            type="button"
            className="count-btn"
            onClick={() => setTotalMonths(totalMonths + 1)}
          >
            +
          </button>
        </div>
      </div>

      {/* 메모 */}
      <div className="herbal-edit-row">
        <label>메모</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
        />
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting || !selectedType}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineNokryongPackageEdit.displayName = 'InlineNokryongPackageEdit';

// 멤버십 등록 인라인 수정 컴포넌트
export const InlineMembershipEdit: React.FC<{
  membership: Membership;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ membership, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 멤버십 종류 옵션
  const [membershipTypes, setMembershipTypes] = useState<string[]>([]);

  // 폼 상태
  const [membershipType, setMembershipType] = useState(membership.membership_type || '');
  const [quantity, setQuantity] = useState(membership.quantity || 1);
  const [startDate, setStartDate] = useState(membership.start_date || '');
  const [expireDate, setExpireDate] = useState(membership.expire_date || '');
  const [memo, setMemo] = useState(membership.memo || '');
  const [status, setStatus] = useState<'active' | 'expired'>(membership.status || 'active');

  // 멤버십 종류 로드
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await getMembershipTypes();
        setMembershipTypes(types);
      } catch (err) {
        console.error('멤버십 종류 로드 실패:', err);
      }
    };
    loadTypes();
  }, []);

  // 저장
  const handleSave = async () => {
    if (!membership.id) return;
    if (!membershipType) {
      alert('멤버십 종류를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await updateMembership(membership.id, {
        membership_type: membershipType,
        quantity,
        start_date: startDate,
        expire_date: expireDate,
        memo: memo.trim() || undefined,
        status,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!membership.id) return;
    if (!confirm('이 멤버십을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await deleteMembership(membership.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="timeline-edit-inline membership-edit">
      {/* 멤버십 종류 */}
      <div className="herbal-edit-row">
        <label>멤버십 종류</label>
        <select
          value={membershipType}
          onChange={(e) => setMembershipType(e.target.value)}
        >
          <option value="">선택</option>
          {membershipTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* 수량 */}
      <div className="herbal-edit-row">
        <label>수량 (일일 이용 횟수)</label>
        <div className="count-input-group">
          <button
            type="button"
            className="count-btn"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            min={1}
          />
          <button
            type="button"
            className="count-btn"
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
      </div>

      {/* 기간 */}
      <div className="herbal-edit-row">
        <label>시작일</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="herbal-edit-row">
        <label>만료일</label>
        <input
          type="date"
          value={expireDate}
          onChange={(e) => setExpireDate(e.target.value)}
        />
      </div>

      {/* 상태 */}
      <div className="herbal-edit-row">
        <label>상태</label>
        <div className="status-toggle-buttons">
          <button
            type="button"
            className={`status-btn ${status === 'active' ? 'active' : ''}`}
            onClick={() => setStatus('active')}
          >
            활성
          </button>
          <button
            type="button"
            className={`status-btn expired ${status === 'expired' ? 'active' : ''}`}
            onClick={() => setStatus('expired')}
          >
            만료
          </button>
        </div>
      </div>

      {/* 메모 */}
      <div className="herbal-edit-row">
        <label>메모</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
        />
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting || !membershipType}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineMembershipEdit.displayName = 'InlineMembershipEdit';

// 한약 선결제 사용(차감) 인라인 편집 컴포넌트
export const InlineHerbalPickupEdit: React.FC<{
  pickup: HerbalPickup;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ pickup, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 연결된 패키지 정보
  const [herbalPackage, setHerbalPackage] = useState<HerbalPackage | null>(null);
  // 녹용 패키지 목록 (with_nokryong 옵션용)
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);

  // 폼 상태
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(pickup.delivery_method);
  const [withNokryong, setWithNokryong] = useState(pickup.with_nokryong);
  const [selectedNokryongId, setSelectedNokryongId] = useState<number | undefined>(pickup.nokryong_package_id);

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      // 연결된 한약 패키지 정보 로드
      if (pickup.package_id) {
        const pkg = await getHerbalPackageById(pickup.package_id);
        setHerbalPackage(pkg);
      }
      // 활성 녹용 패키지 로드
      const noks = await getActiveNokryongPackages(pickup.patient_id);
      setNokryongPackages(noks);
      // 기존에 연결된 녹용이 있으면 선택
      if (pickup.nokryong_package_id && noks.length > 0) {
        setSelectedNokryongId(pickup.nokryong_package_id);
      } else if (noks.length > 0) {
        setSelectedNokryongId(noks[0].id);
      }
    };
    loadData();
  }, [pickup.package_id, pickup.patient_id, pickup.nokryong_package_id]);

  // 저장
  const handleSave = async () => {
    if (!pickup.id) return;

    setIsSaving(true);
    try {
      const previousNokryongId = pickup.with_nokryong ? pickup.nokryong_package_id : null;

      await updateHerbalPickup(
        pickup.id,
        {
          delivery_method: deliveryMethod,
          with_nokryong: withNokryong,
          nokryong_package_id: withNokryong ? selectedNokryongId : null,
        },
        previousNokryongId
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('차감 기록 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!pickup.id) return;
    if (!confirm('이 차감 기록을 삭제하시겠습니까? 패키지 회차가 복원됩니다.')) return;

    setIsDeleting(true);
    try {
      await deleteHerbalPickup(pickup.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('차감 기록 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedNokryong = nokryongPackages.find(n => n.id === selectedNokryongId);

  return (
    <div className="timeline-edit-inline pickup-edit">
      {/* 상단 정보 */}
      <div className="pickup-edit-info">
        <span className="info-item">
          <i className="fa-solid fa-box"></i>
          {herbalPackage?.herbal_name || '한약'}
        </span>
        <span className="info-item">
          {pickup.round_number}회차
        </span>
        <span className="info-item">
          {pickup.pickup_date}
        </span>
      </div>

      {/* 수령방법 */}
      <div className="pickup-edit-row">
        <label>수령방법</label>
        <div className="delivery-method-buttons">
          {(['pickup', 'local', 'express'] as DeliveryMethod[]).map(method => (
            <button
              key={method}
              className={`method-btn ${deliveryMethod === method ? 'active' : ''}`}
              onClick={() => setDeliveryMethod(method)}
            >
              {method === 'pickup' ? '내원' : method === 'local' ? '시내' : '시외'}
            </button>
          ))}
        </div>
      </div>

      {/* 녹용 사용 */}
      <div className="pickup-edit-row">
        <label>녹용 사용</label>
        <div className="nokryong-option">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={withNokryong}
              onChange={(e) => setWithNokryong(e.target.checked)}
              disabled={nokryongPackages.length === 0}
            />
            {withNokryong && selectedNokryong && (
              <span className="nokryong-info">
                {selectedNokryong.package_name} (남음: {selectedNokryong.remaining_months}회분)
              </span>
            )}
          </label>
          {withNokryong && nokryongPackages.length > 1 && (
            <select
              value={selectedNokryongId || ''}
              onChange={(e) => setSelectedNokryongId(Number(e.target.value))}
            >
              {nokryongPackages.map(nok => (
                <option key={nok.id} value={nok.id}>
                  {nok.package_name} (남음: {nok.remaining_months}회분)
                </option>
              ))}
            </select>
          )}
          {nokryongPackages.length === 0 && (
            <span className="no-nokryong">녹용 선결제 없음</span>
          )}
        </div>
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineHerbalPickupEdit.displayName = 'InlineHerbalPickupEdit';

// 한약 선결제 사용(새 수령 기록 생성) 인라인 패널
export const InlineHerbalDeductPanel: React.FC<{
  patientId: number;
  chartNumber: string;
  patientName: string;
  receiptId: number;
  receiptDate: string;
  detailId?: number;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ patientId, chartNumber, patientName, receiptId, receiptDate, detailId, onSuccess, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);

  // 활성 한약 패키지 목록
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [selectedHerbal, setSelectedHerbal] = useState<HerbalPackage | null>(null);

  // 녹용 패키지 목록
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);

  // 폼 상태
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [withNokryong, setWithNokryong] = useState(false);
  const [selectedNokryongId, setSelectedNokryongId] = useState<number | undefined>();

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      // 활성 한약 패키지 로드
      const herbals = await getActiveHerbalPackages(patientId);
      setHerbalPackages(herbals);
      if (herbals.length > 0) {
        setSelectedHerbal(herbals[0]);
      }

      // 활성 녹용 패키지 로드
      const noks = await getActiveNokryongPackages(patientId);
      setNokryongPackages(noks);
      if (noks.length > 0) {
        setSelectedNokryongId(noks[0].id);
      }
    };
    loadData();
  }, [patientId]);

  // 차감 처리
  const handleDeduct = async () => {
    if (!selectedHerbal) {
      alert('차감할 선결제 패키지를 선택해주세요.');
      return;
    }
    if (selectedHerbal.remaining_count <= 0) {
      alert('해당 패키지의 잔여 회차가 없습니다.');
      return;
    }
    if (withNokryong && !selectedNokryongId) {
      alert('녹용 사용을 선택했지만 녹용 패키지가 없습니다.');
      return;
    }

    const selectedNokryong = nokryongPackages.find(n => n.id === selectedNokryongId);
    if (withNokryong && selectedNokryong && selectedNokryong.remaining_months <= 0) {
      alert('녹용 패키지의 잔여 회분이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const nextRound = selectedHerbal.used_count + 1;

      // 수령 기록 생성 (타임라인 이벤트로 표시됨)
      await createHerbalPickup({
        package_id: selectedHerbal.id!,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        pickup_date: receiptDate,
        round_number: nextRound,
        delivery_method: deliveryMethod,
        with_nokryong: withNokryong,
        nokryong_package_id: withNokryong ? selectedNokryongId : undefined,
        receipt_id: receiptId,
        mssql_detail_id: detailId,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('차감 처리 오류:', err);
      alert('차감 처리에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedNokryong = nokryongPackages.find(n => n.id === selectedNokryongId);

  return (
    <div className="timeline-edit-inline deduct-panel">
      <div className="deduct-panel-header">
        <span className="panel-title">한약 선결제 사용</span>
      </div>

      {herbalPackages.length === 0 ? (
        <div className="deduct-panel-empty">
          <p>차감할 선결제가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 패키지 선택 */}
          <div className="pickup-edit-row">
            <label>패키지</label>
            <select
              value={selectedHerbal?.id || ''}
              onChange={(e) => {
                const pkg = herbalPackages.find(p => p.id === Number(e.target.value));
                setSelectedHerbal(pkg || null);
              }}
            >
              {herbalPackages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.herbal_name || '한약'} - {pkg.remaining_count}회 남음
                </option>
              ))}
            </select>
          </div>

          {selectedHerbal && (
            <>
              {/* 남은 회차 정보 */}
              <div className="pickup-edit-info">
                <span className="info-item">
                  <i className="fa-solid fa-box"></i>
                  {selectedHerbal.herbal_name || '한약'}
                </span>
                <span className="info-item highlight">
                  {selectedHerbal.remaining_count}회 남음
                  <span className="total-info"> / {selectedHerbal.total_count}회</span>
                </span>
              </div>

              {/* 수령방법 */}
              <div className="pickup-edit-row">
                <label>수령방법</label>
                <div className="delivery-method-buttons">
                  {(['pickup', 'local', 'express'] as DeliveryMethod[]).map(method => (
                    <button
                      key={method}
                      className={`method-btn ${deliveryMethod === method ? 'active' : ''}`}
                      onClick={() => setDeliveryMethod(method)}
                    >
                      {method === 'pickup' ? '내원' : method === 'local' ? '시내' : '시외'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 녹용 사용 */}
              <div className="pickup-edit-row">
                <label>녹용 사용</label>
                <div className="nokryong-option">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={withNokryong}
                      onChange={(e) => setWithNokryong(e.target.checked)}
                      disabled={nokryongPackages.length === 0}
                    />
                  </label>
                  {withNokryong && nokryongPackages.length > 0 && (
                    <select
                      value={selectedNokryongId || ''}
                      onChange={(e) => setSelectedNokryongId(Number(e.target.value))}
                    >
                      {nokryongPackages.map(nok => (
                        <option key={nok.id} value={nok.id}>
                          {nok.package_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleDeduct}
          disabled={isSaving || !selectedHerbal || selectedHerbal.remaining_count <= 0}
        >
          {isSaving ? '처리중...' : '사용'}
        </button>
      </div>
    </div>
  );
});

InlineHerbalDeductPanel.displayName = 'InlineHerbalDeductPanel';

// 약침 사용 기록 인라인 편집 컴포넌트
export const InlineYakchimEdit: React.FC<{
  record: YakchimUsageRecord;
  onSuccess: () => void;
  onClose: () => void;
}> = React.memo(({ record, onSuccess, onClose }) => {
  const [quantity, setQuantity] = useState(record.quantity || 1);
  const [memo, setMemo] = useState(record.memo || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateYakchimUsageRecord(record.id, {
        quantity,
        memo: memo.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('약침 사용 기록 수정 실패:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 약침 사용 기록을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await deleteYakchimUsageRecord(record.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('약침 사용 기록 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 소스 타입 라벨
  const sourceTypeLabel = {
    'membership': '멤버십',
    'package': '패키지',
    'one-time': '일회성',
  }[record.source_type] || record.source_type;

  return (
    <div className="timeline-edit-inline yakchim-edit">
      {/* 상단 정보 */}
      <div className="herbal-edit-info">
        <span className="info-item">
          <i className="fa-solid fa-calendar"></i>
          {record.usage_date}
        </span>
        <span className="info-item">
          {sourceTypeLabel}
          {record.source_name && ` · ${record.source_name}`}
        </span>
        {record.source_type !== 'one-time' && (
          <span className="info-item">
            잔여 {record.remaining_after}회
          </span>
        )}
      </div>

      {/* 항목명 */}
      <div className="herbal-edit-row">
        <label>항목</label>
        <span className="yakchim-item-name">{record.item_name}</span>
      </div>

      {/* 수량 */}
      <div className="herbal-edit-row">
        <label>수량</label>
        <div className="count-input-group">
          <button
            type="button"
            className="count-btn"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={isSaving || isDeleting || quantity <= 1}
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            disabled={isSaving || isDeleting}
          />
          <button
            type="button"
            className="count-btn"
            onClick={() => setQuantity(quantity + 1)}
            disabled={isSaving || isDeleting}
          >
            +
          </button>
        </div>
      </div>

      {/* 메모 */}
      <div className="herbal-edit-row">
        <label>메모</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          disabled={isSaving || isDeleting}
        />
      </div>

      {/* 버튼 */}
      <div className="timeline-edit-actions">
        <button
          className="btn-delete-inline"
          onClick={handleDelete}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? '삭제중...' : '삭제'}
        </button>
        <button className="btn-close-inline" onClick={onClose} disabled={isSaving || isDeleting}>
          닫기
        </button>
        <button
          className="btn-save-inline"
          onClick={handleSave}
          disabled={isSaving || isDeleting}
        >
          {isSaving ? '저장중...' : '저장'}
        </button>
      </div>
    </div>
  );
});

InlineYakchimEdit.displayName = 'InlineYakchimEdit';
