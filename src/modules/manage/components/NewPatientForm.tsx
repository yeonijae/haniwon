
import React, { useState } from 'react';
import { DOCTORS } from '../constants';

export interface NewPatientData {
  name: string;
  chartNumber: string;
  dob: string;
  gender: 'male' | 'female' | '';
  address: string;
  phone: string;
  referral: string;
  doctor: string;
  treatmentType: string;
}

interface NewPatientFormProps {
  addNewPatient: (patientData: NewPatientData) => void;
  onClose: () => void;
}

const NewPatientForm: React.FC<NewPatientFormProps> = ({ addNewPatient, onClose }) => {
  const [formData, setFormData] = useState<NewPatientData>({
    name: '',
    chartNumber: '',
    dob: '',
    gender: '',
    address: '',
    phone: '',
    referral: '',
    doctor: '',
    treatmentType: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, name, value } = e.target;
    const key = id || name;
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as 'male' | 'female' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('환자 이름을 입력해주세요.');
      return;
    }
    addNewPatient(formData);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* 이름 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
          <input type="text" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

        {/* 차트번호 */}
        <div>
          <label htmlFor="chartNumber" className="block text-sm font-medium text-gray-700">차트번호</label>
          <input type="text" id="chartNumber" value={formData.chartNumber} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

        {/* 생년월일 */}
        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-gray-700">생년월일</label>
          <input type="date" id="dob" value={formData.dob} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

        {/* 성별 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">성별</label>
          <div className="mt-2 flex items-center space-x-6">
            <label className="inline-flex items-center">
              <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
              <span className="ml-2 text-sm text-gray-700">남성</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
              <span className="ml-2 text-sm text-gray-700">여성</span>
            </label>
          </div>
        </div>
        
        {/* 주소 */}
        <div className="md:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">주소</label>
          <input type="text" id="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

        {/* 연락처 */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">연락처</label>
          <input type="tel" id="phone" value={formData.phone} onChange={handleChange} placeholder="010-1234-5678" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>
        
        {/* 유입경로 */}
        <div>
          <label htmlFor="referral" className="block text-sm font-medium text-gray-700">유입경로</label>
          <input type="text" id="referral" value={formData.referral} onChange={handleChange} placeholder="예: 지인소개, 인터넷검색" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

        {/* 담당의 */}
        <div>
          <label htmlFor="doctor" className="block text-sm font-medium text-gray-700">담당의</label>
          <select id="doctor" name="doctor" value={formData.doctor} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm">
            <option value="">담당의 선택</option>
            {DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* 희망치료 종류 */}
        <div>
          <label htmlFor="treatmentType" className="block text-sm font-medium text-gray-700">희망치료 종류</label>
          <input type="text" id="treatmentType" value={formData.treatmentType} onChange={handleChange} placeholder="예: 허리디스크, 비염" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
        </div>

      </div>

      <div className="flex justify-end pt-4 border-t mt-6">
        <button type="button" onClick={onClose} className="mr-2 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
        <button type="submit" className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장하기</button>
      </div>
    </form>
  );
};

export default NewPatientForm;
