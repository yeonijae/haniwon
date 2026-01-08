import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';

const PRESET_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#A855F7', // purple-500
];

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#3B82F6');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(getAbsoluteUrl(user?.avatarUrl));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens or user data changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(user?.displayName || '');
      setAvatarColor(user?.avatarColor || '#3B82F6');
      setAvatarPreview(getAbsoluteUrl(user?.avatarUrl));
      setSelectedFile(null);
    }
  }, [isOpen, user?.displayName, user?.avatarColor, user?.avatarUrl]);

  const updateProfile = useMutation({
    mutationFn: async (data: { display_name?: string; avatar_url?: string | null; avatar_color?: string | null }) => {
      const response = await api.patch('/users/me', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      updateUser({
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        avatarColor: data.avatar_color,
      });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setSelectedFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    let uploadedUrl: string | null = avatarPreview;

    // Upload new avatar if selected
    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const response = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedUrl = response.data.data?.url || response.data.url;
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Update profile
    updateProfile.mutate({
      display_name: displayName,
      avatar_url: uploadedUrl,
      avatar_color: avatarColor,
    });
  };

  const getInitial = () => {
    return displayName?.[0]?.toUpperCase() || user?.displayName?.[0]?.toUpperCase() || '?';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">프로필 설정</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="프로필 사진"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg"
                  style={{ backgroundColor: avatarColor }}
                >
                  {getInitial()}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                이미지 업로드
              </button>
              {avatarPreview && (
                <button
                  onClick={handleRemoveAvatar}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  이미지 제거
                </button>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              표시 이름
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="이름을 입력하세요"
            />
          </div>

          {/* Avatar Color (shown when no image) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기본 아바타 색상 {avatarPreview && <span className="text-gray-400">(이미지가 없을 때 사용)</span>}
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-10 h-10 rounded-full border-2 transition-transform ${
                    avatarColor === color
                      ? 'border-gray-800 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-sm text-gray-500">커스텀 색상:</label>
              <input
                type="color"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <span className="text-sm text-gray-500">{avatarColor}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isUploading || updateProfile.isPending}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isUploading || updateProfile.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
