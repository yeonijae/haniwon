import { useState } from 'react'
import NewHerbForm from './NewHerbForm'
import NewMedicineForm from './NewMedicineForm'
import BulkHerbUpload from './BulkHerbUpload'
import NewPrescriptionForm from './NewPrescriptionForm'
import PrescriptionDefinitionList from './PrescriptionDefinitionList'
import BulkPrescriptionUpload from './BulkPrescriptionUpload'

interface SettingsModalProps {
  onClose: () => void
}

type SettingSection = 'herbs' | 'medicines' | 'prescriptions'
type HerbTab = 'register' | 'bulk'
type MedicineTab = 'register' | 'bulk'
type PrescriptionTab = 'list' | 'register' | 'bulk'

function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingSection>('herbs')
  const [herbTab, setHerbTab] = useState<HerbTab>('register')
  const [medicineTab, setMedicineTab] = useState<MedicineTab>('register')
  const [prescriptionTab, setPrescriptionTab] = useState<PrescriptionTab>('list')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="bg-clinic-primary text-white px-6 py-4">
            <h2 className="text-xl font-bold">환경 설정</h2>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => setActiveSection('herbs')}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                activeSection === 'herbs'
                  ? 'bg-clinic-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fa-solid fa-leaf mr-2"></i>
              약재 설정
            </button>
            <button
              onClick={() => setActiveSection('medicines')}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                activeSection === 'medicines'
                  ? 'bg-clinic-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fa-solid fa-pills mr-2"></i>
              상비약 설정
            </button>
            <button
              onClick={() => setActiveSection('prescriptions')}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                activeSection === 'prescriptions'
                  ? 'bg-clinic-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fa-solid fa-file-prescription mr-2"></i>
              처방 정의
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              {activeSection === 'herbs' && '약재 설정'}
              {activeSection === 'medicines' && '상비약 설정'}
              {activeSection === 'prescriptions' && '처방 정의'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <i className="fa-solid fa-xmark text-2xl"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            {activeSection === 'herbs' && (
              <nav className="flex space-x-4 px-6">
                <button
                  onClick={() => setHerbTab('register')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    herbTab === 'register'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  약재 등록
                </button>
                <button
                  onClick={() => setHerbTab('bulk')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    herbTab === 'bulk'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  약재 일괄 등록
                </button>
              </nav>
            )}
            {activeSection === 'medicines' && (
              <nav className="flex space-x-4 px-6">
                <button
                  onClick={() => setMedicineTab('register')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    medicineTab === 'register'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  상비약 등록
                </button>
                <button
                  onClick={() => setMedicineTab('bulk')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    medicineTab === 'bulk'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  상비약 일괄 등록
                </button>
              </nav>
            )}
            {activeSection === 'prescriptions' && (
              <nav className="flex space-x-4 px-6">
                <button
                  onClick={() => setPrescriptionTab('list')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    prescriptionTab === 'list'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  처방 목록
                </button>
                <button
                  onClick={() => setPrescriptionTab('register')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    prescriptionTab === 'register'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  처방 등록
                </button>
                <button
                  onClick={() => setPrescriptionTab('bulk')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    prescriptionTab === 'bulk'
                      ? 'border-clinic-primary text-clinic-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  처방 일괄 등록
                </button>
              </nav>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {/* 약재 설정 */}
            {activeSection === 'herbs' && herbTab === 'register' && (
              <NewHerbForm onSuccess={onClose} />
            )}
            {activeSection === 'herbs' && herbTab === 'bulk' && (
              <BulkHerbUpload onSuccess={onClose} />
            )}

            {/* 상비약 설정 */}
            {activeSection === 'medicines' && medicineTab === 'register' && (
              <NewMedicineForm onSuccess={onClose} />
            )}
            {activeSection === 'medicines' && medicineTab === 'bulk' && (
              <div className="bg-white rounded-lg p-6 text-center">
                <i className="fa-solid fa-file-excel text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-600">상비약 일괄 등록 기능 (준비중)</p>
              </div>
            )}

            {/* 처방전 설정 */}
            {activeSection === 'prescriptions' && prescriptionTab === 'list' && (
              <PrescriptionDefinitionList />
            )}
            {activeSection === 'prescriptions' && prescriptionTab === 'register' && (
              <NewPrescriptionForm onSuccess={onClose} />
            )}
            {activeSection === 'prescriptions' && prescriptionTab === 'bulk' && (
              <BulkPrescriptionUpload onSuccess={onClose} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
