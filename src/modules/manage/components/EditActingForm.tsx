import React, { useState } from 'react';
import { Acting } from '../types';

interface EditActingFormProps {
  acting: Acting;
  doctorId: string;
  onUpdate: (doctorId: string, actingId: string, updatedData: { patientName: string; duration: number; memo: string; }) => void;
  onClose: () => void;
}

const EditActingForm: React.FC<EditActingFormProps> = ({ acting, doctorId, onUpdate, onClose }) => {
  const [formData, setFormData] = useState({
    patientName: acting.patientName,
    type: acting.type,
    duration: acting.duration,
    memo: acting.memo || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const targetType = (e.target as HTMLInputElement).type;
    setFormData(prev => ({
      ...prev,
      [name]: targetType === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { type, ...dataToUpdate } = formData;
    onUpdate(doctorId, acting.id, dataToUpdate);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">액팅 종류</label>
        <div className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600 sm:text-sm">
          {formData.type}
        </div>
      </div>
      <div>
        <label htmlFor="patientName" className="block text-sm font-medium text-gray-700">환자 이름</label>
        <input
          type="text"
          id="patientName"
          name="patientName"
          value={formData.patientName}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">예상 시간 (분)</label>
        <input
          type="number"
          id="duration"
          name="duration"
          value={formData.duration}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="memo" className="block text-sm font-medium text-gray-700">메모</label>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          value={formData.memo}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
          placeholder="액팅 관련 메모를 입력하세요..."
        ></textarea>
      </div>
      <div className="flex justify-end pt-4 border-t mt-4 space-x-2">
        <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
        <button type="submit" className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장</button>
      </div>
    </form>
  );
};

export default EditActingForm;
