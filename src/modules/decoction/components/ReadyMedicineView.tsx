// 데이터 소스: inventory 모듈의 cs_medicine_inventory 테이블 (cs/lib/api)
// 주의: decoction/lib/api.ts의 ready_medicines 테이블과는 별도 데이터임
import ReadyMedicineList from '../../inventory/pages/ReadyMedicineList';

/**
 * 탕전실 상비약 탭 — inventory ReadyMedicineList를 그대로 재사용.
 * 탕전실 전용 뷰가 필요해지면 이 래퍼를 확장할 것.
 */
export default function ReadyMedicineView() {
  return <ReadyMedicineList />;
}
